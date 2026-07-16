from __future__ import annotations

import argparse
import json
from pathlib import Path

from common import (
    READER_SCHEMA_VERSION,
    add_common_args,
    atomic_write_json,
    atomic_write_text,
    build_empty_normalized,
    copy_save_to_snapshot,
    discover_save,
    inspect_container,
    load_config,
    validate_normalized_payload,
)
from parser_runtime import inspect_with_parser, resolve_runtime


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect a CFB27 dynasty save through a read-only snapshot.")
    add_common_args(parser)
    args = parser.parse_args()

    output_root = Path(args.output_root)
    config = load_config(Path(args.config))
    source = discover_save(args.save_name, Path(args.save_path) if args.save_path else None, Path(args.config))
    runtime = resolve_runtime(config)
    parser_identity = runtime.identity
    snapshot = copy_save_to_snapshot(source, output_root / "snapshots", parser_identity)
    snapshot_save = Path(snapshot["save_path"])

    container = inspect_container(snapshot_save)
    parser_result = inspect_with_parser(snapshot_save, runtime)
    source_ref = {
        "source_path": str(source),
        "snapshot_path": str(snapshot_save),
        "source_sha256": snapshot["manifest"]["source"]["sha256"],
        "snapshot_sha256": snapshot["manifest"]["copied"]["sha256"],
        "container": container,
    }
    normalized = build_empty_normalized(source_ref, parser_identity, parser_result["status"])
    normalized["validation_errors"] = validate_normalized_payload(normalized)

    raw_dir = output_root / "raw"
    inspection_dir = output_root / "inspection"
    normalized_dir = output_root / "normalized"
    atomic_write_json(inspection_dir / "latest_manifest.json", snapshot["manifest"])
    atomic_write_json(inspection_dir / "container_observations.json", {"schema_version": READER_SCHEMA_VERSION, **container})
    atomic_write_json(inspection_dir / "parser_diagnostics.json", parser_result)
    if parser_result.get("raw") is not None:
        atomic_write_json(raw_dir / "parser_inspect.json", {"schema_version": READER_SCHEMA_VERSION, "raw": parser_result["raw"]})
    atomic_write_json(normalized_dir / "dynasty_normalized.latest.json", normalized)

    report = [
        "# CFB27 Save Inspection Report",
        "",
        f"Source save: `{source}`",
        f"Snapshot: `{snapshot_save}`",
        f"Container signature: `{container['signature']}`",
        f"Zlib offset: `{container['zlib_offset']}`",
        f"Parser status: `{parser_result['status']}`",
        "",
        "No production JSON was modified by this inspection.",
    ]
    atomic_write_text(inspection_dir / "inspection_report.md", "\n".join(report) + "\n")
    print(json.dumps({"status": "PASS", "snapshot": snapshot["snapshot_dir"], "parser_status": parser_result["status"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
