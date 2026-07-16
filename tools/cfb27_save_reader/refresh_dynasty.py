from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List

from common import (
    READER_SCHEMA_VERSION,
    SaveReaderError,
    add_common_args,
    atomic_write_json,
    atomic_write_text,
    copy_save_to_snapshot,
    discover_save_result,
    inspect_container,
    load_config,
)
from parser_runtime import export_mvp, inspect_with_parser, normalize_mvp_export, resolve_runtime, write_normalized


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def validation_report(normalized: Dict[str, Any], source: Path, snapshot: Path, publish_enabled: bool) -> str:
    summary = normalized.get("mvp_summary", {})
    opponent = summary.get("upcoming_opponent") or {}
    lines: List[str] = [
        "# CFB27 Parser Validation",
        "",
        "This report is staging-only. Production Rutgers app JSON is not modified until three-save validation passes.",
        "",
        f"Source save: `{source}`",
        f"Snapshot: `{snapshot}`",
        f"Publish enabled: `{publish_enabled}`",
        f"Status: `{normalized.get('status')}`",
        "",
        "## MVP Extraction",
        f"- Rutgers stable team ID: `{summary.get('current_team_id')}`",
        f"- Rutgers players found: `{summary.get('rutgers_players_found')}`",
        f"- Opponent players found: `{summary.get('opponent_players_found')}`",
        f"- Rutgers schedule entries found: `{summary.get('rutgers_schedule_entries_found')}`",
        f"- Rutgers stats records found: `{summary.get('rutgers_stats_records_found')}`",
        f"- Opponent stats records found: `{summary.get('opponent_stats_records_found')}`",
        f"- Rutgers injuries found: `{summary.get('rutgers_injuries_found')}`",
        f"- Rutgers depth-chart records found: `{summary.get('rutgers_depth_chart_records_found')}`",
        f"- Upcoming opponent: `{opponent.get('name')}`",
        f"- Upcoming opponent team ID: `{opponent.get('team_id')}`",
        "",
        "## Validation Errors",
    ]
    errors = normalized.get("validation_errors") or []
    if errors:
        lines.extend(f"- {error}" for error in errors)
    else:
        lines.append("- None")
    lines.extend(
        [
            "",
            "## Confidence",
            "- Parser output is `probable` until it is cross-checked against visible game values across three saved weeks.",
            "- Comparison-derived byte offsets remain experimental and are not promoted here.",
            "",
        ]
    )
    return "\n".join(lines)


def run_refresh(args: argparse.Namespace) -> Dict[str, Any]:
    output_root = Path(args.output_root)
    config = load_config(Path(args.config))
    discovery = discover_save_result(
        args.save_name,
        Path(args.save_path) if args.save_path else None,
        Path(args.config),
        allow_newest_dynasty_fallback=args.allow_fallback,
    )
    if discovery.warning and args.publish:
        raise SaveReaderError(f"{discovery.warning} Publishing requires an exact named save.")

    runtime = resolve_runtime(config)
    snapshot = copy_save_to_snapshot(discovery.path, output_root / "snapshots", runtime.identity)
    snapshot_save = Path(snapshot["save_path"])
    container = inspect_container(snapshot_save)

    inspection_dir = output_root / "inspection"
    raw_dir = output_root / "raw"
    normalized_dir = output_root / "normalized"

    parser_inspect = inspect_with_parser(snapshot_save, runtime)
    atomic_write_json(inspection_dir / "parser_diagnostics.json", parser_inspect)
    atomic_write_json(inspection_dir / "container_observations.json", {"schema_version": READER_SCHEMA_VERSION, **container})
    atomic_write_json(inspection_dir / "latest_manifest.json", snapshot["manifest"])
    if parser_inspect.get("status") != "parsed":
        raise SaveReaderError(f"Parser inspect failed: {parser_inspect.get('error')}")

    export_path = raw_dir / "parser_mvp_export.json"
    export_result = export_mvp(snapshot_save, export_path, runtime)
    atomic_write_json(inspection_dir / "parser_export_diagnostics.json", export_result)
    if export_result.get("status") != "exported":
        raise SaveReaderError(f"Parser export failed: {export_result.get('error')}")

    raw_export = load_json(export_path)
    source_ref = {
        "source_path": str(discovery.path),
        "snapshot_path": str(snapshot_save),
        "source_sha256": snapshot["manifest"]["source"]["sha256"],
        "snapshot_sha256": snapshot["manifest"]["copied"]["sha256"],
        "container": container,
    }
    normalized = normalize_mvp_export(raw_export, source_ref, runtime)
    normalized_path = normalized_dir / "dynasty_normalized.latest.json"
    write_normalized(normalized_path, normalized)
    atomic_write_text(inspection_dir / "cfb27_parser_validation.md", validation_report(normalized, discovery.path, snapshot_save, args.publish))

    if args.publish:
        raise SaveReaderError("Production publish is intentionally disabled until three-save validation passes.")

    summary = normalized.get("mvp_summary", {})
    return {
        "status": "PASS",
        "mode": "staging_only_no_production_publish",
        "source_save": str(discovery.path),
        "source_modified": snapshot["manifest"]["source"]["modified"],
        "fallback_warning": discovery.warning,
        "snapshot": str(snapshot_save),
        "parser_status": parser_inspect.get("status"),
        "export_status": export_result.get("status"),
        "normalized_output": str(normalized_path),
        "rutgers_team_id": summary.get("current_team_id"),
        "rutgers_players_found": summary.get("rutgers_players_found"),
        "opponent_players_found": summary.get("opponent_players_found"),
        "schedule_entries_found": summary.get("rutgers_schedule_entries_found"),
        "stats_records_found": summary.get("rutgers_stats_records_found"),
        "opponent_stats_records_found": summary.get("opponent_stats_records_found"),
        "injuries_found": summary.get("rutgers_injuries_found"),
        "depth_chart_records_found": summary.get("rutgers_depth_chart_records_found"),
        "upcoming_opponent": summary.get("upcoming_opponent"),
        "validation_errors": normalized.get("validation_errors", []),
        "production_json_changed": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a staging-only CFB27 dynasty refresh from a read-only save snapshot.")
    add_common_args(parser)
    parser.add_argument("--allow-fallback", action="store_true", help="Allow newest DYNASTY-* fallback for inspection only when the exact save name is missing.")
    parser.add_argument("--publish", action="store_true", help="Reserved for the future; currently always aborts before production JSON changes.")
    args = parser.parse_args()

    try:
        result = run_refresh(args)
        print(json.dumps(result, indent=2))
        return 0
    except SaveReaderError as exc:
        print(
            json.dumps(
                {
                    "status": "FAIL",
                    "reason": str(exc),
                    "source_save_was_modified": False,
                    "production_json_changed": False,
                },
                indent=2,
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
