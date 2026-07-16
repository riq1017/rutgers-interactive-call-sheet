# CFB27 Parser Validation

This report is staging-only. Production Rutgers app JSON was not modified.

## Latest Read-Only Run

- Source save: `DYNASTY-RUTGERSAPP`
- Source path: `C:\Users\tharg\Documents\EA SPORTS College Football 27\saves\DYNASTY-RUTGERSAPP`
- Source SHA-256: `0fff0ebf2738dbac0d71564189f3f3e2ebd5efae3a71fd24d93e1632fb469e22`
- Snapshot verified: PASS
- Parser: `leaguelines/cfb-dynasty`
- Parser commit: `4ebd1e4e2d1e178af1b946d5b635e5b8d054d808`
- Schema: `C27_468_2.gz`
- Schema source package: `madden-franchise@4.3.1`, MIT, schema reference only
- Parser inspect: PASS
- Parser MVP export: PASS
- Production JSON changed: NO

## MVP Counts

- Teams exported: 138
- Rutgers stable team ID: 78
- Rutgers players found: 85
- Rutgers schedule entries found: 12
- Rutgers season-stat records found: 1
- Rutgers injury records found: 12
- Rutgers depth-chart records found: 0
- Upcoming opponent found: UMass
- Upcoming opponent stable team ID: 119

## Confidence

Parser output is currently `probable`. It must be cross-checked against visible game values across three saved weeks before production Rutgers app JSON is published.

## Unsupported / Pending

- Rutgers depth-chart records were not returned by the current parser MVP export.
- Three-save validation has not been completed.
- Rutgers app production JSON publishing remains disabled.
- Experimental binary comparison offsets remain comparison-only and were not promoted.

## Result

PASS for read-only parser inspection and staging-only MVP normalization.

FAIL / blocked for production publishing until three-save validation passes.
