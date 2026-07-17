# Guarded Weekly Refresh

`Refresh CFB27 Dynasty.cmd` is the deliberate Phase 3D entry point. It does not watch the save directory and never publishes merely because a save changed.

## First-time configuration

Review `config/weekly_refresh.json`. Its fields are:

- `save_path`: the one explicitly selected dynasty save; `%USERPROFILE%` is expanded.
- `repository_root`: repository path relative to the configuration file or an absolute path.
- `deployment_branch`: the only branch eligible for promotion.
- `hosted_url`: the GitHub Pages application URL.
- `team`: the required team identity.
- `default_mode`: `confirm`, `preview-only`, or `dry-run`.
- `parser_executable` and `schema_directory`: local, ignored parser runtime.
- `run_root`: ignored immutable per-run artifacts and reports.
- `deployment_output_root`: ignored immutable release candidates.
- `browser_timeout_seconds` and `pages_update_timeout_seconds`: validation limits.

The configuration deliberately contains no week, opponent, hashes, package IDs, refresh IDs, or weekly JSON paths.

## Usage

Double-click `Refresh CFB27 Dynasty.cmd`, or run:

```powershell
& '.\Refresh CFB27 Dynasty.cmd'
& '.\Refresh CFB27 Dynasty.cmd' --dry-run
& '.\Refresh CFB27 Dynasty.cmd' --preview-only
```

Default `confirm` mode builds and validates the candidate, displays its detected context, and then requires the exact text `PUBLISH`. Any other response stops without production promotion. There is no unattended publication option.

## Stages and failure policy

1. **Preflight** confirms repository, branch, clean tree, selected save, Python, Node, Git, parser runtime, schemas, and internally consistent production identity. It records the production commit and fingerprint.
2. **Snapshot** hashes the source, copies it to a unique run directory, hashes the snapshot, re-hashes the source, and requires all three values to match.
3. **Parse and normalize** invokes the parser only against the immutable snapshot. Missing unsupported domains remain unavailable.
4. **Candidate assembly** creates one package-scoped active-package directory and one versioned deployment artifact.
5. **Validation** runs the deployment validator, complete Node suite, browser startup, DOM, cache, mobile, console, resource, and stored-package gates, then rechecks production drift.
6. **Preview** uses the real application shell and run-local package. PASS is required for publication eligibility.
7. **Promotion** repeats drift and cleanliness checks, backs up the previous complete deployed set, copies only manifest-declared bytes, validates production, stages only those paths, commits, and pushes.
8. **Hosted verification** waits for and verifies HTTP, release/package context, startup, resources, cache, mobile, console, and stored-package resistance.
9. **Rollback** restores the previous complete release, commits and pushes it, and verifies the hosted rollback. A failed rollback verification is reported as failure, never success.

Each run writes `weekly-refresh-report.json` and `weekly-refresh-report.md` beneath its immutable run directory. A failure at any gate stops the pipeline. Do not manually copy a partial candidate or edit weekly JSON.

## Safety notes

- The source save is read only for hashing and snapshot creation; parsing uses a snapshot.
- Same-hash saves are reportable and do not require new publication.
- Production publication is interactive and requires a clean, unchanged baseline.
- The prior complete production release remains available for rollback.
- `tools/cfb27_save_reader/publish_dynasty.py` is legacy and is not part of this workflow.
