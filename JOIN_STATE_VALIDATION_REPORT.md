# JOIN_STATE_VALIDATION_REPORT

Generated: 2026-07-12

## States

- `verified`: exact source record resolved.
- `source_missing`: valid source package, absent detail/field.
- `join_failed`: required foreign key or detail record unresolved.
- `not_applicable`: field does not apply.

## Validation Coverage

- Recruit scouting joins distinguish `source_missing` from `join_failed`.
- W. Boudreaux renders recovered verified fields and source-missing optional fields as `N/A`.
- Rutgers O-line slots resolve by canonical player ID.
- Rutgers player media and attributes resolve by `player_id`.
- Generic O-line aliases do not guess left/right.
- Rendered recruit/O-line fixtures do not mask `join_failed` as ordinary `Limited data`.

## Final State Counts

- Recruiting failed joins: 0
- Rutgers failed joins: 0
- Total failed identity joins: 0
- Recruiting board source-missing scouting rows: 34
- Rutgers Last Game source-missing production rows: 42
- Rutgers Season source-missing production rows: 30

## Result

PASS. Failed identity joins are hard validation failures, and current failed joins equal zero.
