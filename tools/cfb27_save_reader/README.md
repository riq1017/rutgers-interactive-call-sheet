# CFB27 Save Reader

Read-only local ingestion layer for CFB27 dynasty saves.

This tool never edits the source save. It discovers a save, copies it to a timestamped snapshot, verifies the source and copied SHA-256 hashes match, then runs inspection/parser work only against the copied file.

## Basic Use

```powershell
python tools\cfb27_save_reader\locate_save.py --save-name DYNASTY-RUTGERSAPP
python tools\cfb27_save_reader\inspect_save.py --save-name DYNASTY-RUTGERSAPP
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

