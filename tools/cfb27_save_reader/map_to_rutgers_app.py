from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict

from common import SaveReaderError


def load_normalized(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise SaveReaderError(f"Normalized dynasty file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


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
    parser = argparse.ArgumentParser(description="Future Rutgers app mapper for validated CFB27 normalized data.")
    parser.add_argument("--normalized", default="data/dynasty/normalized/dynasty_normalized.latest.json")
    parser.add_argument("--publish", action="store_true")
    args = parser.parse_args()

    try:
        normalized = load_normalized(Path(args.normalized))
        if args.publish:
            validate_ready_for_publish(normalized)
        print(
            json.dumps(
                {
                    "status": "PASS",
                    "mode": "dry_run_mapper_framework",
                    "production_json_changed": False,
                    "summary": normalized.get("mvp_summary", {}),
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
