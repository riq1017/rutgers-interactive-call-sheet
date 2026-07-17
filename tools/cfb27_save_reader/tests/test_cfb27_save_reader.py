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
import publish_dynasty


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

    def test_opponent_scouting_targets_umass_and_labels_alignment(self):
        rutgers_roster = {
            "players": [
                {"player_id": "r-lt", "name": "Rutgers LT", "position": "LT", "overall": 80, "attributes": {"run_block": 82, "pass_block": 81}},
                {"player_id": "r-lg", "name": "Rutgers LG", "position": "LG", "overall": 78, "attributes": {"run_block": 80}},
                {"player_id": "r-rt", "name": "Rutgers RT", "position": "RT", "overall": 70, "attributes": {"pass_block": 68}},
            ]
        }
        opponent_roster = {
            "team": {"team_id": 119, "name": "UMass"},
            "players": [
                {"player_id": "u-edge", "name": "UMass Edge", "position": "LE", "overall": 76, "attributes": {"speed": 82, "power_moves": 74}},
                {"player_id": "u-dt", "name": "UMass DT", "position": "DT", "overall": 73, "attributes": {"strength": 78}},
                {"player_id": "u-cb", "name": "UMass CB", "position": "CB", "overall": 70, "attributes": {"speed": 86}},
            ],
        }
        scouting = map_to_rutgers_app.generate_opponent_scouting(
            rutgers_roster,
            opponent_roster,
            {"metadata": {"opponent_count": 0}},
            {"current_week": 1, "upcoming_opponent": {"status": "Unplayed"}},
            {"opponent": [{"stats": {"wins": 0, "losses": 0}}]},
            {"metadata": {"confidence": "manual_static"}},
        )
        self.assertEqual(scouting["opponent"]["team_id"], 119)
        self.assertEqual(scouting["opponent"]["name"], "UMass")
        self.assertEqual(scouting["run_direction"]["alignment_status"], "position_group_based_not_alignment_verified")
        self.assertEqual(scouting["pass_protection"]["alignment_status"], "position_group_based_not_alignment_verified")

    def test_stale_opponent_validation_flags_payload_terms(self):
        matches = publish_dynasty.find_stale_terms(
            {"payload": {"opponent": "Purdue", "note": "current opponent package"}},
            ["Purdue", "Boilermakers"],
        )
        self.assertIn("payload", matches)
        cleaned = publish_dynasty.scrub_stale_terms({"opponent": "Purdue"}, ["Purdue"])
        self.assertNotIn("Purdue", json.dumps(cleaned))

    def test_manual_depth_chart_rejects_stale_player(self):
        seed = {
            "position_groups": [
                {
                    "position": "LT",
                    "players": [{"player_id": "old-lt", "name": "J. Elijah", "position": "LT"}],
                }
            ]
        }
        roster = {
            "players": [
                {"player_id": "101", "save_player_id": 101, "name": "Current Tackle", "position": "LT", "overall": 72}
            ]
        }
        mapped = map_to_rutgers_app.map_manual_depth_chart_from_seed(seed, 78, roster)
        self.assertEqual(mapped["metadata"]["rejected_count"], 1)
        self.assertEqual(mapped["metadata"]["validated_count"], 0)
        self.assertEqual(mapped["depth_chart"]["position_groups"][0]["players"], [])
        self.assertEqual(mapped["depth_chart"]["position_groups"][0]["status"], "unavailable_requires_manual_verification")

    def test_manual_depth_chart_keeps_current_compatible_player(self):
        seed = {
            "position_groups": [
                {
                    "position": "LT",
                    "players": [{"player_id": "101", "name": "Current Tackle", "position": "LT"}],
                }
            ]
        }
        roster = {
            "players": [
                {
                    "player_id": "101",
                    "save_player_id": 101,
                    "name": "Current Tackle",
                    "full_name": "Current Tackle",
                    "position": "LT",
                    "overall": 72,
                    "class_year": "JR",
                }
            ]
        }
        mapped = map_to_rutgers_app.map_manual_depth_chart_from_seed(seed, 78, roster)
        self.assertEqual(mapped["metadata"]["validated_count"], 1)
        self.assertEqual(mapped["metadata"]["rejected_count"], 0)
        retained = mapped["depth_chart"]["position_groups"][0]["players"][0]
        self.assertEqual(retained["save_player_id"], 101)
        self.assertEqual(retained["verification_status"], "manual_static_validated_against_current_roster")

    def test_week1_empty_stats_package_has_no_old_leaders(self):
        package = publish_dynasty.empty_week1_stats_package("Rutgers")
        self.assertEqual(package["games_played"], 0)
        self.assertEqual(package["passing"], [])
        self.assertEqual(package["rushing"], [])
        self.assertEqual(package["receiving"], [])
        self.assertNotIn("1305", json.dumps(package))
        self.assertNotIn("683", json.dumps(package))

    def test_stale_rutgers_validation_flags_previous_roster_terms(self):
        matches = publish_dynasty.find_stale_terms(
            {"payload": {"player": "J. Elijah", "note": "old depth slot"}},
            ["J. Elijah"],
        )
        self.assertIn("payload", matches)
        cleaned = publish_dynasty.scrub_stale_terms({"player": "J. Elijah"}, ["J. Elijah"])
        self.assertNotIn("J. Elijah", json.dumps(cleaned))


if __name__ == "__main__":
    unittest.main()
