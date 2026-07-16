from __future__ import annotations

import argparse
import json
from pathlib import Path

from common import add_common_args, copy_save_to_snapshot, discover_save, load_config, resolve_parser_identity


def main() -> int:
    parser = argparse.ArgumentParser(description="Copy a CFB27 dynasty save into a read-only snapshot.")
    add_common_args(parser)
    args = parser.parse_args()
    config = load_config(Path(args.config))
    source = discover_save(args.save_name, Path(args.save_path) if args.save_path else None, Path(args.config))
    parser_identity = resolve_parser_identity(config)
    result = copy_save_to_snapshot(source, Path(args.output_root) / "snapshots", parser_identity)
    print(json.dumps({"status": "PASS", **result}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

