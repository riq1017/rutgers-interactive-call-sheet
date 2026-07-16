# CFB27 Save Reader

Read-only local ingestion layer for CFB27 dynasty saves.

This tool never edits the source save. It discovers a save, copies it to a timestamped snapshot, verifies the source and copied SHA-256 hashes match, then runs inspection/parser work only against the copied file.

## Basic Use

```powershell
python tools\cfb27_save_reader\locate_save.py --save-name DYNASTY-RUTGERSAPP
python tools\cfb27_save_reader\inspect_save.py --save-name DYNASTY-RUTGERSAPP
python tools\cfb27_save_reader\refresh_dynasty.py --save-name DYNASTY-RUTGERSAPP
```

To use an explicit save:

```powershell
python tools\cfb27_save_reader\inspect_save.py --save-path "C:\Users\tharg\Documents\EA SPORTS College Football 27\saves\DYNASTY-RUTGERSAPP"
```

## Parser Runtime

The intended parser is `leaguelines/cfb-dynasty`, pinned locally by commit. Configure its executable with either:

- `CFB27_DYNASTY_PARSER`
- `config.example.json` copied to a local config file

Schema bundles and parser binaries are local runtime files and must not be committed.

## Output

- snapshots: `data/dynasty/snapshots/`
- raw parser output: `data/dynasty/raw/`
- inspection reports: `data/dynasty/inspection/`
- normalized proposal: `data/dynasty/normalized/`

The production app JSON is not modified by this tool.

## Current Parser Runtime

The current local runtime uses:

- parser: `leaguelines/cfb-dynasty`
- pinned commit: `4ebd1e4e2d1e178af1b946d5b635e5b8d054d808`
- schema: `C27_468_2.gz`
- schema reference package: `madden-franchise@4.3.1`, MIT, schema reference only

`refresh_dynasty.py` is staging-only. It writes raw parser exports and normalized output under ignored `data/dynasty/` folders and refuses production publishing until three-save validation passes.

## Three-Save Validation Gate

Before publishing parsed data into the Rutgers app, create a temporary dynasty named `DYNASTY-PARSER-TEST` and save three snapshots:

1. Test A: initial week with visible season, week, Rutgers record, upcoming opponent, roster checks, stats checks, and depth-chart checks.
2. Test B: advance exactly one week and record the same values.
3. Test C: advance one more week and record the same values.

The real `DYNASTY-RUTGERSAPP` save does not need to be advanced for parser validation.
