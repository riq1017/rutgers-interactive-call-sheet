"""Guarded, deliberate CFB27 weekly refresh orchestration.

The default path stops at a validated preview unless the operator explicitly
types PUBLISH. Tests inject deterministic command, hosting, and promotion fakes;
no test touches the repository production root or network.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable
from urllib.request import Request, urlopen


class RefreshError(RuntimeError):
    pass


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temp.replace(path)


def expand_path(raw: str, base: Path) -> Path:
    expanded = os.path.expandvars(raw.replace("%USERPROFILE%", str(Path.home())))
    value = Path(expanded)
    return (value if value.is_absolute() else base / value).resolve()


def repository_path_identity(value: str | Path, label: str) -> str:
    try:
        resolved = Path(value).expanduser().resolve(strict=True)
    except (OSError, RuntimeError) as error:
        raise RefreshError(f"Could not resolve {label}: {value}: {error}") from error
    if not resolved.is_dir():
        raise RefreshError(f"{label} is not a directory: {resolved}")
    return os.path.normcase(str(resolved))


@dataclass(frozen=True)
class Config:
    path: Path
    repo: Path
    save: Path
    branch: str
    hosted_url: str
    team: str
    mode: str
    parser: Path
    schema_dir: Path
    run_root: Path
    deployment_root: Path
    browser_timeout: int
    pages_timeout: int

    @classmethod
    def load(cls, path: Path) -> "Config":
        path = path.resolve()
        raw = json.loads(path.read_text(encoding="utf-8"))
        if raw.get("schema_version") != "cfb27_weekly_refresh_config_v1":
            raise RefreshError("Unsupported weekly refresh configuration schema")
        base = path.parent
        repo = expand_path(raw["repository_root"], base)
        mode = raw.get("default_mode", "confirm")
        if mode not in {"confirm", "preview-only", "dry-run"}:
            raise RefreshError("default_mode must be confirm, preview-only, or dry-run")
        return cls(path, repo, expand_path(raw["save_path"], base), raw["deployment_branch"], raw["hosted_url"], raw["team"], mode,
                   expand_path(raw["parser_executable"], repo), expand_path(raw["schema_directory"], repo),
                   expand_path(raw["run_root"], repo), expand_path(raw["deployment_output_root"], repo),
                   int(raw.get("browser_timeout_seconds", 45)), int(raw.get("pages_update_timeout_seconds", 600)))


class Commands:
    @staticmethod
    def executable(name: str) -> str:
        found = shutil.which(name)
        if found:
            return found
        if name == "git" and os.name == "nt":
            candidates = sorted((Path(os.environ.get("LOCALAPPDATA", "")) / "GitHubDesktop").glob("app-*/resources/app/git/cmd/git.exe"), reverse=True)
            if candidates:
                return str(candidates[0])
        raise RefreshError(f"Required command is unavailable: {name}")

    def run(self, args: list[str], cwd: Path, *, check: bool = True) -> subprocess.CompletedProcess[str]:
        command = [self.executable(args[0]), *args[1:]]
        startupinfo = None
        if os.name == "nt":
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = subprocess.SW_HIDE
        result = subprocess.run(command, cwd=cwd, text=True, capture_output=True, startupinfo=startupinfo)
        if check and result.returncode:
            raise RefreshError(f"Command failed ({result.returncode}): {' '.join(args)}\n{result.stdout}\n{result.stderr}".strip())
        return result


def git(commands: Commands, repo: Path, *args: str, check: bool = True) -> str:
    return commands.run(["git", *args], repo, check=check).stdout.strip()


def active_production(repo: Path) -> dict[str, Any]:
    index = (repo / "index.html").read_text(encoding="utf-8")
    release_ids = set(re.findall(r"[?&]r=([^&\"'#>]+)", index))
    packages = set(re.findall(r"data/active-packages/([^/]+)/", index))
    if len(release_ids) != 1 or len(packages) != 1:
        raise RefreshError("Production must identify exactly one release and immutable package")
    package_id = next(iter(packages))
    marker = repo / "data" / "active-packages" / package_id / "active_package.js"
    if not marker.is_file():
        raise RefreshError("Production active package marker is missing")
    text = marker.read_text(encoding="utf-8")
    refresh = re.search(r'"refresh_id":"([^"]+)"', text)
    source_hash = re.search(r'"source_sha256":"([a-f0-9]{64})"', text)
    if not refresh or not source_hash:
        raise RefreshError("Production marker does not identify a refresh ID")
    return {"release_id": next(iter(release_ids)), "package_id": package_id, "refresh_id": refresh.group(1), "source_sha256": source_hash.group(1), "index_sha256": sha256_file(repo / "index.html"), "marker_sha256": sha256_file(marker)}


def production_fingerprint(repo: Path) -> str:
    tracked = [repo / "index.html", repo / "manifest.webmanifest", repo / "styles.css", repo / "app.js", repo / "package_runtime.js", repo / "production_startup.js", repo / "data" / "rutgers_media.js", repo / "data" / "rutgers_playbook.js"]
    active = active_production(repo)
    package_dir = repo / "data" / "active-packages" / active["package_id"]
    tracked.extend(sorted(package_dir.glob("*.js")))
    return hashlib.sha256(stable_json([(str(item.relative_to(repo)).replace("\\", "/"), sha256_file(item)) for item in tracked]).encode()).hexdigest()


def snapshot_save(source: Path, destination: Path, after_copy: Callable[[], None] | None = None) -> dict[str, Any]:
    if not source.is_file():
        raise RefreshError(f"Configured save does not exist: {source}")
    destination.parent.mkdir(parents=True, exist_ok=False)
    before = sha256_file(source)
    with source.open("rb") as src, destination.open("xb") as dst:
        shutil.copyfileobj(src, dst)
    if after_copy:
        after_copy()
    snapshot = sha256_file(destination)
    after = sha256_file(source)
    if not (before == snapshot == after):
        raise RefreshError("Source-before, snapshot, and source-after hashes do not match")
    return {"source_path": str(source), "snapshot_path": str(destination), "source_sha256_before": before, "snapshot_sha256": snapshot, "source_sha256_after": after}


def validate_context(context: dict[str, Any], team: str, previous: dict[str, Any] | None = None) -> None:
    required = {"team", "season", "week", "record", "opponent", "location", "package_id", "refresh_id"}
    missing = sorted(key for key in required if context.get(key) in {None, ""})
    if missing:
        raise RefreshError(f"Candidate context is incomplete: {', '.join(missing)}")
    if context["team"] != team or context["location"] not in {"Home", "Away"} or not re.fullmatch(r"\d+-\d+", str(context["record"])):
        raise RefreshError("Candidate context is malformed or targets the wrong team")
    if previous and (int(context["season"]), int(context["week"])) < (int(previous["season"]), int(previous["week"])):
        raise RefreshError("Candidate context regresses behind production")


def validate_candidate_contract(candidate: dict[str, Any]) -> None:
    """Validate the neutral package declaration used by deterministic tests and pre-promotion checks."""
    artifacts = candidate.get("artifacts") or []
    required = {"weekly_manifest", "weekly_plan", "gameplan_weekly", "rutgers_roster", "current_opponent"}
    names = {item.get("name") for item in artifacts}
    missing = sorted(required - names)
    if missing:
        raise RefreshError(f"Missing required artifact: {', '.join(missing)}")
    package_ids = {item.get("package_id") for item in artifacts} | {candidate.get("package_id")}
    refresh_ids = {item.get("refresh_id") for item in artifacts} | {candidate.get("refresh_id")}
    if len(package_ids) != 1 or None in package_ids:
        raise RefreshError("Conflicting package IDs")
    if len(refresh_ids) != 1 or None in refresh_ids:
        raise RefreshError("Conflicting refresh IDs")
    for item in artifacts:
        if item.get("required") and item.get("status") != "available":
            raise RefreshError(f"Required artifact unavailable: {item.get('name')}")
        if not item.get("required") and item.get("status") not in {"available", "unavailable"}:
            raise RefreshError(f"Optional artifact status is invalid: {item.get('name')}")
    text = stable_json(candidate).lower()
    stale = [term.lower() for term in candidate.get("stale_terms", []) if term]
    if any(term in text.replace(stable_json(candidate.get("stale_terms", [])).lower(), "") for term in stale):
        raise RefreshError("Stale prior-opponent data detected")
    if re.search(r"data/(?:active/|engine_data|phase1_verified_data|recruiting_data)|save-preview-bridge|app-definitions|purdue", text):
        raise RefreshError("Legacy or mutable resource detected")


def guarded_publish_simulation(promote: Callable[[], None], hosted_verify: Callable[[], None], rollback: Callable[[], None], rollback_verify: Callable[[], None]) -> dict[str, str]:
    """Deterministic transaction model shared by failure/rollback tests."""
    try:
        promote()
        hosted_verify()
        return {"status": "PASS", "rollback": "not-required"}
    except Exception as failure:
        try:
            rollback()
            rollback_verify()
            return {"status": "FAIL", "rollback": "PASS", "reason": str(failure)}
        except Exception as rollback_failure:
            return {"status": "FAIL", "rollback": "FAIL", "reason": str(failure), "rollback_reason": str(rollback_failure)}


def candidate_workflow_simulation(candidate: dict[str, Any], detected_context: dict[str, Any], *, team: str = "Rutgers", browser_pass: bool = True, production_before: str = "stable", production_after: str = "stable") -> dict[str, Any]:
    validate_context(detected_context, team)
    validate_candidate_contract(candidate)
    if not browser_pass:
        raise RefreshError("Candidate browser validation failed")
    if production_before != production_after:
        raise RefreshError("Production drifted during candidate validation")
    return {"status": "PASS", "promotion_eligible": True, "context": detected_context}


def require_clean_preflight(config: Config, commands: Commands) -> dict[str, Any]:
    git_root = git(commands, config.repo, "rev-parse", "--show-toplevel")
    if repository_path_identity(git_root, "Git repository root") != repository_path_identity(config.repo, "configured repository root"):
        raise RefreshError("Configured repository root does not match Git")
    if git(commands, config.repo, "branch", "--show-current") != config.branch:
        raise RefreshError(f"Deployment branch must be {config.branch}")
    if git(commands, config.repo, "status", "--porcelain"):
        raise RefreshError("Working tree is dirty")
    for executable in ([sys.executable, "--version"], ["node", "--version"], ["git", "--version"]):
        commands.run(executable, config.repo)
    commands.run(["node", "-e", "require('playwright'); process.stdout.write('playwright-ready')"], config.repo)
    if not config.save.is_file() or not config.parser.is_file() or not config.schema_dir.is_dir():
        raise RefreshError("Configured save, parser, or schema directory is unavailable")
    production = active_production(config.repo)
    production.update({"commit": git(commands, config.repo, "rev-parse", "HEAD"), "fingerprint": production_fingerprint(config.repo)})
    return production


def copy_manifest_release(candidate: Path, repo: Path, *, fail_after: int | None = None) -> list[str]:
    manifest = json.loads((candidate / "deployment-manifest.json").read_text(encoding="utf-8"))
    copied: list[str] = []
    for number, rel in enumerate(sorted(manifest["files"]), 1):
        source, destination = candidate / rel, repo / rel
        if not source.is_file() or sha256_file(source) != manifest["files"][rel]["sha256"]:
            raise RefreshError(f"Candidate manifest mismatch: {rel}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied.append(rel)
        if fail_after == number:
            raise RefreshError("Simulated partial promotion failure")
    for rel in copied:
        if sha256_file(repo / rel) != manifest["files"][rel]["sha256"]:
            raise RefreshError(f"Production copy mismatch: {rel}")
    return copied


def restore_complete_tree(backup: Path, repo: Path, files: Iterable[str]) -> None:
    for rel in files:
        source = backup / rel
        destination = repo / rel
        if source.exists():
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
        elif destination.exists():
            destination.unlink()


def hosted_json(url: str, timeout: int = 30) -> dict[str, Any]:
    request = Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "CFB27-Weekly-Refresh/1"})
    with urlopen(request, timeout=timeout) as response:
        return {"status": response.status, "url": response.url, "body": response.read().decode("utf-8", errors="replace")}


def confirm_publish(context: dict[str, Any], input_fn: Callable[[str], str] = input) -> bool:
    print(json.dumps({key: context.get(key) for key in ("team", "season", "week", "record", "opponent", "location", "package_id", "refresh_id")}, indent=2))
    return input_fn("Type PUBLISH to promote this validated candidate: ").strip() == "PUBLISH"


def report_markdown(state: dict[str, Any]) -> str:
    lines = ["# CFB27 Weekly Refresh Report", "", f"Status: **{state['status']}**", f"Run ID: `{state['run_id']}`", f"Mode: `{state['mode']}`", "", "## Stages"]
    lines.extend(f"- {item['name']}: **{item['status']}**{(' — ' + item['detail']) if item.get('detail') else ''}" for item in state["stages"])
    if state.get("context"):
        lines += ["", "## Candidate"] + [f"- {key}: `{state['context'].get(key)}`" for key in ("team", "season", "week", "record", "opponent", "location", "package_id", "refresh_id", "release_id")]
    if state.get("failure"):
        lines += ["", "## Failure", state["failure"]]
    lines += ["", f"Rollback: `{state.get('rollback', {}).get('status', 'not-required')}`", ""]
    return "\n".join(lines)


def write_reports(run_dir: Path, state: dict[str, Any]) -> None:
    atomic_json(run_dir / "weekly-refresh-report.json", state)
    (run_dir / "weekly-refresh-report.md").write_text(report_markdown(state), encoding="utf-8")


class Workflow:
    def __init__(self, config: Config, commands: Commands | None = None, input_fn: Callable[[str], str] = input):
        self.config, self.commands, self.input_fn = config, commands or Commands(), input_fn

    def execute(self, mode: str | None = None) -> dict[str, Any]:
        mode = mode or self.config.mode
        run_id = utc_stamp()
        run_dir = self.config.run_root / run_id
        run_dir.mkdir(parents=True, exist_ok=False)
        state: dict[str, Any] = {"schema_version": "cfb27_weekly_refresh_report_v1", "run_id": run_id, "mode": mode, "status": "FAIL", "stages": [], "production_changed": False, "push_attempted": False, "rollback": {"status": "not-required"}}
        def stage(name: str, status: str, detail: str = "") -> None:
            state["stages"].append({"name": name, "status": status, "detail": detail})
            write_reports(run_dir, state)
            print(f"[{status}] {name}{': ' + detail if detail else ''}")
        try:
            production = require_clean_preflight(self.config, self.commands)
            state["previous_production"] = production
            stage("preflight", "PASS", production["release_id"])
            snapshot = snapshot_save(self.config.save, run_dir / "snapshot" / self.config.save.name)
            state["snapshot"] = snapshot
            stage("snapshot", "PASS", snapshot["snapshot_sha256"])
            if snapshot["snapshot_sha256"] == production["source_sha256"]:
                state["status"] = "PASS"
                state["no_change"] = True
                stage("no-change", "PASS", "configured save matches the active production source hash")
                return state
            preview = self.commands.run(["node", "tools/refresh_save_a_preview.js", "--save", snapshot["snapshot_path"], "--parser", str(self.config.parser), "--schema-dir", str(self.config.schema_dir), "--run-root", str(run_dir / "candidate-source")], self.config.repo)
            preview_result = json.loads(preview.stdout)
            refresh_manifest = json.loads(Path(preview_result["manifest"]).read_text(encoding="utf-8"))
            context = {**refresh_manifest["browser_expectation"], "refresh_id": refresh_manifest["refresh_id"]}
            context["package_id"] = refresh_manifest["package_id"]
            validate_context(context, self.config.team)
            state["context"] = context
            stage("parse-normalize", "PASS", f"Week {context['week']} vs {context['opponent']}")
            release_id = f"cfb27-{str(context['team']).lower()}-{context['season']}-week-{context['week']}-{run_id.lower()}"
            assembled = self.commands.run(["node", "tools/assemble_deployment.js", "--package-dir", refresh_manifest["artifacts"]["active_package"]["directory"], "--release-id", release_id, "--output-root", str(self.config.deployment_root), "--source-commit", production["commit"], "--previous-release-id", production["release_id"]], self.config.repo)
            candidate_result = json.loads(assembled.stdout)
            candidate = Path(candidate_result["directory"])
            context["release_id"] = release_id
            state["candidate"] = candidate_result
            stage("candidate-assembly", "PASS", release_id)
            gates = [
                ["node", "tools/validate_deployment_artifact.js", str(candidate)],
                ["node", "--test", *[str(path.relative_to(self.config.repo)) for path in sorted((self.config.repo / "tests").glob("*.js"))]],
                ["node", "tools/validate_weekly_browser.js", "--root", str(candidate), "--expected", str(refresh_manifest["artifacts"]["real_shell"]["expectation"]), "--timeout", str(self.config.browser_timeout)],
            ]
            for command in gates:
                self.commands.run(command, self.config.repo)
            if production_fingerprint(self.config.repo) != production["fingerprint"]:
                raise RefreshError("Production drifted during candidate validation")
            stage("validation", "PASS", "artifact, full Node, browser, cache, mobile, storage")
            stage("preview", "PASS", refresh_manifest["artifacts"]["real_shell"]["index"])
            if mode in {"dry-run", "preview-only"}:
                state["status"] = "PASS"
                stage("promotion", "SKIPPED", mode)
                return state
            if mode != "confirm" or not confirm_publish(context, self.input_fn):
                stage("promotion", "REFUSED", "explicit PUBLISH confirmation not received")
                state["status"] = "PASS"
                return state
            if production_fingerprint(self.config.repo) != production["fingerprint"] or git(self.commands, self.config.repo, "status", "--porcelain"):
                raise RefreshError("Production drift or dirty worktree detected before promotion")
            backup = run_dir / "rollback" / production["release_id"]
            manifest = json.loads((candidate / "deployment-manifest.json").read_text(encoding="utf-8"))
            for rel in manifest["files"]:
                source = self.config.repo / rel
                if source.exists():
                    destination = backup / rel; destination.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(source, destination)
            copied: list[str] = []
            release_commit: str | None = None
            try:
                copied = copy_manifest_release(candidate, self.config.repo)
                state["production_changed"] = True
                stage("promotion-copy", "PASS", f"{len(copied)} files")
                for rel, declaration in manifest["files"].items():
                    if sha256_file(self.config.repo / rel) != declaration["sha256"]:
                        raise RefreshError(f"Production root differs from candidate: {rel}")
                git(self.commands, self.config.repo, "add", "--", *copied)
                git(self.commands, self.config.repo, "diff", "--cached", "--check")
                git(self.commands, self.config.repo, "commit", "-m", f"release: activate Week {context['week']} {context['opponent']} package")
                release_commit = git(self.commands, self.config.repo, "rev-parse", "HEAD")
                state["release_commit"] = release_commit
                git(self.commands, self.config.repo, "push", "origin", self.config.branch)
                state["push_attempted"] = True
                stage("publish", "PASS", release_commit)
                hosted = self.commands.run(["node", "tools/validate_weekly_browser.js", "--url", self.config.hosted_url, "--expected", str(refresh_manifest["artifacts"]["real_shell"]["expectation"]), "--release-id", release_id, "--commit", release_commit, "--timeout", str(self.config.pages_timeout)], self.config.repo)
                state["hosted"] = json.loads(hosted.stdout)
                stage("hosted-verification", "PASS", self.config.hosted_url)
            except Exception as publish_error:
                state["rollback"] = {"status": "RUNNING", "reason": str(publish_error), "prior_package": production["package_id"], "failed_package": context["package_id"]}
                if not state["push_attempted"]:
                    restore_complete_tree(backup, self.config.repo, manifest["files"])
                    if copied:
                        git(self.commands, self.config.repo, "restore", "--staged", "--", *copied, check=False)
                    state["rollback"]["status"] = "LOCAL_RESTORED"
                    raise RefreshError(f"Local promotion failed and production files were restored without commit or push: {publish_error}")
                if not release_commit:
                    raise RefreshError(f"Published state lacks a release commit and cannot be rolled back automatically: {publish_error}")
                git(self.commands, self.config.repo, "revert", "--no-edit", release_commit)
                rollback_commit = git(self.commands, self.config.repo, "rev-parse", "HEAD")
                git(self.commands, self.config.repo, "push", "origin", self.config.branch)
                self.commands.run(["node", "tools/validate_weekly_browser.js", "--url", self.config.hosted_url, "--release-id", production["release_id"], "--commit", rollback_commit, "--timeout", str(self.config.pages_timeout)], self.config.repo)
                state["rollback"].update({"status": "PASS", "commit": rollback_commit})
                raise RefreshError(f"Hosted publication failed; complete release-commit revert verified: {publish_error}")
            state["status"] = "PASS"
            return state
        except Exception as error:
            state["failure"] = str(error)
            state["status"] = "FAIL"
            stage("failure", "FAIL", str(error))
            return state
        finally:
            write_reports(run_dir, state)
            print(f"Reports: {run_dir / 'weekly-refresh-report.md'}")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Guarded one-button CFB27 weekly refresh")
    parser.add_argument("--config", default="config/weekly_refresh.json")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--dry-run", action="store_true")
    modes.add_argument("--preview-only", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    mode = "dry-run" if args.dry_run else "preview-only" if args.preview_only else None
    result = Workflow(Config.load(Path(args.config))).execute(mode)
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
