from __future__ import annotations

import json
import os
import sys
import tempfile
import time
import unittest
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import common


def fake_save(path: Path, payload: bytes = b"Rutgers") -> None:
    path.write_bytes(b"FBCHUNKS" + b"\x00" * 74 + zlib.compress(payload))


class Cfb27SaveReaderTests(unittest.TestCase):
    def test_explicit_save_path_wins(self):
        with tempfile.TemporaryDirectory() as temp:
            save = Path(temp) / "DYNASTY-TEST"
            fake_save(save)
            self.assertEqual(common.discover_save(save_path=save), save.resolve())

    def test_env_save_path_wins(self):
        with tempfile.TemporaryDirectory() as temp:
            save = Path(temp) / "DYNASTY-ENV"
            fake_save(save)
            old = os.environ.get("CFB27_DYNASTY_SAVE")
            os.environ["CFB27_DYNASTY_SAVE"] = str(save)
            try:
                self.assertEqual(common.discover_save(), save.resolve())
            finally:
                if old is None:
                    os.environ.pop("CFB27_DYNASTY_SAVE", None)
                else:
                    os.environ["CFB27_DYNASTY_SAVE"] = old

    def test_missing_named_save_raises(self):
        with tempfile.TemporaryDirectory() as temp:
            config = Path(temp) / "config.json"
            config.write_text(json.dumps({"save_directories": [str(Path(temp) / "missing")]}), encoding="utf-8")
            with self.assertRaises(common.SaveReaderError):
                common.discover_save("DOES-NOT-EXIST", config_path=config)

    def test_newest_exact_name_fallback(self):
        with tempfile.TemporaryDirectory() as temp:
            first_dir = Path(temp) / "a"
            second_dir = Path(temp) / "b"
            first_dir.mkdir()
            second_dir.mkdir()
            first = first_dir / "DYNASTY-RUTGERSAPP"
            second = second_dir / "DYNASTY-RUTGERSAPP"
            fake_save(first)
            time.sleep(0.01)
            fake_save(second)
            config = Path(temp) / "config.json"
            config.write_text(json.dumps({"save_directories": [str(first_dir), str(second_dir)]}), encoding="utf-8")
            self.assertEqual(common.discover_save(config_path=config), second.resolve())

    def test_copy_snapshot_hashes_match_and_source_unchanged(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "DYNASTY-SOURCE"
            fake_save(source)
            before = common.sha256_file(source)
            result = common.copy_save_to_snapshot(source, Path(temp) / "snapshots", common.ParserIdentity())
            self.assertEqual(before, common.sha256_file(source))
            self.assertEqual(result["manifest"]["source"]["sha256"], result["manifest"]["copied"]["sha256"])

    def test_same_file_rejection(self):
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "DYNASTY-SOURCE"
            fake_save(source)
            same_root = source.parent / f"{common.utc_now()}_{source.name}"
            same_root.mkdir()
            same_destination = same_root / source.name
            source.replace(same_destination)
            with self.assertRaises(common.SaveReaderError):
                common.copy_save_to_snapshot(same_destination, same_root.parent, common.ParserIdentity())

    def test_container_inspection(self):
        with tempfile.TemporaryDirectory() as temp:
            save = Path(temp) / "DYNASTY"
            fake_save(save, b"Scarlet Knights")
            info = common.inspect_container(save)
            self.assertEqual(info["signature"], "FBCHUNKS")
            self.assertEqual(info["zlib_offset"], 82)
            self.assertEqual(info["decompressed_size"], len(b"Scarlet Knights"))

    def test_parser_unavailable_is_non_mutating_status(self):
        with tempfile.TemporaryDirectory() as temp:
            save = Path(temp) / "DYNASTY"
            fake_save(save)
            result = common.run_parser_inspect(save, common.ParserIdentity())
            self.assertEqual(result["status"], "parser_unavailable")

    def test_invalid_rating_is_rejected(self):
        payload = {
            "teams": [],
            "players": [
                {
                    "player_id": {"value": "p1"},
                    "overall": {"value": 101},
                }
            ],
        }
        self.assertTrue(any("invalid overall" in error for error in common.validate_normalized_payload(payload)))

    def test_duplicate_player_id_is_rejected(self):
        payload = {
            "teams": [],
            "players": [
                {"player_id": {"value": "p1"}},
                {"player_id": {"value": "p1"}},
            ],
        }
        self.assertTrue(any("duplicate player_id" in error for error in common.validate_normalized_payload(payload)))

    def test_comparison_report_remains_experimental(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp) / "base"
            other = Path(temp) / "other"
            base.write_bytes(b"abc")
            other.write_bytes(b"axc")
            result = common.compare_save_bytes(base, other)
            self.assertEqual(result["decode_status"], "experimental")
            self.assertEqual(result["changed_byte_total"], 1)


if __name__ == "__main__":
    unittest.main()

