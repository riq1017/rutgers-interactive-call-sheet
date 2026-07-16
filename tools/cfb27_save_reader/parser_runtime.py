from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from common import (
    ParserIdentity,
    READER_SCHEMA_VERSION,
    SaveReaderError,
    atomic_write_json,
    build_empty_normalized,
    provenanced,
    repo_root,
    sha256_file,
    validate_normalized_payload,
)


@dataclass(frozen=True)
class ParserRuntime:
    identity: ParserIdentity
    schema_dir: Optional[Path]


def resolve_repo_path(path_text: Optional[str]) -> Optional[Path]:
    if not path_text:
        return None
    path = Path(path_text).expanduser()
    if not path.is_absolute():
        path = repo_root() / path
    return path.resolve()


def first_schema(schema_dir: Optional[Path]) -> Optional[Path]:
    if not schema_dir or not schema_dir.exists():
        return None
    cfb_schemas = sorted(schema_dir.glob("C27_*.gz"))
    if cfb_schemas:
        return cfb_schemas[0]
    schemas = sorted(schema_dir.glob("*.gz"))
    return schemas[0] if schemas else None


def resolve_runtime(config: Dict[str, Any]) -> ParserRuntime:
    exe = resolve_repo_path(os.environ.get("CFB27_DYNASTY_PARSER") or config.get("parser_executable"))
    schema_dir = resolve_repo_path(os.environ.get("CFB27_SCHEMA_DIR") or config.get("schema_dir"))
    schema_path = resolve_repo_path(config.get("schema_path")) or first_schema(schema_dir)
    package = config.get("schema_package", {}) if isinstance(config.get("schema_package"), dict) else {}

    identity = ParserIdentity(
        executable=str(exe) if exe else None,
        pinned_commit=config.get("parser_pinned_commit"),
        executable_sha256=sha256_file(exe) if exe and exe.exists() else None,
        schema_filename=schema_path.name if schema_path else None,
        schema_sha256=sha256_file(schema_path) if schema_path and schema_path.exists() else None,
        package_name=package.get("name"),
        package_version=package.get("version"),
        package_license=package.get("license"),
        status="configured" if exe and exe.exists() and schema_dir and schema_dir.exists() else "missing",
    )
    return ParserRuntime(identity=identity, schema_dir=schema_dir)


def parser_command(runtime: ParserRuntime, command_name: str) -> List[str]:
    if runtime.identity.status != "configured" or not runtime.identity.executable:
        raise SaveReaderError("Parser runtime is not configured. Install cfb-dynasty locally and configure schema_dir.")
    command = [runtime.identity.executable, command_name]
    if runtime.schema_dir:
        command.extend(["-schema-dir", str(runtime.schema_dir)])
    return command


def inspect_with_parser(snapshot_save: Path, runtime: ParserRuntime, timeout: int = 60) -> Dict[str, Any]:
    try:
        command = parser_command(runtime, "inspect") + ["-json", str(snapshot_save)]
    except SaveReaderError as exc:
        return {"status": "parser_unavailable", "error": str(exc), "raw": None}
    result = subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)
    if result.returncode != 0:
        return {"status": "parser_failed", "error": result.stderr.strip() or result.stdout.strip(), "command": command}
    try:
        raw = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        return {"status": "parser_failed", "error": f"Parser inspect did not return JSON: {exc}", "command": command}
    return {"status": "parsed", "raw": raw, "command": command}


def export_mvp(snapshot_save: Path, output_path: Path, runtime: ParserRuntime, timeout: int = 180) -> Dict[str, Any]:
    try:
        command = parser_command(runtime, "export")
    except SaveReaderError as exc:
        return {"status": "parser_unavailable", "error": str(exc), "raw_path": None}
    command.extend(["-season", "-teams", "-rosters", "-games", "-season-stats", "-injuries", "-depth-charts"])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    command.extend(["-o", str(output_path), str(snapshot_save)])
    result = subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)
    if result.returncode != 0:
        return {"status": "parser_failed", "error": result.stderr.strip() or result.stdout.strip(), "command": command, "raw_path": None}
    if not output_path.exists():
        return {"status": "parser_failed", "error": "Parser reported success but did not create export file.", "command": command, "raw_path": None}
    return {"status": "exported", "raw_path": str(output_path), "size": output_path.stat().st_size, "command": command}


def _source(snapshot_source: Dict[str, Any], raw_reference: str) -> Dict[str, Any]:
    return {"kind": "cfb-dynasty export", "raw_reference": raw_reference, **snapshot_source}


def normalize_mvp_export(export_payload: Dict[str, Any], snapshot_source: Dict[str, Any], runtime: ParserRuntime, current_team_name: str = "Rutgers") -> Dict[str, Any]:
    parser = runtime.identity
    normalized = build_empty_normalized(snapshot_source, parser, "probable_parser_export")

    teams = export_payload.get("teams", []) if isinstance(export_payload.get("teams"), list) else []
    rosters = export_payload.get("rosters", []) if isinstance(export_payload.get("rosters"), list) else []
    games = export_payload.get("games", []) if isinstance(export_payload.get("games"), list) else []
    season_stats = export_payload.get("seasonTeamStats", []) if isinstance(export_payload.get("seasonTeamStats"), list) else []
    injuries = export_payload.get("injuries", []) if isinstance(export_payload.get("injuries"), list) else []
    depth_charts = export_payload.get("depthCharts", []) if isinstance(export_payload.get("depthCharts"), list) else []

    if isinstance(export_payload.get("season"), dict):
        normalized["season"] = provenanced(export_payload["season"], _source(snapshot_source, "season"), parser, "season", "probable")

    current_team = next((team for team in teams if str(team.get("displayName", "")).lower() == current_team_name.lower()), None)
    current_team_id = current_team.get("id") if isinstance(current_team, dict) else None
    rutgers_games = [game for game in games if isinstance(game, dict) and (game.get("homeTeam") == current_team_name or game.get("awayTeam") == current_team_name)]
    upcoming = next((game for game in sorted(rutgers_games, key=lambda item: item.get("week", 999)) if game.get("status") != "Played"), None)
    upcoming_opponent = None
    opponent_team_id = None
    if upcoming:
        opponent_name = upcoming.get("awayTeam") if upcoming.get("homeTeam") == current_team_name else upcoming.get("homeTeam")
        opponent = next((team for team in teams if team.get("displayName") == opponent_name or team.get("longName") == opponent_name), None)
        opponent_team_id = opponent.get("id") if isinstance(opponent, dict) else None
        upcoming_opponent = {
            "name": opponent_name,
            "team_id": opponent_team_id,
            "week": upcoming.get("week"),
            "status": upcoming.get("status"),
        }

    def same_id(left: Any, right: Any) -> bool:
        return left is not None and right is not None and str(left) == str(right)

    for index, team in enumerate(teams):
        normalized["teams"].append(
            {
                "team_id": provenanced(team.get("id"), _source(snapshot_source, f"teams[{index}].id"), parser, f"teams[{index}].id", "probable"),
                "display_name": provenanced(team.get("displayName") or team.get("longName"), _source(snapshot_source, f"teams[{index}].displayName"), parser, f"teams[{index}].displayName", "probable"),
                "short_name": provenanced(team.get("shortName"), _source(snapshot_source, f"teams[{index}].shortName"), parser, f"teams[{index}].shortName", "probable"),
                "record": provenanced(
                    {
                        "wins": team.get("overallWins"),
                        "losses": team.get("overallLosses"),
                        "conference_wins": team.get("conferenceWins"),
                        "conference_losses": team.get("conferenceLosses"),
                    },
                    _source(snapshot_source, f"teams[{index}].record"),
                    parser,
                    f"teams[{index}].record",
                    "probable",
                ),
            }
        )

    for roster_index, roster in enumerate(rosters):
        if not isinstance(roster, dict):
            continue
        players = roster.get("players", []) if isinstance(roster.get("players"), list) else []
        team_id = roster.get("teamId")
        normalized["rosters"].append(
            {
                "team_id": provenanced(team_id, _source(snapshot_source, f"rosters[{roster_index}].teamId"), parser, f"rosters[{roster_index}].teamId", "probable"),
                "team_name": provenanced(roster.get("teamName"), _source(snapshot_source, f"rosters[{roster_index}].teamName"), parser, f"rosters[{roster_index}].teamName", "probable"),
                "player_count": provenanced(len(players), _source(snapshot_source, f"rosters[{roster_index}].players"), parser, f"rosters[{roster_index}].players", "probable"),
            }
        )
        player_bucket = None
        if same_id(team_id, current_team_id):
            player_bucket = normalized["players"]
        elif same_id(team_id, opponent_team_id):
            player_bucket = normalized["opponent_players"]
        if player_bucket is None:
            continue
        for player_index, player in enumerate(players):
            if not isinstance(player, dict):
                continue
            raw_ref = f"rosters[{roster_index}].players[{player_index}]"
            ratings = {
                key: provenanced(value, _source(snapshot_source, f"{raw_ref}.ratings.{key}"), parser, f"{raw_ref}.ratings.{key}", "probable")
                for key, value in (player.get("ratings") or {}).items()
            }
            player_bucket.append(
                {
                    "player_id": provenanced(player.get("id"), _source(snapshot_source, f"{raw_ref}.id"), parser, f"{raw_ref}.id", "probable"),
                    "team_id": provenanced(team_id, _source(snapshot_source, f"{raw_ref}.teamIndex"), parser, f"{raw_ref}.teamIndex", "probable"),
                    "first_name": provenanced(player.get("firstName"), _source(snapshot_source, f"{raw_ref}.firstName"), parser, f"{raw_ref}.firstName", "probable"),
                    "last_name": provenanced(player.get("lastName"), _source(snapshot_source, f"{raw_ref}.lastName"), parser, f"{raw_ref}.lastName", "probable"),
                    "position": provenanced(player.get("position"), _source(snapshot_source, f"{raw_ref}.position"), parser, f"{raw_ref}.position", "probable"),
                    "jersey": provenanced(player.get("jersey"), _source(snapshot_source, f"{raw_ref}.jersey"), parser, f"{raw_ref}.jersey", "probable"),
                    "class": provenanced(player.get("schoolYear"), _source(snapshot_source, f"{raw_ref}.schoolYear"), parser, f"{raw_ref}.schoolYear", "probable"),
                    "overall": provenanced(player.get("overall"), _source(snapshot_source, f"{raw_ref}.overall"), parser, f"{raw_ref}.overall", "probable"),
                    "height": provenanced(player.get("height"), _source(snapshot_source, f"{raw_ref}.height"), parser, f"{raw_ref}.height", "probable"),
                    "weight": provenanced(player.get("weight"), _source(snapshot_source, f"{raw_ref}.weight"), parser, f"{raw_ref}.weight", "probable"),
                    "archetype": provenanced(player.get("archetypeLabel") or player.get("archetype"), _source(snapshot_source, f"{raw_ref}.archetype"), parser, f"{raw_ref}.archetype", "probable"),
                    "dev_trait": provenanced(player.get("devTrait"), _source(snapshot_source, f"{raw_ref}.devTrait"), parser, f"{raw_ref}.devTrait", "probable"),
                    "injury_status": provenanced(player.get("injuryStatus"), _source(snapshot_source, f"{raw_ref}.injuryStatus"), parser, f"{raw_ref}.injuryStatus", "probable"),
                    "ratings": ratings,
                }
            )

    for index, game in enumerate(rutgers_games):
        normalized["games"].append(provenanced(game, _source(snapshot_source, f"games.rutgers[{index}]"), parser, f"games.rutgers[{index}]", "probable"))

    for index, stat in enumerate(season_stats):
        if not isinstance(stat, dict):
            continue
        if same_id(stat.get("teamId"), current_team_id) or stat.get("teamName") == current_team_name:
            normalized["season_stats"].append(provenanced(stat, _source(snapshot_source, f"seasonTeamStats[{index}]"), parser, f"seasonTeamStats[{index}]", "probable"))
        elif same_id(stat.get("teamId"), opponent_team_id):
            normalized["opponent_season_stats"].append(provenanced(stat, _source(snapshot_source, f"seasonTeamStats[{index}]"), parser, f"seasonTeamStats[{index}]", "probable"))
    for index, injury in enumerate(injuries):
        if isinstance(injury, dict) and (same_id(injury.get("teamId"), current_team_id) or injury.get("teamName") == current_team_name):
            normalized["injuries"].append(provenanced(injury, _source(snapshot_source, f"injuries[{index}]"), parser, f"injuries[{index}]", "probable"))
    for index, chart in enumerate(depth_charts):
        if isinstance(chart, dict) and (same_id(chart.get("teamId"), current_team_id) or chart.get("teamName") == current_team_name):
            normalized["depth_charts"].append(provenanced(chart, _source(snapshot_source, f"depthCharts[{index}]"), parser, f"depthCharts[{index}]", "probable"))

    normalized["mvp_summary"] = {
        "current_team_id": current_team_id,
        "current_team_name": current_team_name if current_team_id is not None else None,
        "teams_found": len(teams),
        "rutgers_players_found": len(normalized["players"]),
        "opponent_players_found": len(normalized["opponent_players"]),
        "rutgers_schedule_entries_found": len(rutgers_games),
        "rutgers_stats_records_found": len(normalized["season_stats"]),
        "opponent_stats_records_found": len(normalized["opponent_season_stats"]),
        "rutgers_injuries_found": len(normalized["injuries"]),
        "rutgers_depth_chart_records_found": len(normalized["depth_charts"]),
        "upcoming_opponent": upcoming_opponent,
    }
    normalized["validation_errors"] = validate_normalized_payload(normalized)
    return normalized


def write_normalized(path: Path, normalized: Dict[str, Any]) -> None:
    atomic_write_json(path, normalized)
