from __future__ import annotations

import argparse
import json
from copy import deepcopy
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


def normalize_player_name(name: Any) -> str:
    text = str(name or "").lower().strip()
    text = "".join(char if char.isalnum() or char.isspace() else " " for char in text)
    return " ".join(text.split())


def depth_slot_position_compatible(slot: Any, player_position: Any) -> bool:
    slot_text = str(slot or "").upper().strip()
    position = str(player_position or "").upper().strip()
    if not slot_text or not position:
        return False
    groups = {
        "QB": {"QB"},
        "HB": {"HB", "RB", "FB"},
        "RB": {"HB", "RB", "FB"},
        "WR": {"WR"},
        "TE": {"TE"},
        "LT": {"LT"},
        "LG": {"LG"},
        "C": {"C"},
        "RG": {"RG"},
        "RT": {"RT"},
        "EDGE": {"EDGE", "DE", "LE", "RE", "LEDG", "REDG", "LOLB", "ROLB"},
        "DE": {"EDGE", "DE", "LE", "RE", "LEDG", "REDG"},
        "DT": {"DT", "NT", "LDT", "RDT"},
        "OLB": {"OLB", "LOLB", "ROLB", "SAM", "WLB"},
        "MIKE": {"MLB", "MIKE", "ILB", "LB"},
        "MLB": {"MLB", "MIKE", "ILB", "LB"},
        "LB": {"MLB", "MIKE", "ILB", "LB", "OLB", "LOLB", "ROLB", "SAM", "WLB"},
        "CB": {"CB"},
        "FS": {"FS", "S"},
        "SS": {"SS", "S"},
        "S": {"FS", "SS", "S"},
        "K": {"K"},
        "P": {"P"},
    }
    allowed = groups.get(slot_text, {slot_text})
    return position in allowed


def build_roster_identity_indexes(players: Iterable[Dict[str, Any]]) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, List[Dict[str, Any]]]]:
    by_id: Dict[str, Dict[str, Any]] = {}
    by_name: Dict[str, List[Dict[str, Any]]] = {}
    for player in players:
        for key in (player.get("player_id"), player.get("save_player_id")):
            if key is not None:
                by_id[str(key)] = player
        for key in (player.get("name"), player.get("full_name")):
            normalized = normalize_player_name(key)
            if normalized:
                by_name.setdefault(normalized, []).append(player)
    return by_id, by_name


def resolve_depth_player(player: Dict[str, Any], slot: str, by_id: Dict[str, Dict[str, Any]], by_name: Dict[str, List[Dict[str, Any]]]) -> Tuple[Optional[Dict[str, Any]], str]:
    raw_id = player.get("save_player_id") or player.get("player_id")
    if raw_id is not None and str(raw_id) in by_id:
        candidate = by_id[str(raw_id)]
        if depth_slot_position_compatible(slot, candidate.get("position")):
            return candidate, "matched_current_roster_by_player_id"
        return None, f"player_id_matched_but_position_{candidate.get('position')}_incompatible_with_{slot}"

    normalized = normalize_player_name(player.get("full_name") or player.get("name"))
    candidates = by_name.get(normalized, [])
    compatible = [candidate for candidate in candidates if depth_slot_position_compatible(slot, candidate.get("position"))]
    if len(compatible) == 1:
        return compatible[0], "matched_current_roster_by_name_and_position"
    if candidates and not compatible:
        return None, f"name_matched_but_no_current_position_compatible_with_{slot}"
    if len(compatible) > 1:
        return None, "ambiguous_name_match_requires_manual_verification"
    return None, "not_present_in_current_85_player_roster"


def sanitize_manual_depth_chart(seed: Dict[str, Any], rutgers_roster: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]]]:
    sanitized = deepcopy(seed)
    validated: List[Dict[str, Any]] = []
    rejected: List[Dict[str, Any]] = []
    by_id, by_name = build_roster_identity_indexes(rutgers_roster.get("players") or [])

    for group in sanitized.get("position_groups") or []:
        slot = str(group.get("position") or "").upper()
        retained = []
        for entry in group.get("players") or []:
            resolved, status = resolve_depth_player(entry, slot, by_id, by_name)
            if resolved:
                updated = deepcopy(entry)
                updated.update(
                    {
                        "player_id": str(resolved.get("player_id")),
                        "save_player_id": resolved.get("save_player_id"),
                        "name": resolved.get("name"),
                        "full_name": resolved.get("full_name"),
                        "position": resolved.get("position"),
                        "overall": resolved.get("overall"),
                        "class_year": resolved.get("class_year"),
                        "verification_status": "manual_static_validated_against_current_roster",
                        "validation_match": status,
                    }
                )
                retained.append(updated)
                validated.append(
                    {
                        "slot": slot,
                        "player_id": updated.get("player_id"),
                        "name": updated.get("name"),
                        "position": updated.get("position"),
                        "match": status,
                    }
                )
            else:
                rejected.append(
                    {
                        "slot": slot,
                        "player_id": entry.get("player_id"),
                        "name": entry.get("name"),
                        "position": entry.get("position"),
                        "reason": status,
                    }
                )
        group["players"] = retained
        if not retained and slot:
            group["status"] = "unavailable_requires_manual_verification"

    sanitized["status"] = "manual_depth_chart_validated_against_current_roster"
    sanitized["validation"] = {
        "current_roster_player_count": len(rutgers_roster.get("players") or []),
        "validated_entries": len(validated),
        "rejected_entries": len(rejected),
        "rule": "Only manual entries resolving to the current parser-derived Rutgers roster are retained.",
    }
    return sanitized, validated, rejected


def map_manual_depth_chart(depth_seed_path: Path, rutgers_id: int, rutgers_roster: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    seed = load_json(depth_seed_path, {})
    return map_manual_depth_chart_from_seed(seed, rutgers_id, rutgers_roster)


def map_manual_depth_chart_from_seed(seed: Dict[str, Any], rutgers_id: int, rutgers_roster: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    sanitized = seed
    validated: List[Dict[str, Any]] = []
    rejected: List[Dict[str, Any]] = []
    if rutgers_roster is not None:
        sanitized, validated, rejected = sanitize_manual_depth_chart(seed, rutgers_roster)
    return {
        "schema_version": "cfb27_staging_depth_chart_v1",
        "package_type": "depth_chart_from_save",
        "source_of_truth": "manual_static_existing_app_seed",
        "team_id": rutgers_id,
        "depth_chart": sanitized,
        "metadata": {
            "parser_depth_chart_status": "unavailable_for_rutgers_team_78",
            "source": "data/depth_chart_seed.json",
            "confidence": "manual_static",
            "validation_status": "validated_against_current_roster" if rutgers_roster is not None else "not_validated",
            "validated_entries": validated,
            "rejected_entries": rejected,
            "validated_count": len(validated),
            "rejected_count": len(rejected),
            "rule": "Parser-derived Rutgers depth chart is unavailable; only manual entries that resolve to the current 85-player Rutgers roster are retained.",
        },
    }


DEFENSIVE_FRONT_POSITIONS = {"LE", "RE", "LEDG", "REDG", "EDGE", "DE", "DT", "LDT", "RDT", "NT"}
LINEBACKER_POSITIONS = {"MLB", "ROLB", "LOLB", "OLB", "SAM", "WLB", "ILB", "LB"}
SECONDARY_POSITIONS = {"CB", "FS", "SS", "DB", "S"}
OFFENSIVE_LINE_POSITIONS = {"LT", "LG", "C", "RG", "RT"}
LEFT_BLOCK_POSITIONS = {"LT", "LG"}
RIGHT_BLOCK_POSITIONS = {"RG", "RT"}


def average_rating(players: Iterable[Dict[str, Any]], *keys: str) -> Optional[float]:
    values: List[float] = []
    for player in players:
        attrs = player.get("attributes") or {}
        for key in keys:
            value = player.get(key)
            if value is None:
                value = attrs.get(key)
            if isinstance(value, (int, float)):
                values.append(float(value))
                break
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def top_players(players: Iterable[Dict[str, Any]], rating_key: str = "overall", limit: int = 3) -> List[Dict[str, Any]]:
    ranked = sorted(
        [player for player in players if isinstance(player.get(rating_key), (int, float))],
        key=lambda item: item.get(rating_key) or 0,
        reverse=True,
    )
    return [
        {
            "player_id": player.get("player_id"),
            "name": player.get("name"),
            "position": player.get("position"),
            "overall": player.get("overall"),
            "rating_used": rating_key,
            "rating_value": player.get(rating_key),
        }
        for player in ranked[:limit]
    ]


def players_by_position(players: Iterable[Dict[str, Any]], positions: set[str]) -> List[Dict[str, Any]]:
    return [player for player in players if str(player.get("position") or "").upper() in positions]


def group_summary(label: str, players: List[Dict[str, Any]], metrics: List[str]) -> Dict[str, Any]:
    return {
        "label": label,
        "player_count": len(players),
        "average_overall": average_rating(players, "overall"),
        "metrics": {metric: average_rating(players, metric) for metric in metrics},
        "top_players": top_players(players, "overall", 3),
        "provenance": "calculated_from_save_derived_roster_ratings",
    }


def choose_run_direction(rutgers_players: List[Dict[str, Any]], opponent_front: List[Dict[str, Any]]) -> Dict[str, Any]:
    left_blockers = players_by_position(rutgers_players, LEFT_BLOCK_POSITIONS)
    right_blockers = players_by_position(rutgers_players, RIGHT_BLOCK_POSITIONS)
    interior_blockers = players_by_position(rutgers_players, {"LG", "C", "RG"})
    left_score = average_rating(left_blockers, "run_block", "strength", "overall")
    right_score = average_rating(right_blockers, "run_block", "strength", "overall")
    interior_score = average_rating(interior_blockers, "run_block", "strength", "overall")
    opponent_interior = players_by_position(opponent_front, {"DT", "LDT", "RDT", "NT"})
    strongest_dt = top_players(opponent_interior, "overall", 1)

    scores = {
        "left": left_score,
        "right": right_score,
        "interior": interior_score,
    }
    available = {key: value for key, value in scores.items() if value is not None}
    direction = max(available, key=available.get) if available else "unavailable"
    reason = (
        f"Rutgers {direction} blocking group has the best available run-block/strength/overall blend."
        if direction != "unavailable"
        else "Run direction is unavailable because blocking ratings were not exported."
    )
    if strongest_dt:
        reason += f" Avoid repeatedly challenging {strongest_dt[0]['name']} inside without constraint help."
    return {
        "primary_run_direction": direction,
        "alignment_status": "position_group_based_not_alignment_verified",
        "scores": scores,
        "opponent_strongest_defensive_tackle": strongest_dt[0] if strongest_dt else None,
        "reason": reason,
        "provenance": ["calculated_from_save_derived_ratings", "manual_static_depth_chart_context"],
    }


def choose_pass_protection(rutgers_players: List[Dict[str, Any]], opponent_front: List[Dict[str, Any]]) -> Dict[str, Any]:
    tackles = players_by_position(rutgers_players, {"LT", "RT"})
    interior = players_by_position(rutgers_players, {"LG", "C", "RG"})
    edges = players_by_position(opponent_front, {"LE", "RE", "LEDG", "REDG", "EDGE", "DE"})
    tackles_score = average_rating(tackles, "pass_block", "pass_block_power", "pass_block_finesse", "overall")
    interior_score = average_rating(interior, "pass_block", "pass_block_power", "pass_block_finesse", "overall")
    edge_threats = sorted(
        edges,
        key=lambda player: max(
            [
                value
                for value in [
                    player.get("overall"),
                    (player.get("attributes") or {}).get("power_moves"),
                    (player.get("attributes") or {}).get("finesse_moves"),
                    (player.get("attributes") or {}).get("speed"),
                    (player.get("attributes") or {}).get("acceleration"),
                ]
                if isinstance(value, (int, float))
            ]
            or [0]
        ),
        reverse=True,
    )
    top_edge = edge_threats[0] if edge_threats else None
    direction = "edge-aware / identify pre-snap" if top_edge else "balanced"
    reason = (
        f"Top UMass edge threat is {top_edge.get('name')} ({top_edge.get('position')}, {top_edge.get('overall')} OVR). "
        "Exact left/right alignment is not parser-verified, so slide/chip calls should key the identified edge threat pre-snap."
        if top_edge
        else "No exported UMass edge threat was strong enough to create a directional protection call."
    )
    return {
        "primary_protection_call": direction,
        "alignment_status": "position_group_based_not_alignment_verified",
        "rutgers_tackle_pass_block_score": tackles_score,
        "rutgers_interior_pass_block_score": interior_score,
        "top_edge_threat": {
            "player_id": top_edge.get("player_id"),
            "name": top_edge.get("name"),
            "position": top_edge.get("position"),
            "overall": top_edge.get("overall"),
            "attributes": top_edge.get("attributes"),
        }
        if top_edge
        else None,
        "reason": reason,
        "provenance": ["calculated_from_save_derived_ratings", "manual_static_depth_chart_context"],
    }


def generate_opponent_scouting(
    rutgers_roster: Dict[str, Any],
    opponent_roster: Dict[str, Any],
    injuries: Dict[str, Any],
    schedule: Dict[str, Any],
    team_stats: Dict[str, Any],
    depth_chart: Dict[str, Any],
) -> Dict[str, Any]:
    rutgers_players = rutgers_roster.get("players") or []
    opponent_players = opponent_roster.get("players") or []
    opponent_team = opponent_roster.get("team") or {}
    opponent_front = players_by_position(opponent_players, DEFENSIVE_FRONT_POSITIONS)
    opponent_lbs = players_by_position(opponent_players, LINEBACKER_POSITIONS)
    opponent_secondary = players_by_position(opponent_players, SECONDARY_POSITIONS)
    rutgers_ol = players_by_position(rutgers_players, OFFENSIVE_LINE_POSITIONS)
    run_direction = choose_run_direction(rutgers_players, opponent_front)
    protection = choose_pass_protection(rutgers_players, opponent_front)
    front_summary = group_summary(
        "Defensive front",
        opponent_front,
        ["strength", "block_shedding", "power_moves", "finesse_moves", "pursuit", "play_recognition", "awareness"],
    )
    lb_summary = group_summary("Linebackers", opponent_lbs, ["speed", "acceleration", "pursuit", "play_recognition", "tackle"])
    secondary_summary = group_summary("Secondary", opponent_secondary, ["speed", "acceleration", "man_coverage", "zone_coverage", "press"])
    rutgers_ol_summary = group_summary("Rutgers offensive line", rutgers_ol, ["run_block", "pass_block", "strength", "awareness"])
    top_front = front_summary["top_players"]
    strengths = []
    weaknesses = []
    if top_front:
        strengths.append(f"Highest-rated front defender: {top_front[0]['name']} ({top_front[0]['position']}, {top_front[0]['overall']} OVR).")
    if front_summary["average_overall"] is not None and rutgers_ol_summary["average_overall"] is not None:
        if rutgers_ol_summary["average_overall"] >= front_summary["average_overall"]:
            weaknesses.append("Rutgers offensive-line average overall is favorable against the exported UMass defensive-front group.")
        else:
            strengths.append("UMass defensive-front average overall is higher than the Rutgers offensive-line group.")

    return {
        "schema_version": "cfb27_opponent_scouting_v1",
        "package_type": "opponent_scouting_from_save",
        "source_of_truth": "cfb27_dynasty_save_parser_staging",
        "current_week": schedule.get("current_week"),
        "opponent": {
            "team_id": opponent_team.get("team_id"),
            "name": opponent_team.get("name"),
            "record": (team_stats.get("opponent") or [{}])[0].get("stats", {}),
            "game_status": (schedule.get("upcoming_opponent") or {}).get("status"),
            "roster_count": len(opponent_players),
            "injury_count": injuries.get("metadata", {}).get("opponent_count"),
        },
        "provenance": {
            "save_derived": ["opponent identity", "opponent roster", "opponent injuries", "team statistics", "ratings"],
            "calculated": ["position-group scouting", "run direction", "pass protection", "concept guidance"],
            "manual_static": ["Rutgers depth-chart context"],
            "unavailable": ["verified UMass left/right defensive alignment", "individual player season stats before Week 1 is played"],
        },
        "position_group_scouting": {
            "opponent_defensive_front": front_summary,
            "opponent_linebackers": lb_summary,
            "opponent_secondary": secondary_summary,
            "rutgers_offensive_line": rutgers_ol_summary,
        },
        "strengths": strengths or ["No dominant UMass position-group edge was calculable from exported ratings."],
        "weaknesses": weaknesses or ["No clear UMass weakness was calculable from exported ratings."],
        "run_direction": run_direction,
        "pass_protection": protection,
        "concepts_to_increase": [
            "Use the primary run direction when down-and-distance allows.",
            "Use quick game, RPO, and movement answers if edge pressure becomes disruptive.",
        ],
        "concepts_to_avoid": [
            "Avoid claiming a left/right UMass front alignment until verified.",
            "Avoid repeated calls into the opponent's strongest exported front defender without constraint or double-team help.",
        ],
        "matchup_explanations": [
            run_direction["reason"],
            protection["reason"],
        ],
        "personnel_recommendations": [
            "Use preserved Rutgers manual depth-chart context for offensive-line grouping until parser-derived depth chart is verified.",
            "Treat UMass defensive alignment as position-group based, not side-verified.",
        ],
        "game_plan_recommendations": [
            f"Prepare for {opponent_team.get('name')} using current save-derived roster and injury data.",
            "Let early drives confirm actual defensive alignment before making hard left/right protection rules.",
        ],
        "play_call_recommendations": [
            "Prefer calls that can adjust after identifying front strength pre-snap.",
            "Keep fast answers available because pass-rush side alignment is not verified.",
        ],
        "top_play_recommendations": [
            "Top-play ranking should use the regenerated opponent scouting fields and existing 192-play eligibility rules.",
        ],
        "validation": {
            "stale_previous_opponent_check": "pending_publish_validation",
            "alignment_verified": False,
        },
        "depth_chart_source": depth_chart.get("metadata", {}).get("confidence"),
    }


def validate_staging_outputs(
    normalized: Dict[str, Any],
    rutgers_roster: Dict[str, Any],
    opponent_roster: Dict[str, Any],
    injuries: Dict[str, Any],
    schedule: Dict[str, Any],
    team_stats: Dict[str, Any],
    depth_chart: Dict[str, Any],
    scouting: Dict[str, Any],
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
    depth_metadata = depth_chart.get("metadata") or {}
    if depth_metadata.get("validation_status") != "validated_against_current_roster":
        errors.append("Manual depth chart was not validated against the current parsed Rutgers roster.")
    inspected_depth_entries = int(depth_metadata.get("validated_count") or 0) + int(depth_metadata.get("rejected_count") or 0)
    if inspected_depth_entries == 0:
        errors.append("Manual depth chart validation did not inspect any player entries.")
    for rejected in depth_metadata.get("rejected_entries") or []:
        if not rejected.get("reason"):
            errors.append(f"Rejected manual depth-chart entry has no reason: {rejected}")
    if scouting.get("opponent", {}).get("team_id") != 119:
        errors.append("Opponent scouting did not select UMass team ID 119.")
    if scouting.get("opponent", {}).get("name") != "UMass":
        errors.append("Opponent scouting did not select UMass.")
    if scouting.get("run_direction", {}).get("alignment_status") != "position_group_based_not_alignment_verified":
        errors.append("Run-direction scouting is not properly labeled as position-group based.")
    if scouting.get("pass_protection", {}).get("alignment_status") != "position_group_based_not_alignment_verified":
        errors.append("Pass-protection scouting is not properly labeled as position-group based.")
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
        f"- Manual depth-chart entries validated: {payload['manual_depth_chart_validated']}",
        f"- Manual depth-chart entries rejected: {payload['manual_depth_chart_rejected']}",
        "",
        "## Populated Fields",
        "",
    ]
    lines.extend(f"- {item}" for item in payload["populated_fields"])
    lines.extend(["", "## Still Unavailable", ""])
    lines.extend(f"- {item}" for item in payload["unavailable_fields"])
    if payload.get("manual_depth_chart_rejected_entries"):
        lines.extend(["", "## Manual Depth-Chart Rejections", ""])
        for item in payload["manual_depth_chart_rejected_entries"]:
            lines.append(f"- {item.get('slot')}: {item.get('name')} ({item.get('position')}) - {item.get('reason')}")
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
    depth_chart = map_manual_depth_chart(Path(args.depth_seed), rutgers_id, rutgers_roster)
    scouting = generate_opponent_scouting(rutgers_roster, opponent_roster, injuries, schedule, team_stats, depth_chart)

    validation_errors = validate_staging_outputs(normalized, rutgers_roster, opponent_roster, injuries, schedule, team_stats, depth_chart, scouting)
    status = "PASS" if not validation_errors else "FAIL"

    staging_dir.mkdir(parents=True, exist_ok=True)
    outputs = {
        "rutgers_roster_from_save.json": rutgers_roster,
        "opponent_roster_from_save.json": opponent_roster,
        "injuries_from_save.json": injuries,
        "schedule_week_from_save.json": schedule,
        "team_stats_from_save.json": team_stats,
        "depth_chart_from_save.json": depth_chart,
        "opponent_scouting_from_save.json": scouting,
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
            "opponent_scouting_packages": 1,
        },
        "player_stat_state": "Individual player season stat rows are absent or empty in the Week 1 unplayed export; this is not a parser failure.",
        "depth_chart_source": "manual_static_existing_app_seed",
        "manual_depth_chart_validation": {
            "validated_count": depth_chart.get("metadata", {}).get("validated_count", 0),
            "rejected_count": depth_chart.get("metadata", {}).get("rejected_count", 0),
            "validated_entries": depth_chart.get("metadata", {}).get("validated_entries", []),
            "rejected_entries": depth_chart.get("metadata", {}).get("rejected_entries", []),
        },
        "validation_errors": validation_errors,
        "staging_files": sorted(outputs),
    }
    atomic_write_json(staging_dir / "dynasty_status.json", metadata)

    report_payload = {
        "status": status,
        "counts": metadata["counts"],
        "player_stat_state": metadata["player_stat_state"],
        "depth_chart_source": metadata["depth_chart_source"],
        "manual_depth_chart_validated": metadata["manual_depth_chart_validation"]["validated_count"],
        "manual_depth_chart_rejected": metadata["manual_depth_chart_validation"]["rejected_count"],
        "manual_depth_chart_rejected_entries": metadata["manual_depth_chart_validation"]["rejected_entries"],
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
            "UMass opponent scouting package generated from save-derived roster, injuries, and team-stat staging data",
            "Run-direction and pass-protection recommendations calculated from available ratings with alignment limitations labeled",
        ],
        "unavailable_fields": [
            "Parser-derived Rutgers depth chart",
            "Individual player season-stat rows before any game has been played",
            "Verified UMass left/right defensive alignment",
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
