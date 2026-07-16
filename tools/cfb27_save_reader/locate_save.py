from __future__ import annotations

import argparse
import json
from pathlib import Path

from common import add_common_args, discover_save


def main() -> int:
    parser = argparse.ArgumentParser(description="Locate a CFB27 dynasty save without modifying it.")
    add_common_args(parser)
    args = parser.parse_args()
    found = discover_save(args.save_name, Path(args.save_path) if args.save_path else None, Path(args.config))
    print(json.dumps({"status": "PASS", "save_path": str(found)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

