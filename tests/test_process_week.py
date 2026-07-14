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

if __name__ == "__main__":
    unittest.main()
