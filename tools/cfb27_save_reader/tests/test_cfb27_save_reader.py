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
import parser_runtime
import map_to_rutgers_app


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

    def test_exact_named_save_wins_over_autosave(self):
        with tempfile.TemporaryDirectory() as temp:
            save_dir = Path(temp) / "saves"
            save_dir.mkdir()
            exact = save_dir / "DYNASTY-RUTGERSAPP"
            autosave = save_dir / "DYNASTY-RUTGERSAPP-AUTOSAVE"
            fake_save(autosave)
            time.sleep(0.01)
            fake_save(exact)
            config = Path(temp) / "config.json"
            config.write_text(json.dumps({"save_directories": [str(save_dir)]}), encoding="utf-8")
            result = common.discover_save_result("DYNASTY-RUTGERSAPP", config_path=config, allow_newest_dynasty_fallback=True)
            self.assertEqual(result.path, exact.resolve())
            self.assertTrue(result.exact_named_save)
            self.assertIsNone(result.warning)

    def test_newest_dynasty_fallback_warns_when_exact_missing(self):
        with tempfile.TemporaryDirectory() as temp:
            save_dir = Path(temp) / "saves"
            save_dir.mkdir()
            fallback = save_dir / "DYNASTY-OTHER"
            fake_save(fallback)
            config = Path(temp) / "config.json"
            config.write_text(json.dumps({"save_directories": [str(save_dir)]}), encoding="utf-8")
            result = common.discover_save_result("DYNASTY-NOT-PRESENT-FOR-TEST", config_path=config, allow_newest_dynasty_fallback=True)
            self.assertEqual(result.path, fallback.resolve())
            self.assertFalse(result.exact_named_save)
            self.assertIn("Named manual save DYNASTY-NOT-PRESENT-FOR-TEST was not found", result.warning or "")

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

    def test_invalid_nested_rating_is_rejected(self):
        payload = {
            "teams": [],
            "players": [
                {
                    "player_id": {"value": "p1"},
                    "overall": {"value": 88},
                    "ratings": {"speed": {"value": 120}},
                }
            ],
        }
        self.assertTrue(any("invalid rating speed" in error for error in common.validate_normalized_payload(payload)))

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

    def test_runtime_resolution_records_schema_package(self):
        with tempfile.TemporaryDirectory() as temp:
            exe = Path(temp) / "cfb-dynasty.exe"
            schema_dir = Path(temp) / "schemas"
            schema = schema_dir / "C27_468_2.gz"
            exe.write_bytes(b"parser")
            schema_dir.mkdir()
            schema.write_bytes(b"schema")
            runtime = parser_runtime.resolve_runtime(
                {
                    "parser_executable": str(exe),
                    "schema_dir": str(schema_dir),
                    "schema_path": str(schema),
                    "parser_pinned_commit": "abc123",
                    "schema_package": {"name": "madden-franchise", "version": "4.3.1", "license": "MIT"},
                }
            )
            self.assertEqual(runtime.identity.status, "configured")
            self.assertEqual(runtime.identity.schema_filename, "C27_468_2.gz")
            self.assertEqual(runtime.identity.package_name, "madden-franchise")

    def test_mapper_publish_is_disabled(self):
        normalized = {
            "validation_errors": [],
            "mvp_summary": {
                "current_team_id": 78,
                "rutgers_players_found": 1,
                "upcoming_opponent": {"name": "Purdue"},
            },
        }
        with self.assertRaises(common.SaveReaderError):
            map_to_rutgers_app.validate_ready_for_publish(normalized)


if __name__ == "__main__":
    unittest.main()
