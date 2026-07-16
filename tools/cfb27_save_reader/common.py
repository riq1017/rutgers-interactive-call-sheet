from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import zlib
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


READER_SCHEMA_VERSION = "cfb27_save_reader_v1"
DEFAULT_SAVE_NAME = "DYNASTY-RUTGERSAPP"
SUPPORTED_EXPORTS = [
    "season",
    "teams",
    "rosters",
    "games",
    "season-stats",
    "injuries",
    "depth-charts",
]
COMMON_SAVE_DIRS = [
    Path("Documents") / "EA SPORTS College Football 27" / "saves",
    Path("Documents") / "College Football 27" / "Saves",
    Path("OneDrive") / "Documents" / "EA SPORTS College Football 27" / "saves",
    Path("OneDrive") / "Documents" / "College Football 27" / "Saves",
]


class SaveReaderError(RuntimeError):
    pass


@dataclass(frozen=True)
class ParserIdentity:
    executable: Optional[str] = None
    repository: str = "https://github.com/leaguelines/cfb-dynasty"
    pinned_commit: Optional[str] = None
    executable_sha256: Optional[str] = None
    schema_filename: Optional[str] = None
    schema_sha256: Optional[str] = None
    status: str = "not_configured"

    def as_dict(self) -> Dict[str, Any]:
        return {
            "executable": self.executable,
            "repository": self.repository,
            "pinned_commit": self.pinned_commit,
            "executable_sha256": self.executable_sha256,
            "schema_filename": self.schema_filename,
            "schema_sha256": self.schema_sha256,
            "status": self.status,
        }


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def atomic_write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=path.parent, newline="\n") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")
        temp_name = handle.name
    Path(temp_name).replace(path)


def atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=path.parent, newline="\n") as handle:
        handle.write(text)
        temp_name = handle.name
    Path(temp_name).replace(path)


def load_config(config_path: Optional[Path]) -> Dict[str, Any]:
    if not config_path or not config_path.exists():
        return {}
    return json.loads(config_path.read_text(encoding="utf-8"))


def user_home() -> Path:
    return Path(os.environ.get("USERPROFILE") or os.path.expanduser("~"))


def candidate_save_dirs(config: Dict[str, Any]) -> List[Path]:
    dirs: List[Path] = []
    configured = config.get("save_directories", [])
    for item in configured:
        dirs.append(Path(item).expanduser())
    home = user_home()
    for rel in COMMON_SAVE_DIRS:
        dirs.append(home / rel)
    return dirs


def discover_save(
    save_name: str = DEFAULT_SAVE_NAME,
    save_path: Optional[Path] = None,
    config_path: Optional[Path] = None,
) -> Path:
    if save_path:
        resolved = save_path.expanduser().resolve()
        if not resolved.exists():
            raise SaveReaderError(f"Save path not found: {resolved}")
        return resolved

    env_path = os.environ.get("CFB27_DYNASTY_SAVE")
    if env_path:
        resolved = Path(env_path).expanduser().resolve()
        if not resolved.exists():
            raise SaveReaderError(f"CFB27_DYNASTY_SAVE does not exist: {resolved}")
        return resolved

    config = load_config(config_path)
    configured_save = config.get("save_path")
    if configured_save:
        resolved = Path(configured_save).expanduser().resolve()
        if not resolved.exists():
            raise SaveReaderError(f"Configured save_path does not exist: {resolved}")
        return resolved

    matches: List[Path] = []
    for directory in candidate_save_dirs(config):
        if directory.exists():
            exact = directory / save_name
            if exact.exists():
                matches.append(exact)
            matches.extend(path for path in directory.rglob(save_name) if path.is_file())

    if not matches:
        raise SaveReaderError(f"No save named {save_name} found in configured or common save directories")
    return max((path.resolve() for path in set(matches)), key=lambda item: item.stat().st_mtime)


def file_metadata(path: Path) -> Dict[str, Any]:
    stat = path.stat()
    return {
        "path": str(path),
        "filename": path.name,
        "size": stat.st_size,
        "created": datetime.fromtimestamp(stat.st_ctime, timezone.utc).isoformat(),
        "modified": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
        "sha256": sha256_file(path),
    }


def resolve_parser_identity(config: Dict[str, Any]) -> ParserIdentity:
    configured = os.environ.get("CFB27_DYNASTY_PARSER") or config.get("parser_executable")
    schema_path = config.get("schema_path")
    pinned_commit = config.get("parser_pinned_commit")
    if not configured:
        return ParserIdentity(pinned_commit=pinned_commit, schema_filename=Path(schema_path).name if schema_path else None)

    exe = Path(configured).expanduser()
    if not exe.exists():
        return ParserIdentity(executable=str(exe), pinned_commit=pinned_commit, status="missing")

    schema_hash = None
    schema_filename = None
    if schema_path:
        schema = Path(schema_path).expanduser()
        schema_filename = schema.name
        schema_hash = sha256_file(schema) if schema.exists() else None
    return ParserIdentity(
        executable=str(exe.resolve()),
        pinned_commit=pinned_commit,
        executable_sha256=sha256_file(exe),
        schema_filename=schema_filename,
        schema_sha256=schema_hash,
        status="configured",
    )


def copy_save_to_snapshot(source: Path, snapshot_root: Path, parser: ParserIdentity) -> Dict[str, Any]:
    source = source.resolve()
    timestamp = utc_now()
    snapshot_dir = (snapshot_root / f"{timestamp}_{source.name}").resolve()
    destination = (snapshot_dir / source.name).resolve()
    if source == destination:
        raise SaveReaderError("Source save and destination snapshot resolve to the same file")
    snapshot_dir.mkdir(parents=True, exist_ok=True)

    before = file_metadata(source)
    with source.open("rb") as read_handle, destination.open("wb") as write_handle:
        shutil.copyfileobj(read_handle, write_handle)
    after = file_metadata(destination)
    if before["sha256"] != after["sha256"]:
        raise SaveReaderError("Snapshot hash does not match source hash")

    manifest = {
        "schema_version": READER_SCHEMA_VERSION,
        "package_type": "cfb27_snapshot_manifest",
        "source_of_truth": "cfb27_dynasty_save",
        "snapshot_time": timestamp,
        "source": before,
        "copied": after,
        "parser": parser.as_dict(),
        "processing_status": "snapshot_copied",
    }
    atomic_write_json(snapshot_dir / "manifest.json", manifest)
    return {"snapshot_dir": str(snapshot_dir), "save_path": str(destination), "manifest": manifest}


def find_zlib_offset(raw: bytes) -> Optional[int]:
    for offset in range(min(len(raw), 512)):
        if raw[offset : offset + 2] in (b"\x78\x01", b"\x78\x9c", b"\x78\xda"):
            try:
                zlib.decompress(raw[offset:])
                return offset
            except zlib.error:
                continue
    return None


def inspect_container(save_path: Path) -> Dict[str, Any]:
    raw = save_path.read_bytes()
    signature = raw[:8].decode("ascii", errors="replace")
    zlib_offset = find_zlib_offset(raw)
    decompressed_size = None
    decompressed_sha256 = None
    if zlib_offset is not None:
        decompressed = zlib.decompress(raw[zlib_offset:])
        decompressed_size = len(decompressed)
        decompressed_sha256 = hashlib.sha256(decompressed).hexdigest()
    return {
        "signature": signature,
        "raw_size": len(raw),
        "raw_sha256": hashlib.sha256(raw).hexdigest(),
        "zlib_offset": zlib_offset,
        "decompressed_size": decompressed_size,
        "decompressed_sha256": decompressed_sha256,
    }


def run_parser_inspect(snapshot_save: Path, parser: ParserIdentity, timeout: int = 60) -> Dict[str, Any]:
    if parser.status != "configured" or not parser.executable:
        return {
            "status": "parser_unavailable",
            "raw": None,
            "error": "Parser executable is not configured. Set CFB27_DYNASTY_PARSER or config parser_executable.",
        }
    command = [parser.executable, "inspect", "-json", str(snapshot_save)]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)
    except OSError as exc:
        return {"status": "parser_failed", "raw": None, "error": str(exc), "command": command}
    if result.returncode != 0:
        return {
            "status": "parser_failed",
            "raw": None,
            "error": result.stderr.strip() or result.stdout.strip(),
            "command": command,
            "returncode": result.returncode,
        }
    try:
        raw = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        return {"status": "parser_failed", "raw": result.stdout, "error": f"Parser did not return JSON: {exc}", "command": command}
    return {"status": "parsed", "raw": raw, "command": command}


def provenanced(value: Any, source: Dict[str, Any], parser: ParserIdentity, raw_reference: Optional[str], confidence: str) -> Dict[str, Any]:
    return {
        "value": value,
        "source": source,
        "confidence": confidence,
        "parser_version": parser.pinned_commit or parser.executable_sha256 or "unconfigured",
        "raw_reference": raw_reference,
    }


def validate_rating(value: Any) -> bool:
    return isinstance(value, int) and 0 <= value <= 99


def validate_normalized_payload(payload: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    player_ids = set()
    for player in payload.get("players", []):
        player_id = player.get("player_id", {}).get("value") if isinstance(player.get("player_id"), dict) else None
        if not player_id:
            errors.append("player is missing player_id")
        elif player_id in player_ids:
            errors.append(f"duplicate player_id: {player_id}")
        else:
            player_ids.add(player_id)
        overall = player.get("overall", {}).get("value") if isinstance(player.get("overall"), dict) else None
        if overall is not None and not validate_rating(overall):
            errors.append(f"invalid overall rating for {player_id}: {overall}")
    team_ids = [team.get("team_id", {}).get("value") for team in payload.get("teams", []) if isinstance(team.get("team_id"), dict)]
    if len(team_ids) != len(set(team_ids)):
        errors.append("duplicate team_id")
    return errors


def build_empty_normalized(source: Dict[str, Any], parser: ParserIdentity, status: str) -> Dict[str, Any]:
    return {
        "schema_version": READER_SCHEMA_VERSION,
        "package_type": "cfb27_dynasty_normalized",
        "source_of_truth": "cfb27_dynasty_save",
        "status": status,
        "season": None,
        "teams": [],
        "rosters": [],
        "players": [],
        "games": [],
        "season_stats": [],
        "injuries": [],
        "depth_charts": [],
        "recruiting": [],
        "awards": [],
        "source": source,
        "parser": parser.as_dict(),
        "validation_errors": [],
    }


def compare_save_bytes(base_save: Path, compare_save: Path) -> Dict[str, Any]:
    base = base_save.read_bytes()
    other = compare_save.read_bytes()
    max_len = max(len(base), len(other))
    ranges: List[Dict[str, Any]] = []
    start: Optional[int] = None
    for index in range(max_len):
        b = base[index] if index < len(base) else None
        c = other[index] if index < len(other) else None
        if b != c and start is None:
            start = index
        elif b == c and start is not None:
            ranges.append({"start": start, "end": index - 1, "length": index - start})
            start = None
    if start is not None:
        ranges.append({"start": start, "end": max_len - 1, "length": max_len - start})
    return {
        "schema_version": READER_SCHEMA_VERSION,
        "package_type": "cfb27_experimental_comparison",
        "base_save": str(base_save),
        "compare_save": str(compare_save),
        "base_sha256": sha256_file(base_save),
        "compare_sha256": sha256_file(compare_save),
        "same_size": len(base) == len(other),
        "changed_byte_total": sum(item["length"] for item in ranges),
        "changed_ranges": ranges[:200],
        "decode_status": "experimental",
        "rule": "Comparison offsets are candidate byte ranges only and cannot promote app data.",
    }


def add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--save-name", default=DEFAULT_SAVE_NAME)
    parser.add_argument("--save-path")
    parser.add_argument("--config", default=str(Path(__file__).with_name("config.example.json")))
    parser.add_argument("--output-root", default="data/dynasty")

