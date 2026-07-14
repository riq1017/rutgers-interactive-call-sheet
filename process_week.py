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

ROSTER_SWEEP_FPS = 4.0
ROSTER_SWEEP_PACKAGES = {"current_team_roster", "opponent_roster"}
ROSTER_SWEEP_ZONES = {
  "roster_table": [0.03, 0.30, 0.78, 0.91],
  "highlight_area": [0.03, 0.38, 0.78, 0.50],
  "attribute_table": [0.03, 0.34, 0.78, 0.72],
  "player_side_card": [0.78, 0.12, 0.98, 0.95],
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

def _ocr_text_with_confidence(image_path: Path, adapter: Dict[str, Any], psm: str = "6") -> Dict[str, Any]:
  if not adapter.get("available"):
    return {"value": None, "confidence": 0.0, "status": "manual_review"}
  try:
    result = subprocess.run([adapter["path"], str(image_path), "stdout", "--psm", psm], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15)
    value = (result.stdout or "").strip()
    if not value:
      return {"value": None, "confidence": 0.0, "status": "manual_review"}
    tokens = re.findall(r"[A-Za-z0-9#'().-]+", value)
    confidence = min(0.82, 0.38 + min(0.28, len(tokens) * 0.025))
    return {"value": value, "confidence": round(confidence, 3), "status": "ocr_draft"}
  except Exception:
    return {"value": None, "confidence": 0.0, "status": "manual_review"}

def _ocr_variant_images(crop_path: Path, expected: str = "generic") -> List[Path]:
  if expected != "highlight_row":
    return [crop_path]
  try:
    from PIL import Image, ImageFilter, ImageOps
  except Exception:
    return [crop_path]
  variants = [crop_path]
  variant_dir = crop_path.parent / ".ocr_variants"
  variant_dir.mkdir(parents=True, exist_ok=True)
  try:
    with Image.open(crop_path) as image:
      base = image.convert("L")
      scale = 4 if max(base.size) < 1400 else 3
      up = base.resize((base.width * scale, base.height * scale))
      contrast = ImageOps.autocontrast(up)
      processed = {
        "sharp": contrast.filter(ImageFilter.SHARPEN),
        "threshold": contrast.point(lambda px: 255 if px > 165 else 0),
      }
      for name, img in processed.items():
        out = variant_dir / f"{crop_path.stem}_{name}.png"
        img.save(out)
        variants.append(out)
  except Exception:
    return [crop_path]
  return variants

def _ocr_result_score(result: Dict[str, Any], expected: str = "generic") -> float:
  text = result.get("value") or ""
  score = float(result.get("confidence") or 0)
  if expected == "highlight_row":
    positions = r"QB|HB|RB|FB|WR|TE|LT|LG|C|RG|RT|LE|RE|LEDG|REDG|DT|MLB|OLB|SAM|CB|FS|SS|K|P"
    if re.search(r"\b(FR|SO|JR|SR)\b", text, re.I):
      score += 0.12
    if re.search(r"\b(" + positions + r")\b", text, re.I):
      score += 0.12
    if re.search(r"\b\d{2,3}\b", text):
      score += 0.05
    if parse_highlight_row_identity(text, "score_only", "score", {}):
      score += 0.25
  return score

def ocr_crop(crop_path: Path, adapter: Dict[str, Any], expected: str = "generic") -> Dict[str, Any]:
  if not adapter.get("available"):
    return {"value": None, "confidence": 0.0, "status": "manual_review"}
  psm_values = ["7", "6"] if expected == "highlight_row" else ["6"]
  best = {"value": None, "confidence": 0.0, "status": "manual_review"}
  variants = _ocr_variant_images(crop_path, expected)
  try:
    for variant in variants:
      for psm in psm_values:
        result = _ocr_text_with_confidence(variant, adapter, psm)
        if _ocr_result_score(result, expected) > _ocr_result_score(best, expected):
          best = result
  finally:
    for variant in variants:
      if variant != crop_path:
        try:
          variant.unlink()
        except Exception:
          pass
    variant_dir = crop_path.parent / ".ocr_variants"
    try:
      variant_dir.rmdir()
    except Exception:
      pass
  return best

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
  # Names are often stacked above the POSITION/ARCHETYPE block. Only accept clean
  # name lines from that header area so UI labels do not become fake players.
  label_words = {
    "POSITION", "ARCHETYPE", "CLASS", "NIL", "HEIGHT", "WEIGHT", "HOMETOWN",
    "PHYSICAL", "MENTAL", "DEV", "TRAIT", "RUTGERS", "PURDUE", "OVR",
  }
  profile_start = next((i for i, line in enumerate(lines) if "POSITION" in line.upper() or "ARCHETYPE" in line.upper()), min(len(lines), 8))
  header_lines = lines[:profile_start]
  name_lines: List[str] = []
  for line in header_lines:
    clean = re.sub(r"[^A-Za-z .'-]", "", line).strip()
    if not clean or len(clean) < 2:
      continue
    tokens = [token for token in clean.split() if token.upper() not in label_words]
    if not tokens:
      continue
    candidate = " ".join(tokens)
    if re.fullmatch(r"[A-Za-z][A-Za-z .'-]{1,20}", candidate):
      name_lines.append(candidate)
  if name_lines:
    selected = name_lines[-2:] if len(name_lines) >= 2 else name_lines[-1:]
    confidence = 0.65 if len(selected) >= 2 else 0.45
    fields.append(candidate_field("visible_name_text", " ".join(selected).title(), ev, confidence))
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


def roster_sweep_timestamps(duration: float, fps: float = ROSTER_SWEEP_FPS) -> List[float]:
  if not duration or duration <= 0:
    return [0.0]
  step = 1.0 / fps
  count = int(duration * fps) + 1
  values = [round(i * step, 3) for i in range(count) if i * step < duration]
  last = max(0.0, round(duration - min(0.1, step / 2), 3))
  if not values or values[-1] < last:
    values.append(last)
  if values[0] != 0.0:
    values.insert(0, 0.0)
  return values

def normalized_identity_part(value: Any) -> str:
  clean = re.sub(r"[^a-z0-9]+", "-", str(value or "").lower()).strip("-")
  return clean or "unknown"

def valid_player_name(value: Any) -> bool:
  text = str(value or "").strip()
  if not text:
    return False
  if re.fullmatch(r"[A-Z]\.?[A-Za-z][A-Za-z.'-]{2,}", text):
    return True
  tokens = [token.strip(".") for token in text.split() if token.strip(".")]
  if len(tokens) < 2 or len(tokens) > 4:
    return False
  blocked = {
    "position", "archetype", "hometown", "physical", "mental", "trait", "normal",
    "recoup", "clearheaded", "winning", "time", "backfield", "threat", "height",
    "weight", "pocket", "shield", "pull", "down", "mobile", "deadeye", "fan",
    "favorite", "press", "pro", "rns", "any", "unknown", "card",
  }
  for token in tokens:
    low = token.lower()
    if low in blocked:
      return False
    if re.search(r"([a-z])\1\1", low):
      return False
    if len(token) == 1 and not re.fullmatch(r"[A-Z]", token):
      return False
    if len(token) == 2 and low in {"ww", "lo", "ud", "qn", "ae", "om", "pg", "ss"}:
      return False
  return any(len(token) >= 4 for token in tokens)

def normalize_roster_row_text(line: str) -> str:
  text = re.sub(r"[|_]+", " ", str(line or ""))
  text = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", text)
  text = re.sub(r"(?<=[A-Za-z])(?=\d)", " ", text)
  text = re.sub(r"(?<=\d)(?=[A-Za-z])", " ", text)
  text = text.replace("0B", "QB").replace("O B", "QB").replace("H B", "HB")
  text = re.sub(r"\bS0\b", "SO", text, flags=re.I)
  text = re.sub(r"\b1T\b", "LT", text, flags=re.I)
  return re.sub(r"\s+", " ", text).strip()

def parse_highlight_row_identity(text: Any, package: str, crop_id: str, ev: Dict[str, Any]) -> List[Dict[str, Any]]:
  raw_lines = meaningful_ocr_lines(text)
  positions = "QB|HB|RB|FB|WR|TE|LT|LG|C|RG|RT|LE|RE|LEDG|REDG|DT|MLB|OLB|SAM|CB|FS|SS|K|P"
  best_fields: List[Dict[str, Any]] = []
  best_score = -1.0
  for raw in raw_lines:
    line = normalize_roster_row_text(raw)
    if not line or any(label in line.upper().split() for label in ("NAME", "YEAR", "POS", "OVR", "NIL", "DEV", "SPD")):
      continue
    patterns = [
      r"(?P<name>[A-Z][A-Za-z.'-]{0,24}(?:\s+[A-Z][A-Za-z.'-]{1,24}){0,2})\s+(?P<class>FR|SO|JR|SR)(?:\s*\(RS\))?\s+(?P<position>" + positions + r")\s+(?P<overall>\d{2,3})?",
      r"(?P<name>[A-Z]\.?\s*[A-Za-z][A-Za-z.'-]{2,24})\s+(?P<class>FR|SO|JR|SR)\s+(?P<position>" + positions + r")\s+(?P<overall>\d{2,3})?",
      r"(?P<name>[A-Z][A-Za-z.'-]{1,24}(?:\s+[A-Z][A-Za-z.'-]{1,24}){0,2})\s+(?P<position>" + positions + r")\s+(?P<class>FR|SO|JR|SR)(?:\s*\(RS\))?\s+(?P<overall>\d{2,3})?",
    ]
    for pattern in patterns:
      match = re.search(pattern, line, re.I)
      if not match:
        continue
      name = re.sub(r"\s+", " ", match.group("name").replace(" .", ".")).strip()
      if len(name) == 2 and name[1] == ".":
        continue
      # Convert compact initial+surname OCR such as M.York into M. York.
      name = re.sub(r"^([A-Z])\.?\s*([A-Z][a-z])", r"\1. \2", name)
      if not valid_player_name(name) or not table_owned_name_is_complete(name):
        continue
      confidence = 0.70
      if match.groupdict().get("overall"):
        confidence += 0.06
      if len(name.split()) >= 2:
        confidence += 0.04
      fields = [
        candidate_field("name", name.title(), ev, confidence),
        candidate_field("visible_name_text", name.title(), ev, confidence),
        candidate_field("class", match.group("class").upper(), ev, min(0.78, confidence - 0.02)),
        candidate_field("position", match.group("position").upper(), ev, min(0.80, confidence)),
      ]
      if match.groupdict().get("overall"):
        overall = normalized_rating_value(match.group("overall"))
        if not overall:
          continue
        fields.append(candidate_field("overall", overall, ev, min(0.76, confidence - 0.02)))
      score = confidence + (0.1 if len(fields) >= 5 else 0)
      if score > best_score:
        best_fields = fields
        best_score = score
  if not best_fields:
    return []
  return [{
    "candidate_id": f"{crop_id}-highlight-identity-001",
    "candidate_type": "highlighted_roster_row_identity",
    "source_crop_id": crop_id,
    "package": package,
    "fields": best_fields,
    "review_status": "ocr_draft_needs_confirmation",
    "raw_ocr_excerpt": "\n".join(raw_lines)[:500],
  }]

def player_identity_key(team_scope: str, fields: Dict[str, Dict[str, Any]], fallback_hash: str) -> str:
  name = fields.get("visible_name_text", {}).get("value") or fields.get("name", {}).get("value")
  position = fields.get("position", {}).get("value")
  jersey = fields.get("jersey", {}).get("value")
  if not name or not valid_player_name(name) or not position:
    return f"{team_scope}|unknown-card|{fallback_hash[:12]}"
  parts = [team_scope, normalized_identity_part(name), normalized_identity_part(position)]
  if jersey:
    parts.append(normalized_identity_part(jersey))
  return "|".join(parts)

def match_existing_table_identity(player_map: Dict[str, Any], fields: Dict[str, Dict[str, Any]]) -> Optional[str]:
  name = fields.get("visible_name_text", {}).get("value") or fields.get("name", {}).get("value")
  position = fields.get("position", {}).get("value")
  if not name or not position:
    return None
  pos_key = normalized_identity_part(position)
  matches = []
  for record_id, player in player_map.items():
    if "|unknown-card|" in record_id:
      continue
    existing = player.get("fields", {})
    existing_name = existing.get("visible_name_text", {}).get("value") or existing.get("name", {}).get("value")
    existing_pos = existing.get("position", {}).get("value")
    if normalized_identity_part(existing_pos) != pos_key:
      continue
    if table_name_matches_side_name(existing_name, name):
      matches.append(record_id)
  return matches[0] if len(matches) == 1 else None

def parse_first_highlight_identity(text: Any, package: str, crop_id: str, ev: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
  identity_fields: Dict[str, Dict[str, Any]] = {}
  for candidate in parse_highlight_row_identity(text, package, crop_id, ev):
    identity_fields.update(accepted_candidate_fields(candidate))
  return identity_fields

def average_crop_hash(image: Any) -> str:
  small = image.convert("L").resize((16, 16))
  data = list(small.getdata())
  avg = sum(data) / max(1, len(data))
  bits = ''.join('1' if pixel >= avg else '0' for pixel in data)
  return hashlib.sha1(bits.encode("ascii")).hexdigest()

def highlighted_row_crop_from_table(image: Any) -> Tuple[Any, Dict[str, Any]]:
  width, height = image.size
  table = image.crop(crop_box(width, height, ROSTER_SWEEP_ZONES["roster_table"]))
  gray = table.convert("L")
  tw, th = gray.size
  fallback = image.crop(crop_box(width, height, [0.03, 0.38, 0.52, 0.50]))
  if th < 20:
    return fallback, {"method": "fallback_static", "confidence": 0.0}
  pixels = gray.load()
  left = int(tw * 0.02)
  right = max(left + 1, int(tw * 0.54))
  min_y = int(th * 0.16)
  max_y = int(th * 0.94)
  window = max(18, int(th * 0.045))
  candidates = []
  for y in range(min_y, max_y - window):
    scores = []
    for yy in range(y, y + window, max(1, window // 6)):
      samples = [pixels[x, yy] for x in range(left, right, max(1, (right-left)//120))]
      bright = sum(1 for v in samples if v >= 178) / max(1, len(samples))
      avg = sum(samples) / max(1, len(samples)) / 255.0
      scores.append(bright * 1.7 + avg)
    candidates.append((sum(scores) / len(scores), y))
  if not candidates:
    return fallback, {"method": "fallback_static", "confidence": 0.0}
  candidates.sort(reverse=True)
  best_score, best_top = candidates[0]
  top = max(0, best_top - 3)
  bottom = min(th, best_top + window + 5)
  if best_score < 0.75 or bottom - top < 16:
    return fallback, {"method": "fallback_static_low_score", "confidence": round(best_score, 3)}
  crop = table.crop((0, top, int(tw * 0.56), bottom))
  confidence = round(min(1.0, best_score / 2.0), 3)
  return crop, {"method": "detected_highlight_identity_band", "crop_top": top, "crop_bottom": bottom, "confidence": confidence}

def save_useful_crop(repo: Path, crop_root: Path, package: str, zone_name: str, crop_image: Any, unique_key: str, seen: Dict[str, str]) -> Tuple[str, bool, str]:
  h = average_crop_hash(crop_image)
  key = f"{package}:{zone_name}:{h}:{unique_key}"
  duplicate = key in seen
  if not duplicate:
    crop_rel_path = Path("assets") / "review_crops" / "roster_sweep" / package / zone_name / f"{short_hash(key)}.jpg"
    crop_abs = repo / crop_rel_path
    crop_abs.parent.mkdir(parents=True, exist_ok=True)
    crop_image.save(crop_abs, "JPEG", quality=92)
    seen[key] = str(crop_rel_path).replace("\\", "/")
  return h, duplicate, seen[key]

def evidence_from_sweep(video: Dict[str, Any], frame_record: Dict[str, Any], crop_rel: str, confidence: float, verified: bool) -> Dict[str, Any]:
  return {
    "source_video": video["filename"],
    "source_video_hash": video["sha256"],
    "timestamp": frame_record["timestamp"],
    "frame_number": frame_record["frame_number"],
    "crop_path": crop_rel,
    "confidence": confidence,
    "verification_status": "video_verified" if verified else "manual_review",
    "manual_review": not verified,
  }

def accepted_candidate_fields(candidate: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
  accepted: Dict[str, Dict[str, Any]] = {}
  for item in candidate.get("fields", []):
    name = item.get("field_name")
    value = item.get("value")
    if value in (None, "") or not name:
      continue
    ev = dict(item.get("evidence") or {})
    confidence = float(ev.get("confidence") or 0)
    auto_safe = name in {"name", "visible_name_text", "position", "jersey", "class", "overall", "height", "weight", "archetype", "hometown", "development_trait"}
    min_confidence = 0.55 if name == "visible_name_text" else 0.35
    if name == "visible_name_text" and not valid_player_name(value):
      continue
    if name == "overall":
      normalized = normalized_rating_value(value)
      if not normalized:
        continue
      value = normalized
    if auto_safe and confidence >= min_confidence:
      ev["verification_status"] = "video_verified"
      ev["manual_review"] = False
      accepted[name] = {"value": value, "evidence": ev}
  return accepted

def merge_player_fields(existing: Dict[str, Any], incoming: Dict[str, Dict[str, Any]]) -> None:
  fields = existing.setdefault("fields", {})
  for key, item in incoming.items():
    if key == "overall":
      normalized = normalized_rating_value(item.get("value"))
      if not normalized:
        continue
      item = dict(item)
      item["value"] = normalized
    current = fields.get(key)
    if not current or float(item["evidence"].get("confidence") or 0) >= float(current.get("evidence", {}).get("confidence") or 0):
      fields[key] = item

def run_ffmpeg_frame_sweep(ffmpeg: str, video_path: Path, out_dir: Path, fps: float) -> List[Path]:
  if out_dir.exists():
    shutil.rmtree(out_dir)
  out_dir.mkdir(parents=True, exist_ok=True)
  pattern = out_dir / "frame_%06d.jpg"
  cmd = [ffmpeg, "-y", "-i", str(video_path), "-vf", f"fps={fps}", "-q:v", "4", "-loglevel", "error", str(pattern)]
  subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
  return sorted(out_dir.glob("frame_*.jpg"))

def extract_single_frame_at(ffmpeg: str, video_path: Path, out_path: Path, timestamp: float) -> Optional[Path]:
  out_path.parent.mkdir(parents=True, exist_ok=True)
  cmd = [ffmpeg, "-y", "-ss", f"{timestamp:.3f}", "-i", str(video_path), "-frames:v", "1", "-q:v", "4", "-loglevel", "error", str(out_path)]
  result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
  return out_path if result.returncode == 0 and out_path.exists() and out_path.stat().st_size > 0 else None

def changed_frame_indices(frame_paths: List[Path]) -> List[int]:
  changed: List[int] = []
  previous = None
  last_change = -999
  for index, frame_path in enumerate(frame_paths):
    sig = roster_change_signature(frame_path)
    if previous is not None and sig != previous and index - last_change >= 2:
      changed.append(index)
      last_change = index
    previous = sig
  return changed

def roster_change_signature(frame_path: Path) -> str:
  try:
    from PIL import Image
    with Image.open(frame_path) as image:
      width, height = image.size
      pieces = []
      for zone_name in ("roster_table", "highlight_area", "attribute_table", "player_side_card"):
        pieces.append(average_crop_hash(image.crop(crop_box(width, height, ROSTER_SWEEP_ZONES[zone_name]))))
      return "|".join(pieces)
  except Exception:
    return frame_signature(frame_path)

def dynamic_roster_frame_set(ffmpeg: str, video_path: Path, frame_dir: Path, fps: float, duration: float) -> List[Dict[str, Any]]:
  if frame_dir.exists():
    shutil.rmtree(frame_dir)
  frame_dir.mkdir(parents=True, exist_ok=True)
  base_paths = run_ffmpeg_frame_sweep(ffmpeg, video_path, frame_dir / "base", fps)
  frames: Dict[float, Path] = {}
  for index, frame_path in enumerate(base_paths):
    frames[round(index / fps, 3)] = frame_path
  burst_offsets = [-0.18, -0.09, 0.09, 0.18]
  burst_dir = frame_dir / "burst"
  burst_count = 0
  for index in changed_frame_indices(base_paths):
    base_ts = round(index / fps, 3)
    for offset in burst_offsets:
      ts = round(max(0.0, min(duration - 0.05, base_ts + offset)), 3)
      if ts in frames:
        continue
      out = burst_dir / f"burst_{burst_count:06d}_{int(ts*1000):09d}ms.jpg"
      extracted = extract_single_frame_at(ffmpeg, video_path, out, ts)
      if extracted:
        frames[ts] = extracted
        burst_count += 1
  return [{"timestamp_seconds": ts, "path": path, "source": "burst" if "burst" in path.parts else "base"} for ts, path in sorted(frames.items())]

def generate_roster_sweep(repo: Path, tools: Dict[str, str], videos: List[Dict[str, Any]], force: bool) -> Dict[str, Any]:
  try:
    from PIL import Image
  except Exception as exc:
    raise RuntimeError(f"PIL is required for roster_sweep: {exc}")
  adapter = tesseract_adapter(repo)
  generated = repo / "data" / "generated"
  tmp_root = generated / ".roster_sweep_frames"
  crop_root = repo / "assets" / "review_crops" / "roster_sweep"
  if crop_root.exists():
    shutil.rmtree(crop_root)
  crop_root.mkdir(parents=True, exist_ok=True)
  sweep_videos = [v for v in videos if v.get("package") in ROSTER_SWEEP_PACKAGES]
  result = {
    "package_type": "roster_sweep",
    "schema_version": "video_source_truth_roster_sweep_v1",
    "generated_at": now(),
    "source_of_truth": "input_videos",
    "fps": ROSTER_SWEEP_FPS,
    "videos": [],
    "screen_inventory": [],
    "player_card_inventory": [],
    "players_by_package": {"current_team_roster": {}, "opponent_roster": {}},
    "manual_review_fields": [],
    "ocr": adapter,
  }
  for video in sweep_videos:
    package = video["package"]
    team_scope = "rutgers" if package == "current_team_roster" else "purdue"
    src = repo / "input_videos" / video["filename"]
    frame_dir = tmp_root / Path(video["filename"]).stem.replace(" ", "_")
    duration = float(video.get("duration_seconds") or 0)
    frame_records = dynamic_roster_frame_set(tools["ffmpeg"], src, frame_dir, ROSTER_SWEEP_FPS, duration)
    frame_paths = [record["path"] for record in frame_records]
    expected_min = max(1, int(duration * ROSTER_SWEEP_FPS * 0.95))
    video_summary = {
      "filename": video["filename"],
      "package": package,
      "duration_seconds": duration,
      "fps": ROSTER_SWEEP_FPS,
      "frames_inspected": len(frame_paths),
      "base_frames": sum(1 for record in frame_records if record["source"] == "base"),
      "burst_frames": sum(1 for record in frame_records if record["source"] == "burst"),
      "expected_minimum_frames": expected_min,
      "coverage_start_seconds": frame_records[0]["timestamp_seconds"] if frame_records else None,
      "coverage_end_seconds": frame_records[-1]["timestamp_seconds"] if frame_records else None,
      "full_duration_processed": bool(frame_records) and len([r for r in frame_records if r["source"] == "base"]) >= expected_min and frame_records[-1]["timestamp_seconds"] >= max(0, duration - (1.0 / ROSTER_SWEEP_FPS) - 0.1),
      "unique_roster_screens": 0,
      "unique_player_cards": 0,
      "duplicate_appearances_removed": 0,
    }
    seen_zone_hashes: Dict[str, str] = {}
    seen_player_card_hashes: Dict[str, str] = {}
    for index, frame_info in enumerate(frame_records):
      frame_path = frame_info["path"]
      ts = frame_info["timestamp_seconds"]
      frame_record = {
        "source_video": video["filename"],
        "timestamp": f"00:{int(ts//60):02d}:{int(ts%60):02d}",
        "timestamp_seconds": ts,
        "frame_number": int(round(ts * 60)),
        "package": package,
        "sweep_frame_source": frame_info["source"],
      }
      with Image.open(frame_path) as img:
        width, height = img.size
        zone_records = {}
        for zone_name, box in ROSTER_SWEEP_ZONES.items():
          if zone_name == "highlight_area":
            cropped, meta = highlighted_row_crop_from_table(img)
          else:
            cropped = img.crop(crop_box(width, height, box))
            meta = {"method": "static_zone"}
          h = average_crop_hash(cropped)
          unique_key = f"{package}:{zone_name}:{h}"
          duplicate = unique_key in seen_zone_hashes
          crop_rel = None
          if zone_name in {"highlight_area", "player_side_card"}:
            h, duplicate, crop_rel = save_useful_crop(repo, crop_root, package, zone_name, cropped, "", seen_zone_hashes)
          else:
            if not duplicate:
              seen_zone_hashes[unique_key] = ""
          zone_records[zone_name] = {"hash": h, "duplicate": duplicate, "crop_path": crop_rel, "crop_meta": meta}
        is_unique_screen = not zone_records["roster_table"]["duplicate"] or not zone_records["highlight_area"]["duplicate"] or not zone_records["attribute_table"]["duplicate"]
        is_unique_card = not zone_records["player_side_card"]["duplicate"]
        should_process_card = is_unique_card or not zone_records["highlight_area"]["duplicate"]
        if is_unique_screen:
          video_summary["unique_roster_screens"] += 1
        if should_process_card:
          if is_unique_card:
            video_summary["unique_player_cards"] += 1
          highlight_crop = repo / zone_records["highlight_area"]["crop_path"]
          highlight_ocr = ocr_crop(highlight_crop, adapter, "highlight_row")
          highlight_ev = evidence_from_sweep(video, frame_record, zone_records["highlight_area"]["crop_path"], highlight_ocr.get("confidence", 0.0), False)
          highlight_crop_id = f"roster-sweep-{package}-{short_hash(zone_records['highlight_area']['hash'])}"
          identity_fields = parse_first_highlight_identity(highlight_ocr.get("value"), package, highlight_crop_id, highlight_ev)
          if not identity_fields:
            static_crop = img.crop(crop_box(width, height, [0.03, 0.38, 0.78, 0.50]))
            static_hash, static_duplicate, static_rel = save_useful_crop(repo, crop_root, package, "highlight_area_static", static_crop, "", seen_zone_hashes)
            static_ocr = ocr_crop(repo / static_rel, adapter, "highlight_row")
            static_ev = evidence_from_sweep(video, frame_record, static_rel, static_ocr.get("confidence", 0.0), False)
            static_fields = parse_first_highlight_identity(static_ocr.get("value"), package, f"roster-sweep-{package}-{short_hash(static_hash)}", static_ev)
            if static_fields:
              identity_fields = static_fields
              highlight_ev = static_ev
          player_map = result["players_by_package"][package]
          accepted: Dict[str, Dict[str, Any]] = dict(identity_fields)
          matched_existing_identity = None
          side_crop = repo / zone_records["player_side_card"]["crop_path"]
          ocr = ocr_crop(side_crop, adapter)
          ev = evidence_from_sweep(video, frame_record, zone_records["player_side_card"]["crop_path"], ocr.get("confidence", 0.0), False)
          candidate_crop = {
            "crop_id": f"roster-sweep-{package}-{short_hash(zone_records['player_side_card']['hash'])}",
            "crop_type": "player_side_card",
            "fields": [review_field(ocr.get("value"), ev, "player_side_card", "ocr_draft_needs_confirmation" if ocr.get("value") else "needs_manual_review")],
          }
          candidates = structured_candidates_from_crop(package, candidate_crop)
          side_fields_for_match: Dict[str, Dict[str, Any]] = {}
          for candidate in candidates:
            candidate_accepted = accepted_candidate_fields(candidate)
            side_fields_for_match.update(candidate_accepted)
            for key, value in candidate_accepted.items():
              if key in {"name", "visible_name_text", "position", "overall"}:
                continue
              if identity_fields:
                accepted[key] = value
          if not identity_fields:
            matched_existing_identity = match_existing_table_identity(player_map, side_fields_for_match)
            if matched_existing_identity:
              identity = matched_existing_identity
            else:
              unreadable = {
                "player_identity_key": None,
                "team_scope": team_scope,
                "source_video": video["filename"],
                "timestamp": frame_record["timestamp"],
                "frame_number": frame_record["frame_number"],
                "crop_path": zone_records["player_side_card"]["crop_path"],
                "reason": "side card could not be matched to a table-owned identity",
              }
              result["manual_review_fields"].append(unreadable)
              continue
          else:
            identity = player_identity_key(team_scope, identity_fields, zone_records["player_side_card"]["hash"])
          if identity not in player_map:
            player_map[identity] = {
              "record_id": identity,
              "record_type": "player_card",
              "team_scope": team_scope,
              "player_identity_key": identity,
              "source_card_hashes": [],
              "appearances": [],
              "fields": {},
              "unreadable_fields": [],
              "manual_review": False,
              "verification_status": "video_sweep_draft",
            }
          player = player_map[identity]
          if zone_records["player_side_card"]["hash"] not in player["source_card_hashes"]:
            player["source_card_hashes"].append(zone_records["player_side_card"]["hash"])
          player["appearances"].append({
            "source_video": video["filename"],
            "timestamp": frame_record["timestamp"],
            "frame_number": frame_record["frame_number"],
            "crop_path": zone_records["player_side_card"]["crop_path"],
          })
          merge_player_fields(player, accepted)
          if (not identity_fields and not matched_existing_identity) or "|unknown-card|" in identity:
            unreadable = {
              "player_identity_key": identity,
              "team_scope": team_scope,
              "field": "player_identity",
              "value": None,
              "evidence": highlight_ev,
              "reason": "OCR could not confidently read complete player identity from the highlighted roster row.",
            }
            player["unreadable_fields"].append(unreadable)
            result["manual_review_fields"].append(unreadable)
          if is_unique_card:
            result["player_card_inventory"].append({
              "card_hash": zone_records["player_side_card"]["hash"],
              "player_identity_key": identity,
              "package": package,
              "team_scope": team_scope,
              "source_video": video["filename"],
              "timestamp": frame_record["timestamp"],
              "frame_number": frame_record["frame_number"],
              "crop_path": zone_records["player_side_card"]["crop_path"],
              "duplicate": False,
            })
        else:
          video_summary["duplicate_appearances_removed"] += 1
        result["screen_inventory"].append({
          **frame_record,
          "zones": zone_records,
          "unique_roster_screen": is_unique_screen,
          "unique_player_card": is_unique_card,
          "disposition": "fully_extracted" if is_unique_screen or is_unique_card else "duplicate",
        })
    result["videos"].append(video_summary)
  for package, players in result["players_by_package"].items():
    for player in players.values():
      player["manual_review"] = bool(player.get("unreadable_fields"))
      player["field_count"] = len(player.get("fields", {}))
  return result

def apply_roster_sweep_outputs(repo: Path, outputs: Dict[str, Any], sweep: Dict[str, Any]) -> None:
  mapping = {
    "current_team_roster": "current_team_roster_extracted.json",
    "opponent_roster": "opponent_roster_extracted.json",
  }
  for package, filename in mapping.items():
    players = list((sweep.get("players_by_package", {}).get(package) or {}).values())
    identified_players = [p for p in players if "|unknown-card|" not in p.get("record_id", "")]
    output = outputs.get(filename)
    if not output:
      continue
    output["schema_version"] = "video_source_truth_roster_sweep_v1"
    output["extraction_method"] = "full_duration_roster_sweep"
    output["review_package"] = f"data/generated/review/{package}_review.json"
    output["review_csv"] = f"data/generated/review/{package}_review.csv"
    output["records"] = players
    output["manual_review_records"] = [p["record_id"] for p in players if p.get("manual_review")]
    output.setdefault("counts", {})
    review_path = repo / "data" / "generated" / "review" / f"{package}_review.json"
    review_crops = 0
    if review_path.exists():
      review_crops = int((read_json(review_path, {}).get("counts") or {}).get("crops") or 0)
    output["counts"].update({
      "records": len(players),
      "identified_records": len(identified_players),
      "complete_records": sum(1 for p in identified_players if not p.get("manual_review")),
      "partial_records": sum(1 for p in players if p.get("manual_review")),
      "manual_review_records": sum(1 for p in players if p.get("manual_review")),
      "omitted_fields": 0,
      "review_crops": review_crops,
      "unique_player_cards": sum(1 for c in sweep.get("player_card_inventory", []) if c.get("package") == package),
    })

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

def preserve_review_package_links(repo: Path, outputs: Dict[str, Any]) -> None:
  mapping = {
    "current_team_roster": "current_team_roster_extracted.json",
    "opponent_roster": "opponent_roster_extracted.json",
    "current_team_season_stats": "current_team_season_stats_extracted.json",
    "opponent_season_stats": "opponent_season_stats_extracted.json",
  }
  for package, filename in mapping.items():
    payload = outputs.get(filename)
    if not payload:
      continue
    review_path = repo / "data" / "generated" / "review" / f"{package}_review.json"
    payload.setdefault("counts", {})
    payload["review_package"] = f"data/generated/review/{package}_review.json"
    payload["review_csv"] = f"data/generated/review/{package}_review.csv"
    if "review_crops" not in payload["counts"]:
      payload["counts"]["review_crops"] = int((read_json(review_path, {}).get("counts") or {}).get("crops") or 0)


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



def write_roster_sweep_reports(repo: Path, sweep: Dict[str, Any]) -> None:
  reports = repo / "reports"
  reports.mkdir(exist_ok=True)
  rows = []
  for v in sweep.get("videos", []):
    rows.append([v["filename"], v["duration_seconds"], v["frames_inspected"], v["unique_roster_screens"], v["unique_player_cards"], v["duplicate_appearances_removed"], v["full_duration_processed"]])
  body = "# Roster Sweep Report\n\n"
  body += table(["Video","Duration","Frames Inspected","Unique Screens","Unique Cards","Duplicates Removed","Full Duration"], rows)
  body += "\nBaseline FPS: 4.0. Additional burst frames are sampled around detected screen changes.\n"
  body += "\n## Totals\n\n"
  rutgers_identified = [p for p in sweep['players_by_package'].get('current_team_roster', {}).values() if "|unknown-card|" not in p.get("record_id", "")]
  purdue_identified = [p for p in sweep['players_by_package'].get('opponent_roster', {}).values() if "|unknown-card|" not in p.get("record_id", "")]
  body += f"- Unique Rutgers players auto-identified: {len(rutgers_identified)}\n"
  body += f"- Unique Purdue players auto-identified: {len(purdue_identified)}\n"
  body += f"- Unique player cards detected: {len(sweep.get('player_card_inventory', []))}\n"
  body += f"- Unreadable fields: {len(sweep.get('manual_review_fields', []))}\n"
  confidence_values = [float((field.get('evidence') or {}).get('confidence') or 0) for players in sweep.get('players_by_package', {}).values() for player in players.values() for field in player.get('fields', {}).values()]
  avg_conf = round(sum(confidence_values) / max(1, len(confidence_values)), 3)
  body += f"- Extraction confidence: {avg_conf}\n"
  (reports / "roster_sweep_report.md").write_text(body, encoding="utf-8")
  manual_rows = []
  for item in sweep.get("manual_review_fields", []):
    ev = item.get("evidence", {})
    manual_rows.append([item.get("team_scope"), item.get("player_identity_key"), item.get("field"), ev.get("source_video"), ev.get("timestamp"), ev.get("crop_path"), item.get("reason")])
  manual_body = "# Manual Review Required\n\n"
  manual_body += table(["Team","Player Key","Field","Video","Timestamp","Crop","Reason"], manual_rows) if manual_rows else "No unreadable roster sweep fields.\n"
  (reports / "manual_review_required.md").write_text(manual_body, encoding="utf-8")

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
  preserve_review_package_links(repo, outputs)
  roster_sweep = generate_roster_sweep(repo, tools, manifest["videos"], args.force) if args.extract == "roster_sweep" else None
  if roster_sweep:
    apply_roster_sweep_outputs(repo, outputs, roster_sweep)
    outputs["extraction_confidence.json"]["roster_sweep"] = {
      "videos": roster_sweep["videos"],
      "unique_player_cards": len(roster_sweep["player_card_inventory"]),
      "manual_review_fields": len(roster_sweep["manual_review_fields"]),
      "ocr": roster_sweep.get("ocr", {}),
    }
  outputs["extraction_confidence.json"]["roster_stats_review"] = {"crop_count": review_result.get("crop_count", 0), "ocr": review_result.get("ocr", {})}
  gen = repo / "data" / "generated"; gen.mkdir(parents=True, exist_ok=True)
  write_json(gen / ".video_cache.json", manifest.get("_cache", {}))
  review_import_report = apply_review_import(repo, outputs) if args.apply_review else None
  if review_import_report:
    outputs["extraction_confidence.json"]["review_import"] = {"promoted_total": review_import_report["promoted_total"], "errors": review_import_report["errors"]}
  if roster_sweep:
    write_json(gen / "roster_screen_inventory.json", {
      "package_type": "roster_screen_inventory",
      "schema_version": "video_source_truth_roster_sweep_v1",
      "generated_at": now(),
      "fps": ROSTER_SWEEP_FPS,
      "screens": roster_sweep["screen_inventory"],
      "videos": roster_sweep["videos"],
    })
    write_json(gen / "player_card_inventory.json", {
      "package_type": "player_card_inventory",
      "schema_version": "video_source_truth_roster_sweep_v1",
      "generated_at": now(),
      "cards": roster_sweep["player_card_inventory"],
      "counts": {
        "unique_player_cards": len(roster_sweep["player_card_inventory"]),
        "rutgers_players": len(roster_sweep["players_by_package"].get("current_team_roster", {})),
        "purdue_players": len(roster_sweep["players_by_package"].get("opponent_roster", {})),
      },
    })
  for name, payload in outputs.items():
    write_json(gen / name, payload)
  errors = validate_generated(repo) + validate_review_promotions(repo, outputs)
  if review_import_report:
    errors.extend(review_import_report["errors"])
  write_reports(repo, outputs, errors, elapsed, review_result, review_import_report)
  if roster_sweep:
    write_roster_sweep_reports(repo, roster_sweep)
  roster_payload = None
  if roster_sweep:
    rutgers_players = [p for p in roster_sweep["players_by_package"].get("current_team_roster", {}).values() if "|unknown-card|" not in p.get("record_id", "")]
    purdue_players = [p for p in roster_sweep["players_by_package"].get("opponent_roster", {}).values() if "|unknown-card|" not in p.get("record_id", "")]
    roster_payload = {
      "rutgers_players_auto_identified": len(rutgers_players),
      "purdue_players_auto_identified": len(purdue_players),
      "unique_player_cards": len(roster_sweep["player_card_inventory"]),
      "manual_review_fields": len(roster_sweep["manual_review_fields"]),
    }
  print(json.dumps({"status": "PASS" if not errors else "FAIL", "videos": [{"filename": v["filename"], "classification": v["classification"]} for v in manifest["videos"]], "screen_count": len(screens), "legacy_play_baseline": len(legacy_playbook(repo)), "video_verified_plays": 0, "manual_review_screens": sum(1 for s in screens if s["manual_review"]), "review_crop_count": review_result.get("crop_count", 0), "review_promoted_fields": review_import_report["promoted_total"] if review_import_report else 0, "roster_sweep": roster_payload, "ocr": review_result.get("ocr", {}), "elapsed_seconds": round(elapsed, 2), "errors": errors}, indent=2))
  return 0 if not errors else 1

def parse_args(argv=None):
  p = argparse.ArgumentParser(description="Process weekly source-of-truth videos.")
  p.add_argument("--force", action="store_true")
  p.add_argument("--video")
  p.add_argument("--dry-run", action="store_true")
  p.add_argument("--review", action="store_true")
  p.add_argument("--extract", choices=["roster_stats", "roster_sweep"], help="Generate OCR-ready review crops, structured imports, or full roster sweep outputs.")
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

