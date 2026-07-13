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

if __name__ == "__main__":
    unittest.main()
