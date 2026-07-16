from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from common import SaveReaderError, atomic_write_json, atomic_write_text, validate_rating


def load_normalized(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise SaveReaderError(f"Normalized dynasty file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def value_of(item: Any, default: Any = None) -> Any:
    if isinstance(item, dict) and "value" in item:
        return item.get("value")
    return item if item is not None else default


def source_of(item: Any) -> Optional[Dict[str, Any]]:
    if isinstance(item, dict) and "source" in item:
        return {
            "source": item.get("source"),
            "confidence": item.get("confidence"),
            "parser_version": item.get("parser_version"),
            "raw_reference": item.get("raw_reference"),
        }
    return None


RATING_LABELS = {
    "AccelerationRating": "acceleration",
    "AgilityRating": "agility",
    "AwarenessRating": "awareness",
    "BCVisionRating": "bc_vision",
    "BlockSheddingRating": "block_shedding",
    "BreakSackRating": "break_sack",
    "BreakTackleRating": "break_tackle",
    "CarryingRating": "carrying",
    "CatchInTrafficRating": "catch_in_traffic",
    "CatchingRating": "catching",
    "ChangeOfDirectionRating": "change_of_direction",
    "DeepRouteRunningRating": "deep_route_running",
    "FinesseMovesRating": "finesse_moves",
    "HitPowerRating": "hit_power",
    "ImpactBlockingRating": "impact_blocking",
    "InjuryRating": "injury",
    "JukeMoveRating": "juke_move",
    "JumpingRating": "jumping",
    "KickAccuracyRating": "kick_accuracy",
    "KickPowerRating": "kick_power",
    "KickReturnRating": "kick_return",
    "LeadBlockRating": "lead_block",
    "ManCoverageRating": "man_coverage",
    "MediumRouteRunningRating": "medium_route_running",
    "OverallRating": "overall",
    "PassBlockFinesseRating": "pass_block_finesse",
    "PassBlockPowerRating": "pass_block_power",
    "PassBlockRating": "pass_block",
    "PlayActionRating": "play_action",
    "PlayRecognitionRating": "play_recognition",
    "PowerMovesRating": "power_moves",
    "PressRating": "press",
    "PursuitRating": "pursuit",
    "ReleaseRating": "release",
    "RunBlockFinesseRating": "run_block_finesse",
    "RunBlockPowerRating": "run_block_power",
    "RunBlockRating": "run_block",
    "ShortRouteRunningRating": "short_route_running",
    "SpectacularCatchRating": "spectacular_catch",
    "SpeedRating": "speed",
    "SpinMoveRating": "spin_move",
    "StaminaRating": "stamina",
    "StiffArmRating": "stiff_arm",
    "StrengthRating": "strength",
    "TackleRating": "tackle",
    "ThrowAccuracyDeepRating": "throw_accuracy_deep",
    "ThrowAccuracyMidRating": "throw_accuracy_mid",
    "ThrowAccuracyShortRating": "throw_accuracy_short",
    "ThrowOnTheRunRating": "throw_on_the_run",
    "ThrowPowerRating": "throw_power",
    "ThrowUnderPressureRating": "throw_under_pressure",
    "ToughnessRating": "toughness",
    "TruckingRating": "trucking",
    "ZoneCoverageRating": "zone_coverage",
}


def compact_name(first: Any, last: Any) -> str:
    first_text = str(first or "").strip()
    last_text = str(last or "").strip()
    if first_text and last_text:
        return f"{first_text[0]}. {last_text}"
    return last_text or first_text or "N/A"


def full_name(first: Any, last: Any) -> str:
    text = " ".join(part for part in [str(first or "").strip(), str(last or "").strip()] if part)
    return text or "N/A"


def map_ratings(ratings: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    mapped: Dict[str, Any] = {}
    evidence: Dict[str, Any] = {}
    for raw_name, payload in sorted((ratings or {}).items()):
        value = value_of(payload)
        if value is None:
            continue
        if not validate_rating(value):
            continue
        key = RATING_LABELS.get(raw_name) or raw_name
        mapped[key] = value
        field_source = source_of(payload)
        if field_source:
            evidence[key] = field_source
    return mapped, evidence


def map_player(player: Dict[str, Any], team_label: str) -> Dict[str, Any]:
    player_id = value_of(player.get("player_id"))
    first = value_of(player.get("first_name"))
    last = value_of(player.get("last_name"))
    position = value_of(player.get("position"))
    overall = value_of(player.get("overall"))
    ratings, rating_evidence = map_ratings(player.get("ratings") or {})
    return {
        "player_id": str(player_id),
        "save_player_id": player_id,
        "name": compact_name(first, last),
        "full_name": full_name(first, last),
        "first_name": first,
        "last_name": last,
        "team": team_label,
        "team_id": value_of(player.get("team_id")),
        "position": position,
        "jersey": value_of(player.get("jersey")),
        "class_year": value_of(player.get("class")),
        "overall": overall,
        "height": value_of(player.get("height")),
        "weight": value_of(player.get("weight")),
        "archetype": value_of(player.get("archetype")),
        "development_trait": value_of(player.get("dev_trait")),
        "injury_status": value_of(player.get("injury_status")),
        "attributes": ratings,
        "source": {
            "type": "parser",
            "confidence": "probable",
            "team_scope": team_label,
            "field_evidence": {
                "player_id": source_of(player.get("player_id")),
                "first_name": source_of(player.get("first_name")),
                "last_name": source_of(player.get("last_name")),
                "position": source_of(player.get("position")),
                "jersey": source_of(player.get("jersey")),
                "class_year": source_of(player.get("class")),
                "overall": source_of(player.get("overall")),
                "attributes": rating_evidence,
            },
        },
    }


def map_roster(players: Iterable[Dict[str, Any]], team_label: str, team_id: int, team_name: str) -> Dict[str, Any]:
    mapped_players = [map_player(player, team_label) for player in players]
    return {
        "schema_version": "cfb27_staging_roster_v1",
        "package_type": f"{team_label}_roster_from_save",
        "source_of_truth": "cfb27_dynasty_save_parser_staging",
        "team": {
            "team_id": team_id,
            "name": team_name,
        },
        "players": mapped_players,
        "metadata": {
            "source": "cfb-dynasty parser normalized output",
            "confidence": "probable",
            "production_json_changed": False,
        },
    }


def raw_value(record: Dict[str, Any]) -> Any:
    return record.get("value") if isinstance(record, dict) and "value" in record else record


def filter_raw_records_by_team(raw_records: Iterable[Dict[str, Any]], team_id: int) -> List[Dict[str, Any]]:
    matches: List[Dict[str, Any]] = []
    for record in raw_records:
        if not isinstance(record, dict):
            continue
        candidates = [
            record.get("teamId"),
            record.get("TeamId"),
            record.get("teamID"),
            record.get("TeamIndex"),
            record.get("teamIndex"),
        ]
        if team_id in candidates:
            matches.append(record)
    return matches


def find_nested_team_records(raw: Any, team_id: int) -> List[Dict[str, Any]]:
    found: List[Dict[str, Any]] = []
    if isinstance(raw, list):
        for item in raw:
            found.extend(find_nested_team_records(item, team_id))
    elif isinstance(raw, dict):
        if team_id in [
            raw.get("teamId"),
            raw.get("TeamId"),
            raw.get("teamID"),
            raw.get("TeamIndex"),
            raw.get("teamIndex"),
        ]:
            found.append(raw)
        for value in raw.values():
            if isinstance(value, (dict, list)):
                found.extend(find_nested_team_records(value, team_id))
    return found


def map_injuries(normalized: Dict[str, Any], raw_export: Dict[str, Any], rutgers_id: int, opponent_id: int) -> Dict[str, Any]:
    rutgers = [raw_value(item) for item in normalized.get("injuries", [])]
    raw_injuries = raw_export.get("injuries") or []
    opponent = filter_raw_records_by_team(raw_injuries, opponent_id)
    if not opponent:
        opponent = find_nested_team_records(raw_injuries, opponent_id)
    return {
        "schema_version": "cfb27_staging_injuries_v1",
        "package_type": "injuries_from_save",
        "source_of_truth": "cfb27_dynasty_save_parser_staging",
        "rutgers": rutgers,
        "opponent": opponent,
        "metadata": {
            "rutgers_team_id": rutgers_id,
            "opponent_team_id": opponent_id,
            "rutgers_count": len(rutgers),
            "opponent_count": len(opponent),
            "confidence": "probable",
        },
    }


def map_schedule(normalized: Dict[str, Any], rutgers_id: int, opponent: Dict[str, Any]) -> Dict[str, Any]:
    games = [raw_value(item) for item in normalized.get("games", [])]
    return {
        "schema_version": "cfb27_staging_schedule_v1",
        "package_type": "schedule_week_from_save",
        "source_of_truth": "cfb27_dynasty_save_parser_staging",
        "current_week": 1,
        "current_team_id": rutgers_id,
        "upcoming_opponent": opponent,
        "games": games,
        "metadata": {
            "schedule_entries": len(games),
            "game_status": opponent.get("status"),
            "player_stats_expected": "empty_or_unavailable_until_games_are_played",
            "confidence": "probable",
        },
    }


def map_team_stats(normalized: Dict[str, Any]) -> Dict[str, Any]:
    rutgers_stats = [raw_value(item) for item in normalized.get("season_stats", [])]
    opponent_stats = [raw_value(item) for item in normalized.get("opponent_season_stats", [])]
    return {
        "schema_version": "cfb27_staging_team_stats_v1",
        "package_type": "team_stats_from_save",
        "source_of_truth": "cfb27_dynasty_save_parser_staging",
        "rutgers": rutgers_stats,
        "opponent": opponent_stats,
        "metadata": {
            "rutgers_team_stat_records": len(rutgers_stats),
            "opponent_team_stat_records": len(opponent_stats),
            "individual_player_stat_state": "not_exported_or_empty_for_unplayed_week_1",
            "confidence": "probable",
        },
    }


def map_manual_depth_chart(depth_seed_path: Path, rutgers_id: int) -> Dict[str, Any]:
    seed = load_json(depth_seed_path, {})
    return {
        "schema_version": "cfb27_staging_depth_chart_v1",
        "package_type": "depth_chart_from_save",
        "source_of_truth": "manual_static_existing_app_seed",
        "team_id": rutgers_id,
        "depth_chart": seed,
        "metadata": {
            "parser_depth_chart_status": "unavailable_for_rutgers_team_78",
            "source": "data/depth_chart_seed.json",
            "confidence": "manual_static",
            "rule": "Parser-derived Rutgers depth chart is unavailable; production/manual app depth chart is preserved in staging and not replaced.",
        },
    }


def validate_staging_outputs(
    normalized: Dict[str, Any],
    rutgers_roster: Dict[str, Any],
    opponent_roster: Dict[str, Any],
    injuries: Dict[str, Any],
    schedule: Dict[str, Any],
    team_stats: Dict[str, Any],
) -> List[str]:
    errors: List[str] = []
    summary = normalized.get("mvp_summary") or {}
    if value_of(summary.get("current_team_id"), summary.get("current_team_id")) != 78 and summary.get("current_team_id") != 78:
        errors.append("Rutgers stable team ID 78 was not found in normalized summary.")
    if len(rutgers_roster.get("players") or []) != 85:
        errors.append(f"Expected 85 Rutgers players, found {len(rutgers_roster.get('players') or [])}.")
    if len(opponent_roster.get("players") or []) != 85:
        errors.append(f"Expected 85 opponent players, found {len(opponent_roster.get('players') or [])}.")
    for label, roster in [("Rutgers", rutgers_roster), ("opponent", opponent_roster)]:
        ids = [player.get("save_player_id") for player in roster.get("players") or []]
        if len(ids) != len(set(ids)):
            errors.append(f"{label} roster contains duplicate player IDs.")
        for player in roster.get("players") or []:
            overall = player.get("overall")
            if overall is not None and not validate_rating(overall):
                errors.append(f"{label} player {player.get('name')} has invalid overall {overall}.")
            for rating_name, rating_value in (player.get("attributes") or {}).items():
                if rating_value is not None and not validate_rating(rating_value):
                    errors.append(f"{label} player {player.get('name')} has invalid rating {rating_name}={rating_value}.")
    if injuries.get("metadata", {}).get("rutgers_count") != 12:
        errors.append(f"Expected 12 Rutgers injury records, found {injuries.get('metadata', {}).get('rutgers_count')}.")
    if injuries.get("metadata", {}).get("opponent_count") != 10:
        errors.append(f"Expected 10 opponent injury records, found {injuries.get('metadata', {}).get('opponent_count')}.")
    if (schedule.get("upcoming_opponent") or {}).get("team_id") != 119:
        errors.append("Upcoming opponent team ID 119 was not mapped.")
    if len(schedule.get("games") or []) != 12:
        errors.append(f"Expected 12 Rutgers schedule entries, found {len(schedule.get('games') or [])}.")
    if team_stats.get("metadata", {}).get("rutgers_team_stat_records") != 1:
        errors.append("Expected exactly one Rutgers team-level stat record.")
    if team_stats.get("metadata", {}).get("opponent_team_stat_records") != 1:
        errors.append("Expected exactly one opponent team-level stat record.")
    if normalized.get("depth_charts"):
        errors.append("Unexpected parser-derived Rutgers depth chart records were present; verify before changing manual source policy.")
    return errors


def write_report(path: Path, payload: Dict[str, Any]) -> None:
    lines = [
        "# Week 1 Rutgers Staging Mapping Report",
        "",
        "This report is staging-only. Production Rutgers JSON and the approved UI were not changed.",
        "",
        f"- Status: {payload['status']}",
        f"- Rutgers players mapped: {payload['counts']['rutgers_players']}",
        f"- UMass players mapped: {payload['counts']['opponent_players']}",
        f"- Rutgers injuries mapped: {payload['counts']['rutgers_injuries']}",
        f"- UMass injuries mapped: {payload['counts']['opponent_injuries']}",
        f"- Schedule entries mapped: {payload['counts']['schedule_entries']}",
        f"- Rutgers team-stat records mapped: {payload['counts']['rutgers_team_stats']}",
        f"- UMass team-stat records mapped: {payload['counts']['opponent_team_stats']}",
        f"- Player-stat state: {payload['player_stat_state']}",
        f"- Depth-chart source: {payload['depth_chart_source']}",
        "",
        "## Populated Fields",
        "",
    ]
    lines.extend(f"- {item}" for item in payload["populated_fields"])
    lines.extend(["", "## Still Unavailable", ""])
    lines.extend(f"- {item}" for item in payload["unavailable_fields"])
    lines.extend(["", "## Validation", ""])
    if payload["validation_errors"]:
        lines.extend(f"- FAIL: {item}" for item in payload["validation_errors"])
    else:
        lines.append("- PASS: staging validation completed without errors.")
    lines.append("")
    atomic_write_text(path, "\n".join(lines))


def build_staging_package(args: argparse.Namespace) -> Dict[str, Any]:
    normalized_path = Path(args.normalized)
    raw_export_path = Path(args.raw_export)
    staging_dir = Path(args.staging_dir)
    normalized = load_normalized(normalized_path)
    raw_export = load_json(raw_export_path, {})
    summary = normalized.get("mvp_summary") or {}
    opponent = summary.get("upcoming_opponent") or {}
    rutgers_id = int(summary.get("current_team_id") or 78)
    opponent_id = int(opponent.get("team_id") or 119)

    rutgers_roster = map_roster(normalized.get("players") or [], "rutgers", rutgers_id, "Rutgers")
    opponent_roster = map_roster(normalized.get("opponent_players") or [], "opponent", opponent_id, opponent.get("name") or "UMass")
    injuries = map_injuries(normalized, raw_export, rutgers_id, opponent_id)
    schedule = map_schedule(normalized, rutgers_id, opponent)
    team_stats = map_team_stats(normalized)
    depth_chart = map_manual_depth_chart(Path(args.depth_seed), rutgers_id)

    validation_errors = validate_staging_outputs(normalized, rutgers_roster, opponent_roster, injuries, schedule, team_stats)
    status = "PASS" if not validation_errors else "FAIL"

    staging_dir.mkdir(parents=True, exist_ok=True)
    outputs = {
        "rutgers_roster_from_save.json": rutgers_roster,
        "opponent_roster_from_save.json": opponent_roster,
        "injuries_from_save.json": injuries,
        "schedule_week_from_save.json": schedule,
        "team_stats_from_save.json": team_stats,
        "depth_chart_from_save.json": depth_chart,
    }
    for filename, payload in outputs.items():
        atomic_write_json(staging_dir / filename, payload)

    metadata = {
        "schema_version": "cfb27_week1_staging_metadata_v1",
        "package_type": "dynasty_status",
        "source_of_truth": "cfb27_dynasty_save_parser_staging",
        "status": status,
        "production_json_changed": False,
        "ui_changed": False,
        "normalized_source": str(normalized_path),
        "raw_export_source": str(raw_export_path),
        "current_week": 1,
        "current_team": {"team_id": rutgers_id, "name": "Rutgers"},
        "upcoming_opponent": opponent,
        "counts": {
            "rutgers_players": len(rutgers_roster["players"]),
            "opponent_players": len(opponent_roster["players"]),
            "rutgers_injuries": injuries["metadata"]["rutgers_count"],
            "opponent_injuries": injuries["metadata"]["opponent_count"],
            "schedule_entries": len(schedule["games"]),
            "rutgers_team_stats": team_stats["metadata"]["rutgers_team_stat_records"],
            "opponent_team_stats": team_stats["metadata"]["opponent_team_stat_records"],
        },
        "player_stat_state": "Individual player season stat rows are absent or empty in the Week 1 unplayed export; this is not a parser failure.",
        "depth_chart_source": "manual_static_existing_app_seed",
        "validation_errors": validation_errors,
        "staging_files": sorted(outputs),
    }
    atomic_write_json(staging_dir / "dynasty_status.json", metadata)

    report_payload = {
        "status": status,
        "counts": metadata["counts"],
        "player_stat_state": metadata["player_stat_state"],
        "depth_chart_source": metadata["depth_chart_source"],
        "populated_fields": [
            "Current week",
            "Rutgers stable team ID",
            "Rutgers roster player IDs",
            "Rutgers names, positions, jerseys, classes, overalls, and exported ratings",
            "Rutgers injury records",
            "Upcoming opponent UMass and team ID",
            "UMass roster player IDs, names, positions, jerseys, classes, overalls, and exported ratings",
            "Rutgers schedule entries and unplayed Week 1 game status",
            "Rutgers and UMass team-level statistics records",
        ],
        "unavailable_fields": [
            "Parser-derived Rutgers depth chart",
            "Individual player season-stat rows before any game has been played",
            "Recruiting, awards, and national hub data in this MVP staging phase",
        ],
        "validation_errors": validation_errors,
    }
    write_report(Path(args.report), report_payload)
    return metadata


def validate_ready_for_publish(normalized: Dict[str, Any]) -> None:
    errors = normalized.get("validation_errors") or []
    if errors:
        raise SaveReaderError(f"Normalized data has validation errors: {errors}")
    summary = normalized.get("mvp_summary") or {}
    if not summary.get("current_team_id"):
        raise SaveReaderError("Missing stable Rutgers team ID.")
    if not summary.get("rutgers_players_found"):
        raise SaveReaderError("No Rutgers players found in normalized data.")
    if not summary.get("upcoming_opponent"):
        raise SaveReaderError("Missing upcoming opponent.")
    raise SaveReaderError("Publishing is disabled until three-save parser validation passes.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Staging-only Rutgers app mapper for validated CFB27 normalized data.")
    parser.add_argument("--normalized", default="data/dynasty/normalized/dynasty_normalized.latest.json")
    parser.add_argument("--raw-export", default="data/dynasty/raw/parser_mvp_export.json")
    parser.add_argument("--depth-seed", default="data/depth_chart_seed.json")
    parser.add_argument("--staging-dir", default="data/generated/dynasty/staging")
    parser.add_argument("--report", default="reports/cfb27_week1_staging_mapping_report.md")
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()

    try:
        normalized = load_normalized(Path(args.normalized))
        if args.publish:
            validate_ready_for_publish(normalized)
        metadata = build_staging_package(args)
        print(
            json.dumps(
                {
                    "status": metadata["status"],
                    "mode": "staging_only_no_production_publish",
                    "production_json_changed": False,
                    "staging_dir": args.staging_dir,
                    "report": args.report,
                    "counts": metadata["counts"],
                    "validation_errors": metadata["validation_errors"],
                },
                indent=2,
            )
        )
        return 0
    except SaveReaderError as exc:
        print(
            json.dumps(
                {
                    "status": "FAIL",
                    "reason": str(exc),
                    "production_json_changed": False,
                },
                indent=2,
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
