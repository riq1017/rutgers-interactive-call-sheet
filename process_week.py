#!/usr/bin/env python3
from __future__ import annotations

import argparse, csv, hashlib, json, os, re, shutil, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv"}
FINAL_DISPOSITIONS = {"fully_extracted","partially_extracted","duplicate","irrelevant_transition","unreadable_manual_review"}
GENERATED_FILES = [
  "current_team_roster_extracted.json","opponent_roster_extracted.json",
  "current_team_season_stats_extracted.json","opponent_season_stats_extracted.json",
  "recruiting_extracted.json","playbook_extracted.json","play_art_manifest.json",
  "coach_abilities_extracted.json","career_context.json","video_manifest.json",
  "source_truth_summary.json","source_truth_players.json","source_truth_plays.json",
  "source_truth_recruits.json","extraction_confidence.json","screen_inventory.json"
]
STREAMLABS = Path(r"C:\Program Files\Streamlabs OBS\resources\app.asar.unpacked\node_modules\obs-studio-node")
COMMON_TESSERACT_PATHS = [
  Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
  Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
]
REVIEW_STATUSES = {"needs_manual_review", "confirmed", "rejected", "ocr_draft_needs_confirmation"}
PROMOTION_EVIDENCE_KEYS = ("source_video", "source_video_hash", "timestamp", "frame_number", "crop_path")


REVIEW_PACKAGES = {
  "current_team_roster": ("current_team_roster_review", "current_team_roster_fields"),
  "opponent_roster": ("opponent_roster_review", "opponent_roster_fields"),
  "current_team_season_stats": ("current_team_season_stats_review", "current_team_season_stats"),
  "opponent_season_stats": ("opponent_season_stats_review", "opponent_season_stats"),
}

CROP_ZONES = {
  "current_team_roster": [
    {"crop_type": "roster_header", "box": [0.04, 0.10, 0.75, 0.30]},
    {"crop_type": "roster_table", "box": [0.03, 0.30, 0.78, 0.91]},
    {"crop_type": "player_side_card", "box": [0.78, 0.12, 0.98, 0.95]},
  ],
  "opponent_roster": [
    {"crop_type": "roster_header", "box": [0.04, 0.10, 0.75, 0.30]},
    {"crop_type": "roster_table", "box": [0.03, 0.30, 0.78, 0.91]},
    {"crop_type": "player_side_card", "box": [0.78, 0.12, 0.98, 0.95]},
  ],
  "current_team_season_stats": [
    {"crop_type": "stats_header", "box": [0.03, 0.09, 0.82, 0.24]},
    {"crop_type": "stats_table", "box": [0.03, 0.23, 0.80, 0.88]},
    {"crop_type": "player_side_card", "box": [0.80, 0.12, 0.98, 0.95]},
  ],
  "opponent_season_stats": [
    {"crop_type": "stats_header", "box": [0.03, 0.09, 0.82, 0.24]},
    {"crop_type": "stats_table", "box": [0.03, 0.23, 0.80, 0.88]},
    {"crop_type": "player_side_card", "box": [0.80, 0.12, 0.98, 0.95]},
  ],
}

def root() -> Path:
  return Path(__file__).resolve().parent

def now() -> str:
  return datetime.now(timezone.utc).isoformat().replace("+00:00","Z")

def ftime(ts: float) -> str:
  return datetime.fromtimestamp(ts, timezone.utc).isoformat().replace("+00:00","Z")

def read_json(path: Path, fallback: Any) -> Any:
  try:
    return json.loads(path.read_text(encoding="utf-8"))
  except Exception:
    return fallback

def write_json(path: Path, payload: Any) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")

def resolve_ffmpeg(repo: Optional[Path] = None) -> Dict[str, str]:
  repo = repo or root()
  cfg = repo / "video_tools.local.json"
  if cfg.exists():
    data = read_json(cfg, {})
    if data.get("ffmpeg") and data.get("ffprobe") and Path(data["ffmpeg"]).exists() and Path(data["ffprobe"]).exists():
      return {"ffmpeg": str(Path(data["ffmpeg"])), "ffprobe": str(Path(data["ffprobe"])), "source": "local_config"}
  ffmpeg, ffprobe = shutil.which("ffmpeg"), shutil.which("ffprobe")
  if ffmpeg and ffprobe:
    return {"ffmpeg": ffmpeg, "ffprobe": ffprobe, "source": "system_path"}
  sf, sp = STREAMLABS / "ffmpeg.exe", STREAMLABS / "ffprobe.exe"
  if sf.exists() and sp.exists():
    return {"ffmpeg": str(sf), "ffprobe": str(sp), "source": "streamlabs_obs"}
  raise RuntimeError("FFmpeg/FFprobe not found. Add them to PATH, create video_tools.local.json, or install Streamlabs OBS.")

def discover_videos(input_dir: Path) -> List[Path]:
  if not input_dir.exists():
    return []
  return sorted([p for p in input_dir.iterdir() if p.is_file() and p.suffix.lower() in VIDEO_EXTENSIONS], key=lambda p: p.name.lower())

def classify_video_name(name: str) -> Dict[str, Any]:
  n = name.lower()
  table = [
    ("oregon", "playbook", "Playbook", "playbook"),
    ("purdue", "season", "Opponent Season Stats", "opponent_season_stats"),
    ("purdue", "roster", "Opponent Roster", "opponent_roster"),
    ("rutgers", "season", "Current Team Season Stats", "current_team_season_stats"),
    ("rutgers", "recruit", "Recruiting", "recruiting"),
    ("rutgers", "roster", "Current Team Roster", "current_team_roster"),
    ("depth", "", "Depth Chart", "depth_chart"),
  ]
  for a,b,cls,pkg in table:
    if a in n and (not b or b in n):
      return {"classification": cls, "package": pkg, "classification_hints": [f"filename:{a}", f"filename:{b}" if b else "filename:depth"], "classification_method": ["filename_hint","screen_inventory_pending"]}
  return {"classification": "Unknown / Manual Review", "package": "unknown", "classification_hints": ["manual_review_required"], "classification_method": ["filename_hint","screen_inventory_pending"]}

def sha256_file(path: Path) -> str:
  h = hashlib.sha256()
  with path.open("rb") as handle:
    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
      h.update(chunk)
  return h.hexdigest()

def ffprobe_meta(ffprobe: str, video: Path) -> Dict[str, Any]:
  out = subprocess.run([ffprobe,"-v","error","-print_format","json","-show_format","-show_streams",str(video)], capture_output=True, text=True, check=True).stdout
  data = json.loads(out or "{}")
  stream = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), {})
  dur = data.get("format", {}).get("duration") or stream.get("duration")
  return {"duration_seconds": round(float(dur),3) if dur else None, "resolution": {"width": stream.get("width"), "height": stream.get("height")}, "frame_rate": stream.get("avg_frame_rate") or stream.get("r_frame_rate"), "codec": stream.get("codec_name")}

def sample_timestamps(duration: Optional[float], max_samples: int = 8) -> List[float]:
  if not duration or duration <= 0:
    return [0.5]
  count = 4 if duration < 45 else 6 if duration < 180 else max_samples
  start, end = min(1.0, duration * 0.05), max(1.0, duration * 0.92)
  return [round(start + (end - start) * i / max(1, count - 1), 3) for i in range(count)]

def extract_frame(ffmpeg: str, video: Path, output: Path, ts: float) -> bool:
  output.parent.mkdir(parents=True, exist_ok=True)
  cmd = [ffmpeg,"-y","-ss",f"{ts:.3f}","-i",str(video),"-frames:v","1","-q:v","3","-loglevel","error",str(output)]
  res = subprocess.run(cmd, capture_output=True, text=True)
  return res.returncode == 0 and output.exists() and output.stat().st_size > 0

def frame_signature(path: Path) -> str:
  data = path.read_bytes()
  step = max(1, len(data) // 4096)
  return hashlib.sha1(bytes(data[i] for i in range(0, len(data), step)[:4096])).hexdigest()

def short_hash(text: str) -> str:
  return hashlib.sha1(text.encode("utf-8", "ignore")).hexdigest()[:12]

def legacy_playbook(repo: Path) -> List[Dict[str, Any]]:
  data = read_json(repo / "data" / "OREGON_PLAYBOOK_VISIBLE_TRANSCRIPT_VERIFIED.json", [])
  if isinstance(data, dict):
    for key in ("verified_visible_master_inventory","plays","playbook","items"): 
      if isinstance(data.get(key), list):
        return data[key]
    return []
  return data if isinstance(data, list) else []

def play_identity(play: Dict[str, Any], idx: int) -> str:
  return str(play.get("play_id") or play.get("id") or f"legacy_play_{idx+1:03d}")

def evidence(video: Dict[str, Any], screen: Dict[str, Any], confidence: float = 0.35, manual: bool = True) -> Dict[str, Any]:
  return {"source_video": video["filename"], "source_video_hash": video["sha256"], "timestamp": screen.get("timestamp"), "frame_number": screen.get("frame_number"), "confidence": confidence, "verification_status": "manual_review" if manual else "video_verified", "manual_review": manual}

def field(value: Any, ev: Dict[str, Any]) -> Dict[str, Any]:
  return {"value": value, "evidence": dict(ev)}


def resolve_tesseract(repo: Optional[Path] = None) -> Dict[str, Any]:
  repo = repo or root()
  candidates: List[Tuple[str, Optional[str]]] = []
  env_path = os.environ.get("TESSERACT_EXE")
  if env_path:
    candidates.append(("env:TESSERACT_EXE", env_path))
  cfg = repo / "video_tools.local.json"
  if cfg.exists():
    data = read_json(cfg, {})
    candidates.append(("local_config:tesseract", data.get("tesseract")))
    candidates.append(("local_config:tesseract_exe", data.get("tesseract_exe")))
  candidates.append(("system_path", shutil.which("tesseract")))
  for common in COMMON_TESSERACT_PATHS:
    candidates.append(("common_install", str(common)))
  portable_root = repo / "tools" / "portable" / "tesseract"
  candidates.extend([
    ("repo_portable", str(portable_root / "tesseract.exe")),
    ("repo_portable_bin", str(portable_root / "bin" / "tesseract.exe")),
  ])
  for source, candidate in candidates:
    if candidate and Path(candidate).exists():
      return {"available": True, "path": str(Path(candidate)), "source": source, "mode": "optional_tesseract_stdout"}
  return {"available": False, "path": None, "source": "not_found", "mode": "manual_review_only"}

def tesseract_adapter(repo: Optional[Path] = None) -> Dict[str, Any]:
  adapter = resolve_tesseract(repo)
  if not adapter["available"]:
    return adapter
  try:
    result = subprocess.run([adapter["path"], "--version"], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=10)
    first = (result.stdout or result.stderr or "").splitlines()[0] if (result.stdout or result.stderr) else "unknown"
    adapter["version"] = first.strip()
  except Exception:
    adapter["version"] = "unknown"
  return adapter

def crop_box(width: int, height: int, box: List[float]) -> tuple:
  left = max(0, min(width - 1, int(width * box[0])))
  top = max(0, min(height - 1, int(height * box[1])))
  right = max(left + 1, min(width, int(width * box[2])))
  bottom = max(top + 1, min(height, int(height * box[3])))
  return (left, top, right, bottom)

def ocr_crop(crop_path: Path, adapter: Dict[str, Any]) -> Dict[str, Any]:
  if not adapter.get("available"):
    return {"value": None, "confidence": 0.0, "status": "manual_review"}
  try:
    result = subprocess.run([adapter["path"], str(crop_path), "stdout", "--psm", "6"], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20)
    value = (result.stdout or "").strip()
    return {"value": value or None, "confidence": 0.55 if value else 0.0, "status": "ocr_draft" if value else "manual_review"}
  except Exception:
    return {"value": None, "confidence": 0.0, "status": "manual_review"}

def crop_evidence(video: Dict[str, Any], screen: Dict[str, Any], crop_rel: str, confidence: float, status: str) -> Dict[str, Any]:
  return {
    "source_video": video["filename"],
    "source_video_hash": video["sha256"],
    "timestamp": screen.get("timestamp"),
    "frame_number": screen.get("frame_number"),
    "crop_path": crop_rel,
    "confidence": confidence,
    "verification_status": status,
    "manual_review": status != "video_verified",
  }

def review_field(value: Any, ev: Dict[str, Any], field_name: str, review_status: str) -> Dict[str, Any]:
  return {
    "field_name": field_name,
    "value": value,
    "evidence": ev,
    "review_status": review_status,
  }


def field_key(label: str) -> str:
  clean = re.sub(r"[^A-Za-z0-9]+", "_", str(label or "").strip().lower()).strip("_")
  return clean or "unknown"

def candidate_field(name: str, value: Any, ev: Dict[str, Any], confidence: float = 0.45) -> Dict[str, Any]:
  evidence_obj = dict(ev)
  evidence_obj["confidence"] = confidence
  evidence_obj["verification_status"] = "ocr_draft"
  evidence_obj["manual_review"] = True
  return {
    "field_name": field_key(name),
    "label": name,
    "value": value if value != "" else None,
    "evidence": evidence_obj,
    "review_status": "ocr_draft_needs_confirmation",
  }

def meaningful_ocr_lines(text: Any) -> List[str]:
  return [line.strip() for line in str(text or "").splitlines() if line.strip()]

def parse_side_card_text(text: Any, package: str, crop_id: str, ev: Dict[str, Any]) -> List[Dict[str, Any]]:
  lines = meaningful_ocr_lines(text)
  joined = "\n".join(lines)
  candidates: List[Dict[str, Any]] = []
  fields: List[Dict[str, Any]] = []
  # Names are often split across lines in the side card. Keep the OCR value as draft.
  upper_words = [line for line in lines if re.fullmatch(r"[A-Z][A-Z .'-]{2,}", line)]
  if upper_words:
    fields.append(candidate_field("visible_name_text", " ".join(upper_words[:3]).title(), ev, 0.35))
  pos = re.search(r"\b(QB|HB|RB|WR|TE|LT|LG|C|RG|RT|LE|RE|LEDG|REDG|DT|MLB|OLB|SAM|CB|FS|SS|K|P)\b(?:\s*\([LR]\))?\s*\|?\s*#?(\d+)?", joined, re.I)
  if pos:
    fields.append(candidate_field("position", pos.group(1).upper(), ev, 0.55))
    if pos.group(2):
      fields.append(candidate_field("jersey", pos.group(2), ev, 0.55))
  cls = re.search(r"\b(FR|SO|JR|SR)(?:\s*\(RS\))?\b", joined, re.I)
  if cls:
    fields.append(candidate_field("class", cls.group(0).upper(), ev, 0.50))
  htwt = re.search(r"(\d+'\d+\")\s*\|?\s*(\d{2,3})\s*(?:lbs|Ibs|LB|IBS)", joined, re.I)
  if htwt:
    fields.append(candidate_field("height", htwt.group(1), ev, 0.60))
    fields.append(candidate_field("weight", f"{htwt.group(2)} lbs", ev, 0.60))
  archetype = re.search(r"ARCHETYPE\s+([A-Za-z ]{3,40})(?:\n|CLASS|HEIGHT|HOMETOWN)", joined, re.I)
  if archetype:
    fields.append(candidate_field("archetype", archetype.group(1).strip(), ev, 0.45))
  hometown = re.search(r"HOMETOWN\s+([A-Za-z .,'-]+)", joined, re.I)
  if hometown:
    fields.append(candidate_field("hometown", hometown.group(1).strip(), ev, 0.45))
  trait = re.search(r"DEV\s*TRAIT\s+([A-Za-z ]+)", joined, re.I)
  if trait:
    fields.append(candidate_field("development_trait", trait.group(1).strip(), ev, 0.45))
  if fields:
    candidates.append({
      "candidate_id": f"{crop_id}-profile-001",
      "candidate_type": "player_profile_side_card",
      "source_crop_id": crop_id,
      "package": package,
      "fields": fields,
      "review_status": "ocr_draft_needs_confirmation",
      "raw_ocr_excerpt": joined[:500],
    })
  return candidates

def parse_table_lines(text: Any, package: str, crop_id: str, ev: Dict[str, Any], candidate_type: str) -> List[Dict[str, Any]]:
  lines = meaningful_ocr_lines(text)
  candidates: List[Dict[str, Any]] = []
  header_tokens: List[str] = []
  for line in lines:
    tokens = line.split()
    upper_count = sum(1 for token in tokens if re.fullmatch(r"[A-Z0-9+%/.-]+", token))
    if len(tokens) >= 4 and upper_count >= 3 and any(token.upper() in {"NAME", "POS", "OVR", "YARDS", "YDS", "CAR", "COMP", "ATT", "TD", "INT", "SACK", "SPD", "ACC", "AWR"} for token in tokens):
      header_tokens = [field_key(token.upper()) for token in tokens]
      continue
    if not re.match(r"^[A-Za-z][A-Za-z.']+", line):
      continue
    nums = re.findall(r"[-+]?\d+(?:\.\d+)?%?", line)
    if not nums:
      continue
    # Split at the first numeric token; the front is the best OCR name/position draft.
    first_num = re.search(r"[-+]?\d", line)
    prefix = line[:first_num.start()].strip() if first_num else line
    prefix_tokens = prefix.split()
    name_parts = []
    pos_value = None
    for token in prefix_tokens:
      if token.upper() in {"QB","HB","RB","WR","TE","LT","LG","C","RG","RT","LE","RE","LEDG","REDG","DT","MLB","OLB","SAM","CB","FS","SS","K","P"}:
        pos_value = token.upper()
      else:
        name_parts.append(token)
    fields = [candidate_field("name", " ".join(name_parts).strip(), ev, 0.45)]
    if pos_value:
      fields.append(candidate_field("position", pos_value, ev, 0.45))
    labels = header_tokens[-len(nums):] if header_tokens and len(header_tokens) >= len(nums) else []
    if not labels:
      labels = [f"stat_{i+1}" for i in range(len(nums))]
    for label, value in zip(labels, nums):
      fields.append(candidate_field(label, value, ev, 0.42))
    candidates.append({
      "candidate_id": f"{crop_id}-{candidate_type}-{len(candidates)+1:03d}",
      "candidate_type": candidate_type,
      "source_crop_id": crop_id,
      "package": package,
      "fields": fields,
      "review_status": "ocr_draft_needs_confirmation",
      "raw_ocr_excerpt": line[:500],
    })
  return candidates

def structured_candidates_from_crop(package: str, crop_record: Dict[str, Any]) -> List[Dict[str, Any]]:
  field_obj = (crop_record.get("fields") or [{}])[0]
  text = field_obj.get("value")
  ev = field_obj.get("evidence") or {}
  crop_type = crop_record.get("crop_type")
  crop_id = crop_record.get("crop_id")
  if not text:
    return []
  if crop_type == "player_side_card":
    return parse_side_card_text(text, package, crop_id, ev)
  if crop_type == "roster_table":
    return parse_table_lines(text, package, crop_id, ev, "roster_table_row")
  if crop_type == "stats_table":
    return parse_table_lines(text, package, crop_id, ev, "season_stats_row")
  return []

def generate_roster_stats_review(repo: Path, videos: List[Dict[str, Any]], screens: List[Dict[str, Any]], extract_mode: Optional[str]) -> Dict[str, Any]:
  if extract_mode != "roster_stats":
    return {"review_packages": {}, "csv_files": [], "crop_count": 0, "ocr": tesseract_adapter(repo)}
  try:
    from PIL import Image
  except Exception as exc:
    raise RuntimeError(f"PIL is required for roster_stats review crops: {exc}")
  adapter = tesseract_adapter(repo)
  by_video = {v["filename"]: v for v in videos}
  review_root = repo / "data" / "generated" / "review"
  crop_root = repo / "assets" / "review_crops"
  review_root.mkdir(parents=True, exist_ok=True)
  crop_root.mkdir(parents=True, exist_ok=True)
  packages: Dict[str, Dict[str, Any]] = {}
  csv_rows_by_package: Dict[str, List[Dict[str, Any]]] = {}
  crop_count = 0
  for package, (package_type, field_group) in REVIEW_PACKAGES.items():
    packages[package] = {
      "package_type": package_type,
      "schema_version": "video_source_truth_review_v1",
      "source_of_truth": "input_videos",
      "ocr": adapter,
      "field_group": field_group,
      "crops": [],
      "structured_candidates": [],
      "promoted_fields": [],
      "counts": {"crops": 0, "ocr_draft_fields": 0, "manual_review_fields": 0, "structured_candidate_rows": 0, "promoted_fields": 0, "omitted_fields": 0},
    }
    csv_rows_by_package[package] = []
  for screen in screens:
    package = screen.get("detected_entity")
    if package not in CROP_ZONES or screen.get("duplicate_screen_status") == "duplicate" or not screen.get("reference_frame"):
      continue
    video = by_video[screen["source_video"]]
    source_frame = repo / screen["reference_frame"]
    if not source_frame.exists():
      continue
    with Image.open(source_frame) as img:
      width, height = img.size
      for zone in CROP_ZONES[package]:
        crop_id = f"{screen['screen_id']}-{zone['crop_type']}"
        rel = Path("assets") / "review_crops" / package / f"{crop_id}.jpg"
        crop_path_abs = repo / rel
        crop_path_abs.parent.mkdir(parents=True, exist_ok=True)
        cropped = img.crop(crop_box(width, height, zone["box"]))
        cropped.save(crop_path_abs, "JPEG", quality=92)
        ocr = ocr_crop(crop_path_abs, adapter)
        status = "ocr_draft" if ocr["status"] == "ocr_draft" else "manual_review"
        confidence = ocr["confidence"] if status == "ocr_draft" else 0.0
        rel_s = str(rel).replace("\\", "/")
        ev = crop_evidence(video, screen, rel_s, confidence, status)
        value = ocr["value"] if status == "ocr_draft" else None
        rf = review_field(value, ev, zone["crop_type"], "ocr_draft_needs_confirmation" if status == "ocr_draft" else "needs_manual_review")
        crop_record = {
          "crop_id": crop_id,
          "screen_id": screen["screen_id"],
          "source_video": screen["source_video"],
          "crop_type": zone["crop_type"],
          "crop_path": rel_s,
          "box_percent": zone["box"],
          "fields": [rf],
          "manual_review": True,
          "promotion_status": "not_promoted",
        }
        packages[package]["crops"].append(crop_record)
        packages[package]["counts"]["crops"] += 1
        packages[package]["counts"]["ocr_draft_fields" if status == "ocr_draft" else "manual_review_fields"] += 1
        csv_rows_by_package[package].append({
          "package": package,
          "crop_id": crop_id,
          "crop_type": zone["crop_type"],
          "source_video": screen["source_video"],
          "timestamp": screen.get("timestamp"),
          "frame_number": screen.get("frame_number"),
          "crop_path": rel_s,
          "field_name": zone["crop_type"],
          "value": value if value is not None else "",
          "review_status": rf["review_status"],
          "confidence": confidence,
        })
        crop_count += 1
  csv_files = []
  for package, payload in packages.items():
    structured_rows: List[Dict[str, Any]] = []
    for crop in payload.get("crops", []):
      candidates = structured_candidates_from_crop(package, crop)
      payload["structured_candidates"].extend(candidates)
      payload["counts"]["structured_candidate_rows"] += len(candidates)
      for candidate in candidates:
        for item in candidate.get("fields", []):
          ev = item.get("evidence") or {}
          structured_rows.append({
            "package": package,
            "candidate_id": candidate.get("candidate_id"),
            "candidate_type": candidate.get("candidate_type"),
            "source_crop_id": candidate.get("source_crop_id"),
            "field_name": item.get("field_name"),
            "label": item.get("label"),
            "value": item.get("value") if item.get("value") is not None else "",
            "review_status": item.get("review_status"),
            "source_video": ev.get("source_video"),
            "timestamp": ev.get("timestamp"),
            "frame_number": ev.get("frame_number"),
            "crop_path": ev.get("crop_path"),
            "confidence": ev.get("confidence"),
          })
    json_name = f"{package}_review.json"
    write_json(review_root / json_name, payload)
    csv_name = f"{package}_review.csv"
    csv_files.append(f"data/generated/review/{csv_name}")
    with (review_root / csv_name).open("w", encoding="utf-8", newline="") as handle:
      fieldnames = ["package","crop_id","crop_type","source_video","timestamp","frame_number","crop_path","field_name","value","review_status","confidence"]
      writer = csv.DictWriter(handle, fieldnames=fieldnames)
      writer.writeheader()
      writer.writerows(csv_rows_by_package[package])
    structured_csv_name = f"{package}_structured_review.csv"
    csv_files.append(f"data/generated/review/{structured_csv_name}")
    with (review_root / structured_csv_name).open("w", encoding="utf-8", newline="") as handle:
      fieldnames = ["package","candidate_id","candidate_type","source_crop_id","field_name","label","value","review_status","source_video","timestamp","frame_number","crop_path","confidence"]
      writer = csv.DictWriter(handle, fieldnames=fieldnames)
      writer.writeheader()
      writer.writerows(structured_rows)
  return {"review_packages": packages, "csv_files": csv_files, "crop_count": crop_count, "ocr": adapter}

def merge_review_promotions(outputs: Dict[str, Any], review_result: Dict[str, Any]) -> None:
  # This pass intentionally promotes nothing automatically. Values become
  # video-backed only after OCR confidence or manual review confirmation.
  mapping = {
    "current_team_roster": "current_team_roster_extracted.json",
    "opponent_roster": "opponent_roster_extracted.json",
    "current_team_season_stats": "current_team_season_stats_extracted.json",
    "opponent_season_stats": "opponent_season_stats_extracted.json",
  }
  for package, filename in mapping.items():
    if filename in outputs and package in review_result.get("review_packages", {}):
      outputs[filename]["review_package"] = f"data/generated/review/{package}_review.json"
      outputs[filename]["review_csv"] = f"data/generated/review/{package}_review.csv"
      outputs[filename]["promotion_policy"] = "Only reviewed/confirmed fields or OCR-confident draft fields may be promoted."
      outputs[filename]["counts"]["promoted_fields"] = 0
      outputs[filename]["counts"]["review_crops"] = review_result["review_packages"][package]["counts"]["crops"]


def normalize_review_status(status: Any) -> str:
  status = str(status or "needs_manual_review").strip()
  if status == "needs_confirmation":
    return "ocr_draft_needs_confirmation"
  return status if status in REVIEW_STATUSES else "needs_manual_review"

def review_package_paths(repo: Path, package: str) -> Tuple[Path, Path]:
  return (
    repo / "data" / "generated" / "review" / f"{package}_review.json",
    repo / "data" / "generated" / "review" / f"{package}_review.csv",
  )

def overlay_review_csv(repo: Path, package: str, payload: Dict[str, Any]) -> None:
  _, csv_path = review_package_paths(repo, package)
  if csv_path.exists():
    rows = {}
    with csv_path.open("r", encoding="utf-8", newline="") as handle:
      for row in csv.DictReader(handle):
        rows[(row.get("crop_id"), row.get("field_name"))] = row
    for crop in payload.get("crops", []):
      for item in crop.get("fields", []):
        row = rows.get((crop.get("crop_id"), item.get("field_name")))
        if not row:
          continue
        item["value"] = row.get("value") if row.get("value") != "" else None
        item["review_status"] = normalize_review_status(row.get("review_status"))
        try:
          item.setdefault("evidence", {})["confidence"] = float(row.get("confidence") or item.get("evidence", {}).get("confidence") or 0)
        except ValueError:
          pass
  structured_csv = repo / "data" / "generated" / "review" / f"{package}_structured_review.csv"
  if not structured_csv.exists():
    return
  structured_rows = {}
  with structured_csv.open("r", encoding="utf-8", newline="") as handle:
    for row in csv.DictReader(handle):
      structured_rows[(row.get("candidate_id"), row.get("field_name"))] = row
  for candidate in payload.get("structured_candidates", []):
    for item in candidate.get("fields", []):
      row = structured_rows.get((candidate.get("candidate_id"), item.get("field_name")))
      if not row:
        continue
      item["value"] = row.get("value") if row.get("value") != "" else None
      item["review_status"] = normalize_review_status(row.get("review_status"))
      try:
        item.setdefault("evidence", {})["confidence"] = float(row.get("confidence") or item.get("evidence", {}).get("confidence") or 0)
      except ValueError:
        pass

def confirmed_value_is_blank(value: Any) -> bool:
  return value is None or (isinstance(value, str) and not value.strip())

def promoted_field_record(package: str, crop: Dict[str, Any], item: Dict[str, Any], errors: List[str]) -> Optional[Dict[str, Any]]:
  status = normalize_review_status(item.get("review_status"))
  item["review_status"] = status
  if status != "confirmed":
    return None
  if confirmed_value_is_blank(item.get("value")):
    errors.append(f"{package}:{crop.get('crop_id')}:{item.get('field_name')} confirmed blank value")
    return None
  evidence_obj = dict(item.get("evidence") or {})
  for key in PROMOTION_EVIDENCE_KEYS:
    if evidence_obj.get(key) in (None, ""):
      errors.append(f"{package}:{crop.get('crop_id')}:{item.get('field_name')} missing evidence {key}")
  evidence_obj["review_status"] = "confirmed"
  evidence_obj["verification_status"] = "video_review_confirmed"
  evidence_obj["manual_review"] = False
  return {
    "package": package,
    "crop_id": crop.get("crop_id"),
    "field_name": item.get("field_name"),
    "value": item.get("value"),
    "evidence": evidence_obj,
  }

def apply_review_import(repo: Path, outputs: Dict[str, Any]) -> Dict[str, Any]:
  mapping = {
    "current_team_roster": "current_team_roster_extracted.json",
    "opponent_roster": "opponent_roster_extracted.json",
    "current_team_season_stats": "current_team_season_stats_extracted.json",
    "opponent_season_stats": "opponent_season_stats_extracted.json",
  }
  report = {"package_type": "review_import_report", "generated_at": now(), "source_of_truth": "input_videos", "packages": {}, "errors": [], "promoted_total": 0}
  for package, filename in mapping.items():
    json_path, csv_path = review_package_paths(repo, package)
    payload = read_json(json_path, {"crops": [], "counts": {}})
    overlay_review_csv(repo, package, payload)
    promoted: List[Dict[str, Any]] = []
    package_errors: List[str] = []
    status_counts = {status: 0 for status in REVIEW_STATUSES}
    for crop in payload.get("crops", []):
      for item in crop.get("fields", []):
        status = normalize_review_status(item.get("review_status"))
        status_counts[status] = status_counts.get(status, 0) + 1
        record = promoted_field_record(package, crop, item, package_errors)
        if record:
          crop_path = repo / record["evidence"]["crop_path"]
          if not crop_path.exists():
            package_errors.append(f"{package}:{record['crop_id']} crop path does not exist")
          promoted.append(record)
    for candidate in payload.get("structured_candidates", []):
      pseudo_crop = {"crop_id": candidate.get("candidate_id")}
      for item in candidate.get("fields", []):
        status = normalize_review_status(item.get("review_status"))
        status_counts[status] = status_counts.get(status, 0) + 1
        record = promoted_field_record(package, pseudo_crop, item, package_errors)
        if record:
          record["candidate_id"] = candidate.get("candidate_id")
          record["candidate_type"] = candidate.get("candidate_type")
          record["source_crop_id"] = candidate.get("source_crop_id")
          crop_path = repo / record["evidence"]["crop_path"]
          if not crop_path.exists():
            package_errors.append(f"{package}:{record['crop_id']} crop path does not exist")
          promoted.append(record)
    if filename in outputs:
      outputs[filename]["review_package"] = f"data/generated/review/{package}_review.json"
      outputs[filename]["review_csv"] = f"data/generated/review/{package}_review.csv"
      outputs[filename]["promotion_policy"] = "Only fields explicitly marked confirmed are promoted."
      outputs[filename]["promoted_fields"] = promoted
      outputs[filename].setdefault("counts", {})["promoted_fields"] = len(promoted)
      outputs[filename].setdefault("counts", {})["review_crops"] = len(payload.get("crops", []))
    report["packages"][package] = {
      "review_json": f"data/generated/review/{package}_review.json",
      "review_csv": f"data/generated/review/{package}_review.csv",
      "review_json_exists": json_path.exists(),
      "review_csv_exists": csv_path.exists(),
      "status_counts": status_counts,
      "promoted_fields": len(promoted),
      "errors": package_errors,
    }
    report["errors"].extend(package_errors)
    report["promoted_total"] += len(promoted)
  return report

def validate_review_promotions(repo: Path, outputs: Dict[str, Any]) -> List[str]:
  errors: List[str] = []
  for filename in ("current_team_roster_extracted.json", "opponent_roster_extracted.json", "current_team_season_stats_extracted.json", "opponent_season_stats_extracted.json"):
    for idx, item in enumerate(outputs.get(filename, {}).get("promoted_fields", [])):
      ev = item.get("evidence") or {}
      if ev.get("review_status") != "confirmed":
        errors.append(f"{filename}.promoted_fields[{idx}] not confirmed")
      for key in PROMOTION_EVIDENCE_KEYS:
        if ev.get(key) in (None, ""):
          errors.append(f"{filename}.promoted_fields[{idx}] missing {key}")
      crop = repo / str(ev.get("crop_path", ""))
      if ev.get("crop_path") and not crop.exists():
        errors.append(f"{filename}.promoted_fields[{idx}] missing crop file")
  return errors

def build_manifest(repo: Path, tools: Dict[str,str], selected: Optional[str], force: bool) -> Dict[str, Any]:
  files = discover_videos(repo / "input_videos")
  if selected:
    files = [p for p in files if p.name.lower() == selected.lower()]
    if not files:
      raise SystemExit(f"Video not found in input_videos: {selected}")
  cache_path = repo / "data" / "generated" / ".video_cache.json"
  cache = read_json(cache_path, {})
  videos = []
  for video in files:
    h, st = sha256_file(video), video.stat()
    cls = classify_video_name(video.name)
    status = "cached" if cache.get(video.name) == h and not force else "processed"
    videos.append({"filename": video.name, "sha256": h, "size_bytes": st.st_size, "created_at": ftime(st.st_ctime), "modified_at": ftime(st.st_mtime), "processing_status": status, "processing_time_seconds": 0, **cls, **ffprobe_meta(tools["ffprobe"], video)})
    cache[video.name] = h
  return {"package_type": "video_manifest", "schema_version": "video_source_truth_first_pass_v1", "generated_at": now(), "source_of_truth": "input_videos", "ffmpeg": tools, "videos": videos, "_cache": cache}

def build_screens(repo: Path, ffmpeg: str, videos: List[Dict[str, Any]], force: bool, review: bool) -> List[Dict[str, Any]]:
  seen, screens = {}, []
  for video in videos:
    src = repo / "input_videos" / video["filename"]
    stem = Path(video["filename"]).stem.replace(" ", "_")
    for idx, ts in enumerate(sample_timestamps(video.get("duration_seconds"))):
      rel = Path("assets") / "reference_frames" / stem / f"screen_{idx+1:03d}_{int(ts):05d}s.jpg"
      out = repo / rel
      ok = out.exists() and not force or extract_frame(ffmpeg, src, out, ts)
      sig = frame_signature(out) if ok else f"missing-{video['sha256']}-{idx}"
      dup = seen.get(sig)
      sid = f"screen-{short_hash(video['sha256'] + str(idx))}"
      if dup:
        disposition, status, manual, confidence = "duplicate", "duplicate", False, 0.95
      elif ok:
        seen[sig] = sid
        disposition, status, manual, confidence = ("unreadable_manual_review","manual_review_required",True,0.35) if review else ("partially_extracted","frame_captured_no_ocr",True,0.35)
      else:
        disposition, status, manual, confidence = "unreadable_manual_review", "frame_capture_failed", True, 0.0
      screens.append({"screen_id": sid, "source_video": video["filename"], "video_hash": video["sha256"], "timestamp": f"00:{int(ts//60):02d}:{int(ts%60):02d}", "timestamp_seconds": ts, "frame_number": int(round(ts*60)), "screen_classification": video["classification"], "detected_entity": video["package"], "detected_entity_type": video["package"], "extraction_status": status, "duplicate_screen_status": "duplicate" if dup else "unique", "duplicate_of": dup, "disposition": disposition, "confidence": confidence, "manual_review": manual, "reference_frame": str(rel).replace("\\","/") if ok else None, "frame_hash": sig})
  return screens

def manual_record(video: Dict[str, Any], screen: Dict[str, Any], record_type: str) -> Dict[str, Any]:
  ev = evidence(video, screen)
  return {"record_id": f"manual-{record_type}-{screen['screen_id']}", "record_type": record_type, "fields": {"source_screen_type": field(screen["screen_classification"], ev), "visible_text": field(None, ev)}, "additional_visible_fields": {}, "manual_review": True, "verification_status": "manual_review", "completeness": {"visible_fields_detected": 1, "fields_extracted_successfully": 0, "fields_unreadable": 1, "fields_manual_review": 1, "fields_omitted": 0}}

def records_for(videos: List[Dict[str, Any]], screens: List[Dict[str, Any]], package: str, record_type: str) -> List[Dict[str, Any]]:
  out = []
  by_name = {v["filename"]: v for v in videos}
  for s in screens:
    if s["detected_entity"] == package and s["duplicate_screen_status"] == "unique":
      out.append(manual_record(by_name[s["source_video"]], s, record_type))
  return out

def extraction_package(videos, screens, package_type, package, record_type):
  recs = records_for(videos, screens, package, record_type)
  return {"package_type": package_type, "schema_version": "video_source_truth_first_pass_v1", "source_of_truth": "input_videos", "records": recs, "manual_review_records": [r["record_id"] for r in recs], "counts": {"records": len(recs), "complete_records": 0, "partial_records": 0, "manual_review_records": len(recs), "omitted_fields": 0}}

def per_video_counts(videos, screens):
  rows = []
  for v in videos:
    ss = [s for s in screens if s["source_video"] == v["filename"]]
    rows.append({"video": v["filename"], "type": v["classification"], "players": 0, "complete_cards": 0, "partial_cards": 0, "plays": 0, "recruits": 0, "duplicates_removed": sum(s["disposition"]=="duplicate" for s in ss), "unreadable_records": sum(bool(s["manual_review"]) for s in ss), "confidence": round(sum(s["confidence"] for s in ss) / max(1, len(ss)), 3), "screen_count": len(ss)})
  return rows

def build_outputs(repo: Path, manifest: Dict[str, Any], screens: List[Dict[str, Any]]) -> Dict[str, Any]:
  videos, legacy = manifest["videos"], legacy_playbook(repo)
  legacy_unverified = [{"play_id": play_identity(p, i), "legacy_index": i+1, "legacy_play": p, "verification_status": "legacy_unverified", "reason": "Comparison baseline only until video verifies formation and play name."} for i,p in enumerate(legacy)]
  by_name = {v["filename"]: v for v in videos}
  manual_plays = []
  for s in [s for s in screens if s["detected_entity"] == "playbook" and s["duplicate_screen_status"] == "unique"]:
    ev = evidence(by_name[s["source_video"]], s)
    manual_plays.append({"manual_review_id": f"play-screen-{s['screen_id']}", "formation": field(None, ev), "play_name": field(None, ev), "play_art_image": field(s.get("reference_frame"), ev), "verification_status": "manual_review", "reason": "Formation and play name need manual review/OCR before binding."})
  rows = per_video_counts(videos, screens)
  totals = {"unique_players": 0, "unique_plays": 0, "unique_recruits": 0, "complete_player_cards": 0, "partial_player_cards": 0, "duplicates_removed": sum(r["duplicates_removed"] for r in rows), "unreadable_records": sum(r["unreadable_records"] for r in rows), "confidence_percentage": round(100 * sum(r["confidence"] for r in rows) / max(1,len(rows)), 1), "legacy_play_baseline": len(legacy), "video_verified_plays": 0}
  cur_roster = extraction_package(videos, screens, "current_team_roster_extracted", "current_team_roster", "player_card")
  opp_roster = extraction_package(videos, screens, "opponent_roster_extracted", "opponent_roster", "player_card")
  recruiting = extraction_package(videos, screens, "recruiting_extracted", "recruiting", "recruiting_screen")
  return {
    "video_manifest.json": {k:v for k,v in manifest.items() if k != "_cache"},
    "screen_inventory.json": {"package_type": "screen_inventory", "schema_version": "video_source_truth_first_pass_v1", "generated_at": now(), "screen_count": len(screens), "final_dispositions": sorted(FINAL_DISPOSITIONS), "screens": screens},
    "current_team_roster_extracted.json": cur_roster,
    "opponent_roster_extracted.json": opp_roster,
    "current_team_season_stats_extracted.json": extraction_package(videos, screens, "current_team_season_stats_extracted", "current_team_season_stats", "stat_screen"),
    "opponent_season_stats_extracted.json": extraction_package(videos, screens, "opponent_season_stats_extracted", "opponent_season_stats", "stat_screen"),
    "recruiting_extracted.json": recruiting,
    "coach_abilities_extracted.json": {"package_type": "coach_abilities_extracted", "schema_version": "video_source_truth_first_pass_v1", "source_of_truth": "input_videos", "coach_abilities": [], "player_abilities": [], "separation_rule": "coach abilities are never mixed with player abilities", "counts": {"coach_abilities": 0, "manual_review_records": 0, "omitted_fields": 0}},
    "playbook_extracted.json": {"package_type": "playbook_extracted", "schema_version": "video_source_truth_first_pass_v1", "source_of_truth": "input_videos", "legacy_baseline_count": len(legacy), "video_verified_plays": [], "legacy_unverified_plays": legacy_unverified, "manual_review_plays": manual_plays, "conflicted_plays": [], "counts": {"legacy_baseline": len(legacy), "video_verified": 0, "legacy_unverified": len(legacy_unverified), "manual_review": len(manual_plays), "conflicted": 0, "omitted_fields": 0}},
    "play_art_manifest.json": {"package_type": "play_art_manifest", "schema_version": "video_source_truth_first_pass_v1", "source_of_truth": "input_videos", "bindings": [], "manual_review_art_frames": manual_plays, "binding_rule": "play art binds only after formation and play name are confidently verified", "counts": {"verified_bindings": 0, "manual_review_frames": len(manual_plays), "omitted_fields": 0}},
    "career_context.json": {"package_type": "career_context", "schema_version": "video_source_truth_first_pass_v1", "active_adapter": "cfb27", "active_context": "Rutgers Season 2 Week 6 vs Purdue", "current_team": "Rutgers", "current_opponent": "Purdue", "active_playbook_package": "Oregon", "source_of_truth": "input_videos"},
    "source_truth_summary.json": {"package_type": "source_truth_summary", "schema_version": "video_source_truth_first_pass_v1", "generated_at": now(), "source_of_truth": "input_videos", "video_count": len(videos), "screen_count": len(screens), "consolidated_totals": totals, "per_video_counts": rows},
    "source_truth_players.json": {"package_type": "source_truth_players", "source_of_truth": "input_videos", "players": [], "manual_review_screens": cur_roster["records"] + opp_roster["records"], "counts": {"players": 0, "manual_review_records": len(cur_roster["records"] + opp_roster["records"]), "omitted_fields": 0}},
    "source_truth_plays.json": {"package_type": "source_truth_plays", "source_of_truth": "input_videos", "video_verified_plays": [], "legacy_unverified_count": len(legacy_unverified), "manual_review_plays": manual_plays, "counts": {"video_verified": 0, "legacy_unverified": len(legacy_unverified), "manual_review": len(manual_plays), "omitted_fields": 0}},
    "source_truth_recruits.json": {"package_type": "source_truth_recruits", "source_of_truth": "input_videos", "recruits": [], "manual_review_screens": recruiting["records"], "counts": {"recruits": 0, "manual_review_records": len(recruiting["records"]), "omitted_fields": 0}},
    "extraction_confidence.json": {"package_type": "extraction_confidence", "source_of_truth": "input_videos", "per_video": rows, "overall_confidence": totals["confidence_percentage"], "ocr_status": "not_enabled_first_runnable_pass"},
  }

def walk_evidence(obj: Any, loc: str, errors: List[str]) -> None:
  if isinstance(obj, dict):
    if "value" in obj:
      ev = obj.get("evidence") or {}
      for k in ("source_video","source_video_hash","timestamp","frame_number","confidence","verification_status","manual_review"):
        if k not in ev:
          errors.append(f"{loc}.{k}")
    for k,v in obj.items():
      walk_evidence(v, f"{loc}.{k}", errors)
  elif isinstance(obj, list):
    for i,v in enumerate(obj):
      walk_evidence(v, f"{loc}[{i}]", errors)

def validate_generated(repo: Path) -> List[str]:
  gen, errors = repo / "data" / "generated", []
  for name in GENERATED_FILES:
    if not (gen / name).exists():
      errors.append(f"missing {name}")
  inv = read_json(gen / "screen_inventory.json", {"screens":[]})
  for s in inv.get("screens", []):
    if s.get("disposition") not in FINAL_DISPOSITIONS:
      errors.append(f"bad disposition {s.get('screen_id')}")
  pb = read_json(gen / "playbook_extracted.json", {})
  if pb.get("legacy_baseline_count") != 192:
    errors.append("legacy baseline not 192")
  for key in ("video_verified_plays","legacy_unverified_plays","manual_review_plays","conflicted_plays"):
    if not isinstance(pb.get(key), list):
      errors.append(f"missing play group {key}")
  for name in GENERATED_FILES:
    walk_evidence(read_json(gen / name, {}), name, errors)
  return errors

def table(headers, rows) -> str:
  return "| " + " | ".join(headers) + " |\n| " + " | ".join(["---"] * len(headers)) + " |\n" + "\n".join("| " + " | ".join(str(v) for v in row) + " |" for row in rows) + "\n"

def write_reports(repo: Path, outputs: Dict[str, Any], errors: List[str], elapsed: float, review_result: Optional[Dict[str, Any]] = None, review_import_report: Optional[Dict[str, Any]] = None) -> None:
  reports = repo / "reports"; reports.mkdir(exist_ok=True)
  rows = outputs["source_truth_summary.json"]["per_video_counts"]
  count_table = table(["Video","Type","Players","Complete Cards","Partial Cards","Plays","Recruits","Duplicates Removed","Unreadable Records","Confidence"], [[r["video"],r["type"],r["players"],r["complete_cards"],r["partial_cards"],r["plays"],r["recruits"],r["duplicates_removed"],r["unreadable_records"],r["confidence"]] for r in rows])
  (reports / "per_video_verified_counts.md").write_text("# Per-Video Verified Counts\n\n" + count_table, encoding="utf-8")
  screens = outputs["screen_inventory.json"]["screens"]
  screen_table = table(["Video","Timestamp","Frame","Class","Entity","Disposition","Confidence","Manual Review"], [[s["source_video"],s["timestamp"],s["frame_number"],s["screen_classification"],s["detected_entity"],s["disposition"],s["confidence"],s["manual_review"]] for s in screens])
  (reports / "screen_inventory_report.md").write_text("# Screen Inventory Report\n\n" + screen_table, encoding="utf-8")
  manual = [s for s in screens if s["manual_review"]]
  (reports / "manual_review_required.md").write_text("# Manual Review Required\n\n" + table(["Video","Timestamp","Entity","Reason"], [[s["source_video"],s["timestamp"],s["detected_entity"],s["extraction_status"]] for s in manual]), encoding="utf-8")
  review_result = review_result or {}
  review_lines = []
  for package, payload in (review_result.get("review_packages") or {}).items():
    review_lines.append(f"- {package}: {payload['counts']['crops']} crops, {payload['counts']['manual_review_fields']} manual-review fields, {payload['counts']['ocr_draft_fields']} OCR draft fields, {payload['counts'].get('structured_candidate_rows', 0)} structured candidate rows")
  (reports / "roster_stats_review_report.md").write_text("# Roster + Stats Review Report\n\n" + ("\n".join(review_lines) if review_lines else "Roster/stats extraction was not requested for this run.") + "\n", encoding="utf-8")
  import_report = review_import_report or {"promoted_total": 0, "packages": {}, "errors": []}
  import_lines = [f"# Review Import Report\n\nPromoted fields: {import_report.get('promoted_total', 0)}\n"]
  for package, payload in import_report.get("packages", {}).items():
    import_lines.append(f"- {package}: {payload.get('promoted_fields', 0)} promoted, statuses {payload.get('status_counts', {})}")
  if import_report.get("errors"):
    import_lines.append("\n## Errors\n" + "\n".join(f"- {e}" for e in import_report["errors"]))
  (reports / "review_import_report.md").write_text("\n".join(import_lines) + "\n", encoding="utf-8")
  basic = {
    "video_extraction_report.md": f"# Video Extraction Report\n\nDetected videos: {len(outputs['video_manifest.json']['videos'])}\n\n{count_table}",
    "processing_performance.md": f"# Processing Performance\n\nElapsed seconds: {elapsed:.2f}\n\nFFmpeg source: {outputs['video_manifest.json']['ffmpeg']['source']}\n",
    "player_card_inventory.md": "# Player Card Inventory\n\nFirst pass inventories roster screens for manual player-card extraction. Verified player counts remain 0 until OCR/manual review promotes records.\n",
    "player_card_field_completeness.md": "# Player Card Field Completeness\n\nOmitted fields: 0. Unreadable visible fields are represented as null evidence fields for manual review.\n",
    "playbook_extraction_report.md": "# Playbook Extraction Report\n\nLegacy baseline: 192 plays. Video-verified active plays: 0 until formation and play name are confidently verified from the Oregon playbook video.\n",
    "coach_abilities_report.md": "# Coach Abilities Report\n\nNo coach ability records were video-verified in this first runnable pass. Coach data remains separated from player abilities.\n",
    "source_conflicts.md": "# Source Conflicts\n\nNo video-vs-legacy value conflicts were promoted because OCR-dependent fields remain manual review.\n",
    "source_truth_verification.md": "# Source Truth Verification\n\n`input_videos/` is the authoritative intake folder. Legacy JSON is comparison-only for this pipeline.\n",
    "validation_report.md": "# Generated Pipeline Validation\n\nOverall: " + ("PASS" if not errors else "FAIL") + "\n\n" + ("\n".join(f"- {e}" for e in errors) if errors else "- All generated checks passed.") + "\n",
  }
  for name, text in basic.items():
    (reports / name).write_text(text, encoding="utf-8")

def run(args) -> int:
  repo, start = root(), time.perf_counter()
  tools = resolve_ffmpeg(repo)
  manifest = build_manifest(repo, tools, args.video, args.force)
  if args.dry_run:
    print(json.dumps({"dry_run": True, "videos": [{"filename": v["filename"], "classification": v["classification"], "duration_seconds": v["duration_seconds"], "resolution": v["resolution"]} for v in manifest["videos"]]}, indent=2))
    return 0
  screens = build_screens(repo, tools["ffmpeg"], manifest["videos"], args.force, args.review)
  elapsed = time.perf_counter() - start
  for v in manifest["videos"]:
    v["processing_time_seconds"] = round(elapsed / max(1, len(manifest["videos"])), 3)
  outputs = build_outputs(repo, manifest, screens)
  review_result = generate_roster_stats_review(repo, manifest["videos"], screens, args.extract)
  merge_review_promotions(outputs, review_result)
  outputs["extraction_confidence.json"]["roster_stats_review"] = {"crop_count": review_result.get("crop_count", 0), "ocr": review_result.get("ocr", {})}
  gen = repo / "data" / "generated"; gen.mkdir(parents=True, exist_ok=True)
  write_json(gen / ".video_cache.json", manifest.get("_cache", {}))
  review_import_report = apply_review_import(repo, outputs) if args.apply_review else None
  if review_import_report:
    outputs["extraction_confidence.json"]["review_import"] = {"promoted_total": review_import_report["promoted_total"], "errors": review_import_report["errors"]}
  for name, payload in outputs.items():
    write_json(gen / name, payload)
  errors = validate_generated(repo) + validate_review_promotions(repo, outputs)
  if review_import_report:
    errors.extend(review_import_report["errors"])
  write_reports(repo, outputs, errors, elapsed, review_result, review_import_report)
  print(json.dumps({"status": "PASS" if not errors else "FAIL", "videos": [{"filename": v["filename"], "classification": v["classification"]} for v in manifest["videos"]], "screen_count": len(screens), "legacy_play_baseline": len(legacy_playbook(repo)), "video_verified_plays": 0, "manual_review_screens": sum(1 for s in screens if s["manual_review"]), "review_crop_count": review_result.get("crop_count", 0), "review_promoted_fields": review_import_report["promoted_total"] if review_import_report else 0, "ocr": review_result.get("ocr", {}), "elapsed_seconds": round(elapsed, 2), "errors": errors}, indent=2))
  return 0 if not errors else 1

def parse_args(argv=None):
  p = argparse.ArgumentParser(description="Process weekly source-of-truth videos.")
  p.add_argument("--force", action="store_true")
  p.add_argument("--video")
  p.add_argument("--dry-run", action="store_true")
  p.add_argument("--review", action="store_true")
  p.add_argument("--extract", choices=["roster_stats"], help="Generate OCR-ready review crops and import files for roster/stat videos.")
  p.add_argument("--apply-review", action="store_true", help="Promote only review rows explicitly marked confirmed into generated extracted data.")
  return p.parse_args(argv)

def main(argv=None) -> int:
  try:
    return run(parse_args(argv))
  except Exception as exc:
    print(f"process_week failed: {exc}", file=sys.stderr)
    return 2

if __name__ == "__main__":
  raise SystemExit(main())

