"""Dry-run and guarded publisher for staged CFB27 Dynasty data.

This tool intentionally treats the existing Rutgers app as the contract owner.
By default it performs a dry run only: it validates staging data, reports the
production files that would be replaced, writes preview artifacts under
data/generated/dynasty/publish_preview, and leaves production JSON/JS unchanged.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_STAGING = ROOT / "data" / "generated" / "dynasty" / "staging"
DEFAULT_PREVIEW = ROOT / "data" / "generated" / "dynasty" / "publish_preview"
DEFAULT_BACKUP_ROOT = ROOT / "data" / "generated" / "dynasty" / "rollback"
DEFAULT_REPORT = ROOT / "reports" / "cfb27_week1_publish_dry_run_report.md"


PRODUCTION_TARGETS = {
    "rutgers_roster": ROOT / "data" / "rutgers_roster_base.json",
    "engine_bundle": ROOT / "data" / "engine_data.js",
    "rutgers_team_bundle": ROOT / "data" / "rutgers_team.js",
    "weekly_plan_bundle": ROOT / "data" / "weekly_plan.js",
    "gameplan_weekly": ROOT / "data" / "gameplan_weekly.json",
    "rutgers_season_stats": ROOT / "data" / "rutgers_season_stats.json",
    "opponent_season_stats": ROOT / "data" / "opponent_season_stats.json",
    "rutgers_verified_stats_json": ROOT / "data" / "video_verified" / "rutgers_season_stats.json",
    "opponent_verified_stats_json": ROOT / "data" / "video_verified" / "purdue_season_stats.json",
    "rutgers_verified_stats_bundle": ROOT / "data" / "video_verified" / "rutgers_season_stats.js",
    "opponent_verified_stats_bundle": ROOT / "data" / "video_verified" / "purdue_season_stats.js",
    "opponent_verified_roster_json": ROOT / "data" / "video_verified" / "purdue_roster.json",
    "opponent_verified_roster_bundle": ROOT / "data" / "video_verified" / "purdue_roster.js",
    "opponent_recovery_bundle": ROOT / "data" / "video_verified" / "purdue_roster_recovery.js",
    "rutgers_recovery_bundle": ROOT / "data" / "video_verified" / "rutgers_roster_recovery.js",
    "manual_depth_chart": ROOT / "data" / "depth_chart_seed.json",
    "manual_depth_chart_bundle": ROOT / "data" / "depth_chart_seed.js",
}


PRESERVED_TARGETS: dict[str, Path] = {}


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def value_or_none(value: Any) -> Any:
    if isinstance(value, dict) and "value" in value:
        return value["value"]
    return value


def iter_strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        strings: list[str] = []
        for item in value.values():
            strings.extend(iter_strings(item))
        return strings
    if isinstance(value, list):
        strings = []
        for item in value:
            strings.extend(iter_strings(item))
        return strings
    return []


def scrub_stale_terms(value: Any, stale_terms: list[str], replacement: str = "Regenerated from Week 1 Dynasty save-derived data.") -> Any:
    if isinstance(value, str):
        lowered = value.lower()
        if any(term.lower() in lowered for term in stale_terms):
            return replacement
        return value
    if isinstance(value, dict):
        return {key: scrub_stale_terms(item, stale_terms, replacement) for key, item in value.items()}
    if isinstance(value, list):
        return [scrub_stale_terms(item, stale_terms, replacement) for item in value]
    return value


def collect_previous_opponent_terms() -> list[str]:
    terms: set[str] = set()
    gameplan_path = ROOT / "data" / "gameplan_weekly.json"
    if gameplan_path.exists():
        try:
            gameplan = read_json(gameplan_path)
            profile = gameplan.get("opponent_profile") or {}
            for key in ("team", "name", "nickname", "abbreviation"):
                value = profile.get(key)
                if (
                    isinstance(value, str)
                    and value.lower() not in {"umass", "massachusetts"}
                    and len(value) <= 32
                    and "regenerated" not in value.lower()
                    and "save-derived" not in value.lower()
                ):
                    terms.add(value)
        except (OSError, json.JSONDecodeError):
            pass
    opponent_roster_path = ROOT / "data" / "video_verified" / "purdue_roster.json"
    if opponent_roster_path.exists():
        try:
            roster = read_json(opponent_roster_path)
            roster_name = (roster.get("opponent") or roster.get("team") or {}).get("name")
            if isinstance(roster_name, str) and roster_name.lower() in {"umass", "massachusetts"}:
                return sorted(term for term in terms if len(term) >= 4)
            for player in roster.get("players", []):
                name = player.get("name") or player.get("full_name")
                if isinstance(name, str) and len(name.strip()) >= 4:
                    terms.add(name.strip())
        except (OSError, json.JSONDecodeError):
            pass
    terms.add("Purdue")
    terms.add("Boilermakers")
    return sorted(term for term in terms if len(term) >= 4)


def collect_previous_rutgers_terms(current_players: list[dict[str, Any]]) -> list[str]:
    current_names = {
        str(player.get("name") or "").strip().lower()
        for player in current_players
        if player.get("name")
    }
    current_names.update(
        str(player.get("full_name") or "").strip().lower()
        for player in current_players
        if player.get("full_name")
    )
    terms: set[str] = set()
    sources = [
        ROOT / "data" / "rutgers_roster_base.json",
    ]
    for path in sources:
        if not path.exists():
            continue
        try:
            payload = read_json(path)
        except (OSError, json.JSONDecodeError):
            continue
        for player in payload.get("players", []):
            for key in ("name", "full_name"):
                name = player.get(key)
                normalized = str(name or "").strip().lower()
                if name and normalized and normalized not in current_names and len(str(name).strip()) >= 4:
                    terms.add(str(name).strip())
    recovery_path = ROOT / "data" / "video_verified" / "rutgers_roster_recovery.js"
    if recovery_path.exists():
        try:
            payload = parse_window_assignment(recovery_path.read_text(encoding="utf-8"), "VIDEO_VERIFIED_RUTGERS_ROSTER_RECOVERY")
            for player in payload.get("players", []):
                for key in ("name", "full_name"):
                    name = player.get(key)
                    normalized = str(name or "").strip().lower()
                    if name and normalized and normalized not in current_names and len(str(name).strip()) >= 4:
                        terms.add(str(name).strip())
        except (OSError, ValueError, json.JSONDecodeError):
            pass
    return sorted(terms)


def find_stale_terms(payloads: dict[str, Any], stale_terms: list[str]) -> dict[str, list[str]]:
    matches: dict[str, list[str]] = {}
    for label, payload in payloads.items():
        found: set[str] = set()
        for text in iter_strings(payload):
            lowered = text.lower()
            for term in stale_terms:
                if term.lower() in lowered:
                    found.add(term)
        if found:
            matches[label] = sorted(found)
    return matches


def validate_staging(staging_dir: Path) -> list[str]:
    errors: list[str] = []
    required = [
        "dynasty_status.json",
        "rutgers_roster_from_save.json",
        "opponent_roster_from_save.json",
        "injuries_from_save.json",
        "schedule_week_from_save.json",
        "team_stats_from_save.json",
        "depth_chart_from_save.json",
        "opponent_scouting_from_save.json",
    ]
    for name in required:
        if not (staging_dir / name).exists():
            errors.append(f"Missing staging file: {name}")

    if errors:
        return errors

    status = read_json(staging_dir / "dynasty_status.json")
    rutgers = read_json(staging_dir / "rutgers_roster_from_save.json")
    opponent = read_json(staging_dir / "opponent_roster_from_save.json")
    injuries = read_json(staging_dir / "injuries_from_save.json")
    schedule = read_json(staging_dir / "schedule_week_from_save.json")
    depth = read_json(staging_dir / "depth_chart_from_save.json")
    scouting = read_json(staging_dir / "opponent_scouting_from_save.json")

    if status.get("status") != "PASS":
        errors.append("Staging status is not PASS")
    if len(rutgers.get("players", [])) != 85:
        errors.append("Rutgers staging roster does not contain 85 players")
    if len(opponent.get("players", [])) != 85:
        errors.append("Opponent staging roster does not contain 85 players")
    if status.get("current_week") != 1:
        errors.append("Staging current week is not Week 1")
    if status.get("upcoming_opponent", {}).get("status") != "Unplayed":
        errors.append("Upcoming game is not marked Unplayed")
    if injuries.get("metadata", {}).get("rutgers_count") is None:
        errors.append("Rutgers injury metadata count is missing")
    if not schedule.get("games"):
        errors.append("Schedule staging has no games")
    if depth.get("metadata", {}).get("confidence") != "manual_static":
        errors.append("Depth chart staging is not marked manual_static")
    if scouting.get("opponent", {}).get("team_id") != 119:
        errors.append("Opponent scouting does not target UMass team ID 119")
    if scouting.get("opponent", {}).get("name") != "UMass":
        errors.append("Opponent scouting does not target UMass")
    if scouting.get("run_direction", {}).get("alignment_status") != "position_group_based_not_alignment_verified":
        errors.append("Run-direction scouting is not labeled as position-group based")
    if scouting.get("pass_protection", {}).get("alignment_status") != "position_group_based_not_alignment_verified":
        errors.append("Pass-protection scouting is not labeled as position-group based")
    return errors


def convert_player(player: dict[str, Any]) -> dict[str, Any]:
    attrs = player.get("attributes") or {}
    converted = {
        "player_id": str(player.get("player_id")),
        "name": player.get("name"),
        "full_name": player.get("full_name") or player.get("name"),
        "position": player.get("position"),
        "class_year": player.get("class_year"),
        "overall": player.get("overall"),
        "jersey_number": player.get("jersey"),
        "jersey": player.get("jersey"),
        "attributes": attrs,
        "source": "cfb27_dynasty_save_staging",
        "verification_status": "probable_parser_output",
        "analysis": {
            "role": player.get("role") or "Roster player",
            "summary": "Parser-derived Week 1 roster record. Production statistics are unavailable before the first game.",
            "strengths": [],
            "limitations": [],
            "best_usage": [],
        },
    }
    return converted


def convert_roster_package(roster: dict[str, Any], status: dict[str, Any]) -> dict[str, Any]:
    team = roster.get("team") or {}
    return {
        "schema_version": "4.0",
        "package_type": "rutgers_roster_base",
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "source_truth": "cfb27_dynasty_save",
        "publish_state": "preview_only",
        "team": {
            "name": team.get("name") or "Rutgers",
            "team_id": team.get("team_id"),
            "record": status.get("rutgers_record") or "0-0",
            "overall": team.get("overall"),
            "offense": team.get("offense_overall"),
            "defense": team.get("defense_overall"),
        },
        "players": [convert_player(player) for player in roster.get("players", [])],
    }


def convert_opponent_roster_package(opponent: dict[str, Any], status: dict[str, Any]) -> dict[str, Any]:
    team = opponent.get("team") or {}
    return {
        "schema_version": "1.1",
        "package_type": "video_verified_opponent_roster",
        "publish_note": "Preview contains current Week 1 opponent data. Legacy static bundle filenames may remain for compatibility only.",
        "source_truth": "cfb27_dynasty_save",
        "source_rule": "Parser-derived Week 1 opponent roster. Missing values remain null.",
        "opponent": {
            "name": team.get("name") or status.get("upcoming_opponent", {}).get("name"),
            "team_id": team.get("team_id"),
            "week": status.get("current_week"),
            "game_status": status.get("upcoming_opponent", {}).get("status"),
        },
        "players": [convert_player(player) for player in opponent.get("players", [])],
    }


def empty_week1_stats_package(team_name: str, opponent: bool = False) -> dict[str, Any]:
    package_type = "opponent_season_stats" if opponent else "rutgers_season_stats"
    return {
        "schema_version": "1.1",
        "package_type": package_type,
        "team": team_name if not opponent else None,
        "opponent": {"name": team_name, "replace_next_week": True} if opponent else None,
        "games_played": 0,
        "verification_status": "probable_parser_output",
        "source_truth": "cfb27_dynasty_save",
        "player_stat_state": "No games played; individual season stat rows are absent or empty in the Week 1 unplayed export.",
        "passing": [],
        "rushing": [],
        "receiving": [],
        "defense": [],
        "kicking": [],
        "punting": [],
    }


def convert_gameplan(existing: dict[str, Any], status: dict[str, Any], opponent: dict[str, Any], scouting: dict[str, Any]) -> dict[str, Any]:
    package = deepcopy(existing)
    opp_team = opponent.get("team") or {}
    package["generated_utc"] = datetime.now(timezone.utc).isoformat()
    package["source_truth"] = "cfb27_dynasty_save_preview"
    profile = package.setdefault("opponent_profile", {})
    profile.update(
        {
            "team": opp_team.get("name") or status.get("upcoming_opponent", {}).get("name"),
            "name": opp_team.get("name") or status.get("upcoming_opponent", {}).get("name"),
            "nickname": None,
            "abbreviation": None,
            "team_id": opp_team.get("team_id"),
            "record": status.get("upcoming_opponent", {}).get("record") or "0-0",
            "game_status": status.get("upcoming_opponent", {}).get("status"),
            "data_quality_rule": "Week 1 staging data is parser-derived; no production game has been played.",
        }
    )
    package["week"] = status.get("current_week")
    package["opponent"] = profile.get("team")
    package["opponent_scouting"] = scouting
    package["run_direction_recommendation"] = scouting.get("run_direction")
    package["pass_protection_recommendation"] = scouting.get("pass_protection")
    package["strengths"] = scouting.get("strengths")
    package["weaknesses"] = scouting.get("weaknesses")
    return package


def convert_weekly_plan(existing_text: str, status: dict[str, Any], opponent: dict[str, Any], scouting: dict[str, Any]) -> dict[str, Any]:
    data = parse_window_assignment(existing_text, "WEEKLY_PLAN")
    opp_team = opponent.get("team") or {}
    data["buildId"] = "UMASS-WEEK-001-PREVIEW"
    gameday = data.setdefault("gameday", {})
    gameday["currentWeek"] = f"Week {status.get('current_week')}"
    gameday["seasonRecord"] = status.get("rutgers_record") or "0-0"
    gameday["lastUpdated"] = "Dynasty save preview"
    opp = data.setdefault("opponent", {})
    opp["name"] = opp_team.get("name") or status.get("upcoming_opponent", {}).get("name")
    opp["team_id"] = opp_team.get("team_id")
    opp["week"] = f"Week {status.get('current_week')}"
    opp["record"] = status.get("upcoming_opponent", {}).get("record") or "0-0"
    opp["game_status"] = status.get("upcoming_opponent", {}).get("status")
    data["opponentScouting"] = scouting
    return data


def parse_window_assignment(text: str, name: str) -> dict[str, Any]:
    marker = f"window.{name} = "
    start = text.find(marker)
    if start < 0:
        raise ValueError(f"Unable to find {marker}")
    start += len(marker)
    depth = 0
    in_string = False
    escaped = False
    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : index + 1])
    raise ValueError(f"Unable to parse {name} assignment")


def js_assignment(name: str, payload: Any) -> str:
    return f"window.{name} = " + json.dumps(payload, indent=2, ensure_ascii=False) + ";\n"


def replace_window_assignment(source: str, name: str, payload: Any) -> str:
    marker = f"window.{name} ="
    start = source.find(marker)
    replacement = js_assignment(name, payload).rstrip()
    if start < 0:
        return source.rstrip() + "\n" + replacement + "\n"
    cursor = source.find("{", start)
    bracket_cursor = source.find("[", start)
    if cursor < 0 or (bracket_cursor >= 0 and bracket_cursor < cursor):
        cursor = bracket_cursor
    if cursor < 0:
        line_end = source.find("\n", start)
        return source[:start] + replacement + (source[line_end:] if line_end >= 0 else "")
    opener = source[cursor]
    closer = "}" if opener == "{" else "]"
    depth = 0
    in_string = False
    escaped = False
    end = cursor
    while end < len(source):
        char = source[end]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
        else:
            if char == '"':
                in_string = True
            elif char == opener:
                depth += 1
            elif char == closer:
                depth -= 1
                if depth == 0:
                    end += 1
                    break
        end += 1
    semicolon = source.find(";", end)
    if semicolon >= 0:
        end = semicolon + 1
    return source[:start] + replacement + source[end:]


def build_preview(staging_dir: Path) -> tuple[dict[str, Any], dict[str, str], list[str]]:
    status = read_json(staging_dir / "dynasty_status.json")
    rutgers = read_json(staging_dir / "rutgers_roster_from_save.json")
    opponent = read_json(staging_dir / "opponent_roster_from_save.json")
    depth = read_json(staging_dir / "depth_chart_from_save.json")
    scouting = read_json(staging_dir / "opponent_scouting_from_save.json")
    gameplan_existing = read_json(ROOT / "data" / "gameplan_weekly.json")
    stale_terms = collect_previous_opponent_terms()
    stale_rutgers_terms = collect_previous_rutgers_terms(rutgers.get("players", []))
    depth_metadata = depth.get("metadata") or {}

    warnings = [
        "Existing app loads static JS bundles, so a real publish must update JS wrappers and matching JSON together.",
        "Legacy opponent bundle filenames contain Purdue, but Week 1 staging opponent is UMass.",
        "Player season stat files are valid empty Week 1 packages because no game has been played.",
        f"Manual depth chart was validated against the current parser roster: {depth_metadata.get('validated_count', 0)} retained, {depth_metadata.get('rejected_count', 0)} rejected.",
    ]

    roster_package = convert_roster_package(rutgers, status)
    opponent_package = convert_opponent_roster_package(opponent, status)
    rutgers_stats = empty_week1_stats_package("Rutgers", opponent=False)
    opponent_stats = empty_week1_stats_package(opponent_package["opponent"]["name"] or "Opponent", opponent=True)
    gameplan = convert_gameplan(gameplan_existing, status, opponent, scouting)
    weekly_plan = convert_weekly_plan((ROOT / "data" / "weekly_plan.js").read_text(encoding="utf-8"), status, opponent, scouting)

    rutgers_team = {
        "team": "Rutgers",
        "team_id": rutgers.get("team", {}).get("team_id"),
        "overall": rutgers.get("team", {}).get("overall"),
        "offense": rutgers.get("team", {}).get("offense_overall"),
        "defense": rutgers.get("team", {}).get("defense_overall"),
        "weeklyMutable": True,
        "sourceConfidence": "Parser-derived Week 1 staging preview.",
        "players": {},
    }

    depth_chart_payload = json.loads(json.dumps(depth.get("depth_chart") or {}))
    depth_validation = depth_chart_payload.setdefault("validation", {})
    depth_validation.setdefault("current_roster_player_count", len(rutgers.get("players", [])))
    depth_validation.setdefault("validated_count", depth_metadata.get("validated_count", depth_validation.get("validated_entries", 0)))
    depth_validation.setdefault("rejected_count", depth_metadata.get("rejected_count", depth_validation.get("rejected_entries", 0)))
    depth_validation.setdefault("validated_entries_detail", depth_metadata.get("validated_entries", []))
    depth_validation.setdefault("rejected_entries_detail", depth_metadata.get("rejected_entries", []))
    depth_validation.setdefault("source", depth_metadata.get("source", "manual_static_existing_app_seed"))
    depth_validation.setdefault("rule", depth_metadata.get("rule", "Only current parser-roster validated manual entries are retained."))

    preview_objects = {
        "data/rutgers_roster_base.json": roster_package,
        "data/gameplan_weekly.json": gameplan,
        "data/rutgers_season_stats.json": rutgers_stats,
        "data/opponent_season_stats.json": opponent_stats,
        "data/video_verified/rutgers_season_stats.json": rutgers_stats,
        "data/video_verified/purdue_season_stats.json": opponent_stats,
        "data/video_verified/purdue_roster.json": opponent_package,
        "data/depth_chart_seed.json": depth_chart_payload,
        "data/generated/current_opponent_scouting_preview.json": scouting,
        "data/generated/weekly_plan_payload_preview.json": weekly_plan,
    }
    preview_objects = {
        key: scrub_stale_terms(
            scrub_stale_terms(value, stale_terms, "Regenerated from Week 1 UMass save-derived scouting."),
            stale_rutgers_terms,
            "Regenerated from the current Week 1 parser-derived Rutgers roster.",
        )
        for key, value in preview_objects.items()
    }
    gameplan = preview_objects["data/gameplan_weekly.json"]
    opponent_package = preview_objects["data/video_verified/purdue_roster.json"]
    depth_chart = preview_objects["data/depth_chart_seed.json"]
    scouting = preview_objects["data/generated/current_opponent_scouting_preview.json"]
    weekly_plan = preview_objects["data/generated/weekly_plan_payload_preview.json"]
    engine_bundle = (ROOT / "data" / "engine_data.js").read_text(encoding="utf-8")
    engine_bundle = replace_window_assignment(engine_bundle, "RUTGERS_ROSTER_BASE", roster_package)
    engine_bundle = replace_window_assignment(engine_bundle, "GAMEPLAN_WEEKLY", gameplan)

    preview_texts = {
        "data/engine_data.js": engine_bundle,
        "data/rutgers_team.js": js_assignment("RUTGERS_TEAM", rutgers_team),
        "data/weekly_plan.js": js_assignment("WEEKLY_PLAN", weekly_plan),
        "data/depth_chart_seed.js": js_assignment("RUTGERS_DEPTH_CHART_SEED", depth_chart),
        "data/video_verified/rutgers_season_stats.js": js_assignment("VIDEO_VERIFIED_RUTGERS_SEASON_STATS", {"categories": rutgers_stats, **rutgers_stats}),
        "data/video_verified/purdue_season_stats.js": js_assignment("VIDEO_VERIFIED_PURDUE_SEASON_STATS", {"categories": opponent_stats, **opponent_stats}),
        "data/video_verified/purdue_roster.js": js_assignment("PURDUE_OPPONENT_PLAYERS", opponent_package) + js_assignment("VIDEO_VERIFIED_PURDUE_ROSTER", opponent_package),
        "data/video_verified/purdue_roster_recovery.js": js_assignment("VIDEO_VERIFIED_PURDUE_ROSTER_RECOVERY", opponent_package),
        "data/video_verified/rutgers_roster_recovery.js": js_assignment(
            "VIDEO_VERIFIED_RUTGERS_ROSTER_RECOVERY",
            {"schema_version": "1.1", "package_type": "video_verified_rutgers_roster_recovery", "players": roster_package["players"]},
        ),
    }
    return preview_objects, preview_texts, warnings


def validate_preview(preview_objects: dict[str, Any], preview_texts: dict[str, str]) -> list[str]:
    errors: list[str] = []
    roster = preview_objects["data/rutgers_roster_base.json"]
    opponent = preview_objects["data/video_verified/purdue_roster.json"]
    scouting = preview_objects["data/generated/current_opponent_scouting_preview.json"]
    depth = preview_objects["data/depth_chart_seed.json"]
    if len(roster.get("players", [])) != 85:
        errors.append("Preview Rutgers roster does not contain 85 players")
    if len(opponent.get("players", [])) != 85:
        errors.append("Preview opponent roster does not contain 85 players")
    if scouting.get("opponent", {}).get("name") != "UMass":
        errors.append("Preview scouting package does not target UMass")
    stale_matches = find_stale_terms(preview_objects, collect_previous_opponent_terms())
    if stale_matches:
        errors.append(f"Preview current-opponent payload still contains stale previous-opponent terms: {stale_matches}")
    stale_roster_matches = find_stale_terms(preview_objects, collect_previous_rutgers_terms(roster.get("players", [])))
    if stale_roster_matches:
        errors.append(f"Preview current Rutgers payload still contains stale previous-roster terms: {stale_roster_matches}")
    if depth.get("validation", {}).get("current_roster_player_count") != 85:
        errors.append("Preview depth chart was not validated against the current 85-player roster")
    if "1305" in json.dumps(preview_objects.get("data/rutgers_season_stats.json", {})) or "683" in json.dumps(preview_objects.get("data/rutgers_season_stats.json", {})):
        errors.append("Preview Week 1 Rutgers stats still contain previous-season leader values")
    for label, payload in preview_objects.items():
        try:
            json.dumps(payload)
        except TypeError as exc:
            errors.append(f"{label} is not JSON serializable: {exc}")
    for label, text in preview_texts.items():
        if "[object Object]" in text or "undefined" in text or "null;" in text:
            errors.append(f"{label} contains an invalid raw rendering token")
    return errors


def write_preview(preview_dir: Path, preview_objects: dict[str, Any], preview_texts: dict[str, str]) -> None:
    if preview_dir.exists():
        shutil.rmtree(preview_dir)
    for rel, payload in preview_objects.items():
        write_json(preview_dir / rel, payload)
    for rel, text in preview_texts.items():
        path = preview_dir / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")


def copy_preview_to_production(preview_dir: Path, backup_dir: Path) -> list[str]:
    replaced: list[str] = []
    backup_dir.mkdir(parents=True, exist_ok=True)
    for label, target in PRODUCTION_TARGETS.items():
        rel = target.relative_to(ROOT)
        source = preview_dir / rel
        if not source.exists():
            raise FileNotFoundError(f"Preview source missing for {label}: {source}")
        if not target.exists():
            raise FileNotFoundError(f"Production target missing for {label}: {target}")
        backup_path = backup_dir / rel
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target, backup_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        replaced.append(str(rel))
    return replaced


def restore_production_from_backup(backup_dir: Path, replaced: list[str]) -> None:
    for rel_text in replaced:
        rel = Path(rel_text)
        backup_path = backup_dir / rel
        target = ROOT / rel
        if backup_path.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(backup_path, target)


def run_validation_commands() -> list[dict[str, Any]]:
    commands = [
        [sys.executable, "-m", "compileall", "-q", str(ROOT / "tools" / "cfb27_save_reader")],
        [sys.executable, "-m", "unittest", "discover", "-s", str(ROOT / "tools" / "cfb27_save_reader" / "tests"), "-v"],
        [sys.executable, "-m", "unittest", "tests.test_process_week"],
        ["node", "--check", "app.js"],
        ["node", "--check", "tools/validate.js"],
        ["node", "tools/validate.js"],
    ]
    results = []
    for command in commands:
        proc = subprocess.run(command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        fail_lines = "\n".join(line for line in proc.stdout.splitlines() if "FAIL" in line)
        diagnostic = (fail_lines + "\n\n" if fail_lines else "") + proc.stdout[-8000:]
        results.append({"command": " ".join(command), "returncode": proc.returncode, "output_tail": diagnostic})
    return results


def write_report(
    path: Path,
    staging_dir: Path,
    backup_dir: Path,
    preview_dir: Path,
    staging_errors: list[str],
    preview_errors: list[str],
    warnings: list[str],
    validation_results: list[dict[str, Any]],
    scouting: dict[str, Any] | None = None,
    dry_run: bool = True,
    production_changed: bool = False,
    files_replaced: list[str] | None = None,
    rollback_status: str = "not_applicable",
) -> None:
    scouting = scouting or {}
    provenance = scouting.get("provenance") or {}
    run_direction = scouting.get("run_direction") or {}
    pass_protection = scouting.get("pass_protection") or {}
    lines = [
        "# Week 1 Dynasty Publish",
        "",
        "No production Rutgers app data was modified." if dry_run else f"Production Rutgers app data modified: {'yes' if production_changed else 'no'}.",
        "",
        f"Staging source: `{staging_dir}`",
        f"Preview output: `{preview_dir}`",
        f"Backup destination: `{backup_dir}`",
        "",
        "## Production Files Targeted",
    ]
    for label, target in PRODUCTION_TARGETS.items():
        lines.append(f"- {label}: `{target.relative_to(ROOT)}`")
    lines.extend(["", "## Preserved Manual Files"])
    for label, target in PRESERVED_TARGETS.items():
        lines.append(f"- {label}: `{target.relative_to(ROOT)}`")
    lines.extend(["", "## Validation"])
    lines.append(f"- Staging validation: {'PASS' if not staging_errors else 'FAIL'}")
    for error in staging_errors:
        lines.append(f"  - {error}")
    lines.append(f"- Preview compatibility: {'PASS' if not preview_errors else 'FAIL'}")
    for error in preview_errors:
        lines.append(f"  - {error}")
    stale_failed = any("stale previous-opponent" in error for error in preview_errors)
    lines.append(f"- Stale-opponent validation: {'FAIL' if stale_failed else 'PASS'}")
    stale_roster_failed = any("stale previous-roster" in error for error in preview_errors)
    lines.append(f"- Stale Rutgers roster validation: {'FAIL' if stale_roster_failed else 'PASS'}")
    lines.extend(["", "## Warnings"])
    for warning in warnings:
        lines.append(f"- {warning}")
    lines.extend(["", "## Opponent Scouting Provenance"])
    lines.append(f"- Save-derived fields: {', '.join(provenance.get('save_derived') or ['none'])}")
    lines.append(f"- Calculated fields: {', '.join(provenance.get('calculated') or ['none'])}")
    lines.append(f"- Manual/static fields: {', '.join(provenance.get('manual_static') or ['none'])}")
    lines.append(f"- Unavailable fields: {', '.join(provenance.get('unavailable') or ['none'])}")
    lines.extend(["", "## Current Recommendations"])
    lines.append(f"- Run direction: {run_direction.get('primary_run_direction', 'unavailable')}")
    lines.append(f"- Run-direction alignment status: {run_direction.get('alignment_status', 'unavailable')}")
    lines.append(f"- Run-direction reason: {run_direction.get('reason', 'unavailable')}")
    lines.append(f"- Pass protection: {pass_protection.get('primary_protection_call', 'unavailable')}")
    lines.append(f"- Pass-protection alignment status: {pass_protection.get('alignment_status', 'unavailable')}")
    lines.append(f"- Pass-protection reason: {pass_protection.get('reason', 'unavailable')}")
    lines.extend(["", "## Full Validation Suite"])
    for result in validation_results:
        status = "PASS" if result["returncode"] == 0 else "FAIL"
        lines.append(f"- `{result['command']}`: {status}")
    lines.extend(["", "## Fields Remaining Unavailable"])
    lines.append("- Individual player season statistics: unavailable before Week 1 is played.")
    lines.append("- Parser-derived Rutgers depth chart: unavailable; manual/static depth chart preserved.")
    lines.append("- Manual depth chart: stale entries are rejected and published only as unavailable/manual-verification slots.")
    lines.append("- Recruiting and awards: outside this Week 1 MVP publish.")
    lines.extend(["", "## Publish Outcome"])
    lines.append(f"- Mode: {'dry run' if dry_run else 'real publish'}")
    lines.append(f"- Production changed: {'yes' if production_changed else 'no'}")
    lines.append(f"- Rollback status: {rollback_status}")
    if files_replaced:
        lines.append("- Files replaced:")
        for rel in files_replaced:
            lines.append(f"  - `{rel}`")
    lines.extend(["", "## Publish Decision"])
    safe = not staging_errors and not preview_errors and all(item["returncode"] == 0 for item in validation_results)
    lines.append(f"Week 1 data safe to publish after explicit approval: {'YES' if safe else 'NO'}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Dry-run or guarded publish for staged Dynasty data.")
    parser.add_argument("--dry-run", action="store_true", help="Plan and preview publish without production changes.")
    parser.add_argument("--publish", action="store_true", help="Perform real publish after validation.")
    parser.add_argument("--staging-dir", default=str(DEFAULT_STAGING))
    parser.add_argument("--preview-dir", default=str(DEFAULT_PREVIEW))
    parser.add_argument("--backup-root", default=str(DEFAULT_BACKUP_ROOT))
    parser.add_argument("--report", default=str(DEFAULT_REPORT))
    parser.add_argument("--skip-validation-suite", action="store_true")
    args = parser.parse_args()

    if args.publish and args.dry_run:
        raise SystemExit("Choose either --dry-run or --publish, not both.")
    if not args.dry_run and not args.publish:
        raise SystemExit("Use --dry-run or --publish.")

    staging_dir = Path(args.staging_dir).resolve()
    preview_dir = Path(args.preview_dir).resolve()
    report = Path(args.report).resolve()
    backup_dir = Path(args.backup_root).resolve() / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    staging_errors = validate_staging(staging_dir)
    preview_objects: dict[str, Any] = {}
    preview_texts: dict[str, str] = {}
    warnings: list[str] = []
    preview_errors: list[str] = []
    if not staging_errors:
        preview_objects, preview_texts, warnings = build_preview(staging_dir)
        preview_errors = validate_preview(preview_objects, preview_texts)
        write_preview(preview_dir, preview_objects, preview_texts)

    files_replaced: list[str] = []
    production_changed = False
    rollback_status = "not_applicable" if args.dry_run else "not_needed"
    publish_error: str | None = None
    if args.publish and not staging_errors and not preview_errors:
        try:
            files_replaced = copy_preview_to_production(preview_dir, backup_dir)
            production_changed = True
        except Exception as exc:
            publish_error = str(exc)
            preview_errors.append(f"Publish failed before validation: {exc}")

    validation_results = [] if args.skip_validation_suite else run_validation_commands()
    validation_failed = any(item["returncode"] != 0 for item in validation_results)
    if args.publish and production_changed and validation_failed:
        restore_production_from_backup(backup_dir, files_replaced)
        production_changed = False
        rollback_status = "restored_after_validation_failure"
    elif args.publish and production_changed:
        rollback_status = "not_needed_validation_passed"

    scouting = preview_objects.get("data/generated/current_opponent_scouting_preview.json") if preview_objects else {}
    write_report(
        report,
        staging_dir,
        backup_dir,
        preview_dir,
        staging_errors,
        preview_errors,
        warnings,
        validation_results,
        scouting,
        dry_run=args.dry_run,
        production_changed=production_changed,
        files_replaced=files_replaced,
        rollback_status=rollback_status,
    )

    result = {
        "status": "PASS" if not staging_errors and not preview_errors and all(item["returncode"] == 0 for item in validation_results) else "FAIL",
        "dry_run": args.dry_run,
        "production_changed": False,
        "publish_error": publish_error,
        "staging_source": str(staging_dir),
        "preview_output": str(preview_dir),
        "backup": str(backup_dir),
        "report": str(report),
        "target_count": len(PRODUCTION_TARGETS),
        "files_replaced": files_replaced,
        "rollback_status": rollback_status,
        "preserved_manual_files": [str(path) for path in PRESERVED_TARGETS.values()],
        "staging_errors": staging_errors,
        "preview_errors": preview_errors,
        "warnings": warnings,
        "validation": [
            {
                "command": item["command"],
                "returncode": item["returncode"],
                "output_tail": item["output_tail"] if item["returncode"] != 0 else "",
            }
            for item in validation_results
        ],
    }
    result["production_changed"] = production_changed
    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())


