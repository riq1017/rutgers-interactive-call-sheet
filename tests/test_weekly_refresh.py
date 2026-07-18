import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "tools" / "cfb27_save_reader"))

import weekly_refresh as wr
from common import ParserIdentity, SaveReaderError, copy_save_to_snapshot


def context(**overrides):
    value = {"team": "Rutgers", "season": 2026, "week": 3, "record": "2-0", "opponent": "Neutral Opponent", "location": "Home", "package_id": "pkg-1", "refresh_id": "run-1"}
    value.update(overrides)
    return value


def candidate(**overrides):
    artifacts = [{"name": name, "package_id": "pkg-1", "refresh_id": "run-1", "required": True, "status": "available"} for name in ["weekly_manifest", "weekly_plan", "gameplan_weekly", "rutgers_roster", "current_opponent"]]
    artifacts.append({"name": "statistics", "package_id": "pkg-1", "refresh_id": "run-1", "required": False, "status": "unavailable"})
    value = {"package_id": "pkg-1", "refresh_id": "run-1", "artifacts": artifacts, "resources": ["data/active-packages/pkg-1/active_package.js"], "stale_terms": []}
    value.update(overrides)
    return value


class Phase3DTests(unittest.TestCase):
    def test_successful_new_save_snapshot_and_context(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); save = root / "DYNASTY-TEST"; save.write_bytes(b"new-save")
            proof = wr.snapshot_save(save, root / "run" / "snapshot" / save.name)
            self.assertEqual(proof["source_sha256_before"], proof["snapshot_sha256"])
            wr.validate_context(context(), "Rutgers", {"season": 2026, "week": 2})

    def test_same_hash_no_change_is_detectable(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "save"; path.write_bytes(b"same")
            self.assertEqual(wr.sha256_file(path), wr.sha256_file(path))

    def test_save_mutation_during_copy_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); save = root / "save"; save.write_bytes(b"before")
            with self.assertRaisesRegex(wr.RefreshError, "Source-before"):
                wr.snapshot_save(save, root / "run" / "snapshot", lambda: save.write_bytes(b"after"))

    def test_common_snapshot_records_source_after(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); save = root / "save"; save.write_bytes(b"stable")
            parser = ParserIdentity(status="test")
            result = copy_save_to_snapshot(save, root / "snapshots", parser)
            manifest = result["manifest"]
            self.assertEqual(manifest["source"]["sha256"], manifest["copied"]["sha256"])
            self.assertEqual(manifest["copied"]["sha256"], manifest["source_after"]["sha256"])

    def test_parser_failure_is_fail_closed(self):
        failure = wr.guarded_publish_simulation(lambda: (_ for _ in ()).throw(wr.RefreshError("parser failed")), lambda: None, lambda: None, lambda: None)
        self.assertEqual(failure["status"], "FAIL")

    def test_invalid_normalized_output(self):
        with self.assertRaisesRegex(wr.RefreshError, "incomplete"):
            wr.validate_context(context(opponent=None), "Rutgers")

    def test_missing_required_artifact(self):
        value = candidate(); value["artifacts"] = value["artifacts"][1:]
        with self.assertRaisesRegex(wr.RefreshError, "Missing required"):
            wr.validate_candidate_contract(value)

    def test_optional_unavailable_artifact_passes(self):
        wr.validate_candidate_contract(candidate())

    def test_conflicting_package_ids(self):
        value = candidate(); value["artifacts"][0]["package_id"] = "other"
        with self.assertRaisesRegex(wr.RefreshError, "package IDs"):
            wr.validate_candidate_contract(value)

    def test_conflicting_refresh_ids(self):
        value = candidate(); value["artifacts"][0]["refresh_id"] = "other"
        with self.assertRaisesRegex(wr.RefreshError, "refresh IDs"):
            wr.validate_candidate_contract(value)

    def test_context_mismatch_and_regression(self):
        with self.assertRaisesRegex(wr.RefreshError, "wrong team"):
            wr.validate_context(context(team="Other"), "Rutgers")
        with self.assertRaisesRegex(wr.RefreshError, "regresses"):
            wr.validate_context(context(week=1), "Rutgers", {"season": 2026, "week": 2})

    def test_stale_prior_opponent_rejected(self):
        value = candidate(stale_terms=["Old Opponent"], scouting="Old Opponent tendency")
        with self.assertRaisesRegex(wr.RefreshError, "Stale"):
            wr.validate_candidate_contract(value)

    def test_legacy_resource_rejected(self):
        value = candidate(resources=["data/engine_data.js"])
        with self.assertRaisesRegex(wr.RefreshError, "Legacy"):
            wr.validate_candidate_contract(value)

    def test_dirty_worktree_and_production_drift_are_rejected(self):
        class Dirty(wr.Commands):
            def run(self, args, cwd, check=True):
                import subprocess
                text = " M index.html\n" if "status" in args else (str(cwd) + "\n" if "--show-toplevel" in args else "main\n")
                return subprocess.CompletedProcess(args, 0, text, "")
        with tempfile.TemporaryDirectory() as tmp:
            cfg = object.__new__(wr.Config); object.__setattr__(cfg, "repo", Path(tmp)); object.__setattr__(cfg, "branch", "main")
            with self.assertRaisesRegex(wr.RefreshError, "dirty"):
                wr.require_clean_preflight(cfg, Dirty())
        self.assertNotEqual(wr.stable_json({"fingerprint": "before"}), wr.stable_json({"fingerprint": "after"}))

    def test_preview_only_allows_only_explicit_tooling_changes(self):
        wr.validate_worktree_status(" M tools/validate_weekly_browser.js\n M tests/test_weekly_browser.js", allow_preview_tooling=True)
        wr.validate_worktree_status(" M app.js\n?? tools/current_week_ui_adapter.js", allow_preview_tooling=True)
        with self.assertRaisesRegex(wr.RefreshError, "dirty"):
            wr.validate_worktree_status(" M index.html", allow_preview_tooling=True)
        with self.assertRaisesRegex(wr.RefreshError, "dirty"):
            wr.validate_worktree_status(" M tools/validate_weekly_browser.js", allow_preview_tooling=False)

    def test_git_helper_preserves_porcelain_leading_status_column(self):
        import subprocess
        class Porcelain(wr.Commands):
            def run(self, args, cwd, check=True):
                return subprocess.CompletedProcess(args, 0, " M tests/test_weekly_browser.js\r\n", "")
        value = wr.git(Porcelain(), ROOT, "status", "--porcelain")
        self.assertEqual(value, " M tests/test_weekly_browser.js")
        wr.validate_worktree_status(value, allow_preview_tooling=True)

    def test_partial_promotion_failure_restores_complete_tree(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); repo = root / "repo"; artifact = root / "artifact"; backup = root / "backup"
            for base, content in [(repo, "old"), (artifact, "new"), (backup, "old")]:
                (base / "a.txt").parent.mkdir(parents=True, exist_ok=True); (base / "a.txt").write_text(content)
            manifest = {"files": {"a.txt": {"sha256": wr.sha256_file(artifact / "a.txt")}}}
            (artifact / "deployment-manifest.json").write_text(json.dumps(manifest))
            with self.assertRaisesRegex(wr.RefreshError, "partial"):
                wr.copy_manifest_release(artifact, repo, fail_after=1)
            wr.restore_complete_tree(backup, repo, ["a.txt"])
            self.assertEqual((repo / "a.txt").read_text(), "old")

    def test_hosted_failure_rolls_back_successfully(self):
        calls = []
        result = wr.guarded_publish_simulation(lambda: calls.append("promote"), lambda: (_ for _ in ()).throw(RuntimeError("hosted mismatch")), lambda: calls.append("rollback"), lambda: calls.append("verified"))
        self.assertEqual(result["rollback"], "PASS"); self.assertEqual(calls, ["promote", "rollback", "verified"])

    def test_rollback_verification_failure_is_reported(self):
        result = wr.guarded_publish_simulation(lambda: None, lambda: (_ for _ in ()).throw(RuntimeError("hosted")), lambda: None, lambda: (_ for _ in ()).throw(RuntimeError("rollback verify")))
        self.assertEqual(result["rollback"], "FAIL")

    def test_publish_refusal_and_acceptance(self):
        self.assertFalse(wr.confirm_publish(context(), lambda _: "no"))
        self.assertTrue(wr.confirm_publish(context(), lambda _: "PUBLISH"))

    def test_dry_run_and_preview_only_are_nonpublishing_modes(self):
        parsed = wr.parse_args(["--dry-run"]); self.assertTrue(parsed.dry_run)
        parsed = wr.parse_args(["--preview-only"]); self.assertTrue(parsed.preview_only)

    def test_successful_publish_simulation(self):
        result = wr.guarded_publish_simulation(lambda: None, lambda: None, lambda: self.fail("rollback called"), lambda: None)
        self.assertEqual(result, {"status": "PASS", "rollback": "not-required"})

    def test_successful_candidate_workflow_simulation(self):
        result = wr.candidate_workflow_simulation(candidate(), context())
        self.assertTrue(result["promotion_eligible"])

    def test_candidate_browser_failure(self):
        with self.assertRaisesRegex(wr.RefreshError, "browser"):
            wr.candidate_workflow_simulation(candidate(), context(), browser_pass=False)

    def test_production_drift_rejection(self):
        with self.assertRaisesRegex(wr.RefreshError, "drifted"):
            wr.candidate_workflow_simulation(candidate(), context(), production_before="one", production_after="two")

    def test_reports_are_machine_and_human_readable(self):
        with tempfile.TemporaryDirectory() as tmp:
            state = {"status": "PASS", "run_id": "r", "mode": "dry-run", "stages": [{"name": "preview", "status": "PASS"}], "rollback": {"status": "not-required"}}
            wr.write_reports(Path(tmp), state)
            self.assertEqual(json.loads((Path(tmp) / "weekly-refresh-report.json").read_text())["status"], "PASS")
            self.assertIn("CFB27 Weekly Refresh Report", (Path(tmp) / "weekly-refresh-report.md").read_text())


if __name__ == "__main__":
    unittest.main()
