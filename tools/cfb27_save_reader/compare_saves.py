from __future__ import annotations

import argparse
import json
from pathlib import Path

from common import atomic_write_json, atomic_write_text, compare_save_bytes


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare two copied dynasty saves as experimental byte evidence only.")
    parser.add_argument("--base-save", required=True)
    parser.add_argument("--compare-save", required=True)
    parser.add_argument("--experiment-name", default="manual_comparison")
    parser.add_argument("--output-root", default="data/dynasty/inspection/experiments")
    args = parser.parse_args()

    result = compare_save_bytes(Path(args.base_save), Path(args.compare_save))
    out_dir = Path(args.output_root)
    json_path = out_dir / f"{args.experiment_name}.json"
    md_path = out_dir / f"{args.experiment_name}.md"
    atomic_write_json(json_path, result)
    atomic_write_text(
        md_path,
        "\n".join(
            [
                "# Dynasty Save Comparison Experiment",
                "",
                f"Base save: `{args.base_save}`",
                f"Compare save: `{args.compare_save}`",
                f"Changed byte total: `{result['changed_byte_total']}`",
                f"Changed ranges sampled: `{len(result['changed_ranges'])}`",
                "",
                "Status: experimental only. No app data was promoted.",
            ]
        )
        + "\n",
    )
    print(json.dumps({"status": "PASS", "report": str(json_path), "changed_byte_total": result["changed_byte_total"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

