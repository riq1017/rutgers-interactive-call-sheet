import tempfile
import unittest
from pathlib import Path

import process_week

class VideoSourceTruthTests(unittest.TestCase):
    def test_filename_classification(self):
        self.assertEqual(process_week.classify_video_name("Purdue Roster.mp4")["package"], "opponent_roster")
        self.assertEqual(process_week.classify_video_name("Rutgers Season stats.mp4")["package"], "current_team_season_stats")
        self.assertEqual(process_week.classify_video_name("Oregon PLaybook.mp4")["package"], "playbook")

    def test_discover_videos(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in ["a.mp4", "b.webm", "c.txt", "d.mkv", "e.mov"]:
                (root / name).write_bytes(b"x")
            self.assertEqual([p.name for p in process_week.discover_videos(root)], ["a.mp4", "b.webm", "d.mkv", "e.mov"])

    def test_ffmpeg_resolver(self):
        pair = process_week.resolve_ffmpeg(process_week.root())
        self.assertIn("ffmpeg", pair)
        self.assertIn("ffprobe", pair)

    def test_frame_signature_is_deterministic(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "frame.jpg"
            path.write_bytes(b"abc" * 5000)
            self.assertEqual(process_week.frame_signature(path), process_week.frame_signature(path))

    def test_required_outputs(self):
        self.assertIn("video_manifest.json", process_week.GENERATED_FILES)
        self.assertIn("screen_inventory.json", process_week.GENERATED_FILES)

    def test_screen_dispositions(self):
        self.assertIn("fully_extracted", process_week.FINAL_DISPOSITIONS)
        self.assertIn("unreadable_manual_review", process_week.FINAL_DISPOSITIONS)

    def test_field_evidence_contract(self):
        value = process_week.field(None, process_week.evidence({"filename":"x.mp4","sha256":"abc"}, {"timestamp":"00:00:01","frame_number":60}))
        for key in ["source_video","source_video_hash","timestamp","frame_number","confidence","verification_status","manual_review"]:
            self.assertIn(key, value["evidence"])

    def test_legacy_play_identity_fallback(self):
        self.assertEqual(process_week.play_identity({}, 0), "legacy_play_001")
        self.assertEqual(process_week.play_identity({"play_id": "abc"}, 0), "abc")

    def test_gitignore_protects_raw_videos(self):
        text = (process_week.root() / ".gitignore").read_text(encoding="utf-8")
        self.assertIn("input_videos/*", text)
        self.assertIn("!input_videos/.gitkeep", text)

    def test_sample_timestamps_deterministic(self):
        self.assertEqual(process_week.sample_timestamps(180.0), process_week.sample_timestamps(180.0))


    def test_roster_stats_crop_zones_exist(self):
        for package in ["current_team_roster", "opponent_roster", "current_team_season_stats", "opponent_season_stats"]:
            self.assertIn(package, process_week.CROP_ZONES)
            self.assertGreaterEqual(len(process_week.CROP_ZONES[package]), 3)

    def test_review_packages_cover_roster_and_stats(self):
        self.assertIn("current_team_roster", process_week.REVIEW_PACKAGES)
        self.assertIn("opponent_season_stats", process_week.REVIEW_PACKAGES)

    def test_tesseract_resolver_shape(self):
        adapter = process_week.resolve_tesseract(process_week.root())
        self.assertIn("available", adapter)
        self.assertIn("source", adapter)

    def test_review_status_normalization(self):
        self.assertEqual(process_week.normalize_review_status("needs_confirmation"), "ocr_draft_needs_confirmation")
        self.assertEqual(process_week.normalize_review_status("confirmed"), "confirmed")
        self.assertEqual(process_week.normalize_review_status("bad-status"), "needs_manual_review")

    def test_confirmed_blank_review_field_fails(self):
        errors = []
        record = process_week.promoted_field_record(
            "current_team_roster",
            {"crop_id": "crop-1"},
            {"field_name": "name", "value": "", "review_status": "confirmed", "evidence": {}},
            errors,
        )
        self.assertIsNone(record)
        self.assertTrue(errors)

    def test_unconfirmed_review_field_does_not_promote(self):
        errors = []
        record = process_week.promoted_field_record(
            "current_team_roster",
            {"crop_id": "crop-1"},
            {"field_name": "name", "value": "M. York", "review_status": "needs_manual_review", "evidence": {}},
            errors,
        )
        self.assertIsNone(record)
        self.assertEqual(errors, [])

    def test_confirmed_review_field_requires_crop_evidence(self):
        errors = []
        record = process_week.promoted_field_record(
            "current_team_roster",
            {"crop_id": "crop-1"},
            {"field_name": "name", "value": "M. York", "review_status": "confirmed", "evidence": {"source_video": "x.mp4"}},
            errors,
        )
        self.assertIsNotNone(record)
        self.assertTrue(any("missing evidence" in e for e in errors))

    def test_roster_table_parser_extracts_candidate_rows(self):
        ev = process_week.crop_evidence({"filename":"x.mp4","sha256":"abc"}, {"timestamp":"00:00:01","frame_number":60}, "assets/review_crops/x.jpg", 0.5, "ocr_draft")
        rows = process_week.parse_table_lines("NAME POS OVR SPD AWR\nM.York QB 77 82 75", "current_team_roster", "crop-1", ev, "roster_table_row")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["fields"][0]["value"], "M.York")
        self.assertTrue(all(field["review_status"] == "ocr_draft_needs_confirmation" for field in rows[0]["fields"]))

    def test_stats_parser_keeps_noisy_unmatched_text_out(self):
        ev = process_week.crop_evidence({"filename":"x.mp4","sha256":"abc"}, {"timestamp":"00:00:01","frame_number":60}, "assets/review_crops/x.jpg", 0.5, "ocr_draft")
        rows = process_week.parse_table_lines("~~~ blurry header only ~~~", "current_team_season_stats", "crop-1", ev, "season_stats_row")
        self.assertEqual(rows, [])

    def test_side_card_parser_extracts_profile_drafts(self):
        ev = process_week.crop_evidence({"filename":"x.mp4","sha256":"abc"}, {"timestamp":"00:00:01","frame_number":60}, "assets/review_crops/x.jpg", 0.5, "ocr_draft")
        rows = process_week.parse_side_card_text("MICK\nYORK\nPOSITION ARCHETYPE\nQB (R)| #15 Backfield Creator\nCLASS & NIL HEIGHT & WEIGHT\nFR | 6'0\" | 195 lbs\nHOMETOWN\nMesquite, TX", "current_team_roster", "crop-1", ev)
        values = {field["field_name"]: field["value"] for field in rows[0]["fields"]}
        self.assertEqual(values["position"], "QB")
        self.assertEqual(values["jersey"], "15")
        self.assertEqual(values["height"], "6'0\"")
        self.assertEqual(values["weight"], "195 lbs")

    def test_roster_sweep_timestamps_cover_duration(self):
        stamps = process_week.roster_sweep_timestamps(10.0, 4.0)
        self.assertEqual(stamps[0], 0.0)
        self.assertGreaterEqual(stamps[-1], 9.8)
        self.assertGreaterEqual(len(stamps), 40)

    def test_changed_frame_indices_detects_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            a = root / "a.jpg"
            b = root / "b.jpg"
            c = root / "c.jpg"
            a.write_bytes(b"a" * 5000)
            b.write_bytes(b"a" * 5000)
            c.write_bytes(b"b" * 5000)
            self.assertEqual(process_week.changed_frame_indices([a, b, c]), [2])

    def test_player_identity_key_uses_name_position_jersey(self):
        fields = {
            "visible_name_text": {"value": "Mick York"},
            "position": {"value": "QB"},
            "jersey": {"value": "15"},
        }
        self.assertEqual(process_week.player_identity_key("rutgers", fields, "abcdef"), "rutgers|mick-york|qb|15")

    def test_player_identity_key_falls_back_to_card_hash(self):
        self.assertEqual(process_week.player_identity_key("purdue", {}, "abcdef123456"), "purdue|unknown-card|abcdef123456")

    def test_merge_player_fields_keeps_best_confidence(self):
        player = {"fields": {"position": {"value": "QB", "evidence": {"confidence": 0.3}}}}
        process_week.merge_player_fields(player, {"position": {"value": "HB", "evidence": {"confidence": 0.2}}})
        self.assertEqual(player["fields"]["position"]["value"], "QB")
        process_week.merge_player_fields(player, {"position": {"value": "QB", "evidence": {"confidence": 0.8}}})
        self.assertEqual(player["fields"]["position"]["evidence"]["confidence"], 0.8)

    def test_accepted_candidate_fields_require_safe_names(self):
        candidate = {"fields": [
            {"field_name": "position", "value": "QB", "evidence": {"confidence": 0.55}},
            {"field_name": "stat_1", "value": "99", "evidence": {"confidence": 0.99}},
        ]}
        accepted = process_week.accepted_candidate_fields(candidate)
        self.assertIn("position", accepted)
        self.assertNotIn("stat_1", accepted)
        self.assertFalse(accepted["position"]["evidence"]["manual_review"])

    def test_crop_evidence_has_crop_path(self):
        ev = process_week.crop_evidence(
            {"filename": "x.mp4", "sha256": "abc"},
            {"timestamp": "00:00:01", "frame_number": 60},
            "assets/review_crops/x.jpg",
            0.0,
            "manual_review",
        )
        self.assertEqual(ev["crop_path"], "assets/review_crops/x.jpg")
        self.assertTrue(ev["manual_review"])


    def test_dynasty_zlib_start_and_reader(self):
        import zlib
        payload = b"Rutgers\x00teamdb_ru\x00Scarlet Knights\x00RUTG"
        raw = b"FBCHUNKS" + b"x" * 10 + zlib.compress(payload)
        with tempfile.TemporaryDirectory() as tmp:
            save = Path(tmp) / "DYNASTY-TEST"
            save.write_bytes(raw)
            info = process_week.read_dynasty_save(save)
            self.assertEqual(info["signature"], "FBCHUNKS")
            self.assertGreaterEqual(info["compressed_offset"], 8)
            self.assertEqual(info["decompressed"], payload)

    def test_dynasty_save_field_has_offset_evidence(self):
        save_info = {
            "path": "DYNASTY-TEST",
            "raw_sha256": "raw",
            "decompressed_sha256": "dec",
        }
        item = process_week.save_field("Rutgers", save_info, 123, "team_database")
        ev = item["evidence"]
        for key in ["source_save", "raw_sha256", "decompressed_sha256", "decompressed_offset", "record_name", "confidence", "decode_status"]:
            self.assertIn(key, ev)

    def test_dynasty_outputs_validate_with_mock_save(self):
        import zlib
        payload = b"Rutgers\x00#CHOP\x00#BirthplaceofCFB\x00RUTG\x00Scarlet Knights\x00teamdb_ru\x00Player\x00PlayerStatRecords\x00ScheduleKnownGame\x00ForcedDepthChartEntry"
        raw = b"FBCHUNKS" + b"\x00" * 74 + zlib.compress(payload)
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            save = repo / "DYNASTY-TEST"
            save.write_bytes(raw)
            outputs = process_week.build_dynasty_save_outputs(repo, save)
            public = {k: v for k, v in outputs.items() if k != "_internal"}
            self.assertEqual(public["current_team.json"]["school"]["value"], "Rutgers")
            self.assertIn("roster", public["source_truth_summary.json"]["unresolved_tables"])
            self.assertEqual(process_week.validate_dynasty_outputs(repo, public), [])


    def test_dynasty_byte_window_profile(self):
        profile = process_week.byte_window_profile(b"abc\x00\x00")
        self.assertEqual(profile["length"], 5)
        self.assertGreater(profile["zero_ratio"], 0)
        self.assertIn("sha256", profile)

    def test_dynasty_row_size_profiles(self):
        buf = bytes([77, 82, 75, 0, 10, 11, 12, 13] * 40)
        profiles = process_week.row_size_profiles(buf, (8, 16))
        self.assertTrue(profiles)
        self.assertIn("row_size", profiles[0])
        self.assertIn("plausible_rating_columns", profiles[0])

    def test_dynasty_known_value_correlation(self):
        known = [{"field": "players.0.overall", "value": 77, "source": "data/example.json"}]
        hits = process_week.correlate_known_values(b"aaa" + bytes([77]) + b"bbb", known, 100)
        self.assertTrue(hits)
        self.assertEqual(hits[0]["decompressed_offset"], 103)

    def test_dynasty_mapping_outputs_do_not_promote(self):
        import zlib
        payload = b"Rutgers\x00#CHOP\x00RUTG\x00Scarlet Knights\x00teamdb_ru\x00Player\x00" + bytes([77, 82, 75, 0] * 80) + b"PlayerStatRecords\x00ScheduleKnownGame\x00ForcedDepthChartEntry"
        raw = b"FBCHUNKS" + b"\x00" * 74 + zlib.compress(payload)
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            (repo / "data").mkdir()
            (repo / "data" / "known.json").write_text('{"players":[{"overall":77,"speed":82}]}', encoding="utf-8")
            save = repo / "DYNASTY-TEST"
            save.write_bytes(raw)
            outputs = process_week.build_dynasty_mapping_outputs(repo, save)
            self.assertEqual(outputs["binary_mapping_summary.json"]["decoded_values_promoted"], 0)
            self.assertGreater(outputs["binary_mapping_summary.json"]["candidate_windows"], 0)
            self.assertEqual(process_week.validate_dynasty_mapping_outputs(outputs), [])
if __name__ == "__main__":
    unittest.main()

