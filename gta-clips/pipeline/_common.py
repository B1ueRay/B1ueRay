"""Общие утилиты пайплайна: конфиг, время, ffmpeg, шрифты, цвета.

Модуль без внешних зависимостей, кроме PyYAML. Работает на Windows/Linux/macOS.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Iterable, Sequence

HERE = Path(__file__).resolve().parent
DEFAULT_CONFIG = HERE / "config.yaml"


class PipelineError(RuntimeError):
    """Понятная пользователю ошибка: печатается без traceback."""


def setup_console() -> None:
    """Чтобы кириллица и эмодзи не роняли print в cp1251/cp866 консоли Windows."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
        except (AttributeError, ValueError):
            pass


def run_main(main) -> None:
    """Обёртка для точки входа: PipelineError -> сообщение + код 1, Ctrl+C -> 130."""
    setup_console()
    try:
        code = main()
    except PipelineError as e:
        print(f"\nОШИБКА: {e}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nПрервано пользователем.", file=sys.stderr)
        sys.exit(130)
    sys.exit(code or 0)


# ---------------------------------------------------------------------------
# Конфиг
# ---------------------------------------------------------------------------

def load_config(path: str | Path | None) -> dict[str, Any]:
    try:
        import yaml
    except ImportError as e:  # pragma: no cover
        raise PipelineError("Не установлен PyYAML. Выполните: pip install -r requirements.txt") from e
    p = Path(path) if path else DEFAULT_CONFIG
    if not p.is_file():
        raise PipelineError(f"Не найден конфиг: {p}")
    try:
        with p.open("r", encoding="utf-8-sig") as f:
            data = yaml.safe_load(f) or {}
    except yaml.YAMLError as e:
        raise PipelineError(f"Ошибка синтаксиса YAML в {p}:\n{e}") from e
    except UnicodeDecodeError as e:
        raise PipelineError(f"{p} не в UTF-8. Пересохраните файл в кодировке UTF-8.") from e
    if not isinstance(data, dict):
        raise PipelineError(f"{p}: ожидался словарь верхнего уровня")
    return data


def section(cfg: dict[str, Any], name: str) -> dict[str, Any]:
    val = cfg.get(name) or {}
    if not isinstance(val, dict):
        raise PipelineError(f"config: секция '{name}' должна быть словарём")
    return dict(val)


def override(conf: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    """Переопределяет значения конфига аргументами CLI (None = не задано)."""
    for k, v in kwargs.items():
        if v is not None:
            conf[k] = v
    return conf


# ---------------------------------------------------------------------------
# Время
# ---------------------------------------------------------------------------

_TIME_RE = re.compile(r"^\s*(?:(\d+):)?(?:(\d+):)?(\d+(?:[.,]\d+)?)\s*$")
_HMS_RE = re.compile(r"^\s*(?:(\d+(?:[.,]\d+)?)h)?\s*(?:(\d+(?:[.,]\d+)?)m)?\s*(?:(\d+(?:[.,]\d+)?)s)?\s*$", re.I)


def parse_time(value: str | float | int) -> float:
    """'1:02:03.5' | '02:03' | '123.4' | '123,4' | '1h2m3s' -> секунды."""
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if not s:
        raise ValueError("пустое время")
    m = _TIME_RE.match(s)
    if m:
        parts = [p for p in m.groups() if p is not None]
        nums = [float(p.replace(",", ".")) for p in parts]
        total = 0.0
        for n in nums:
            total = total * 60 + n
        return total
    m = _HMS_RE.match(s)
    if m and any(m.groups()):
        h, mi, se = (float(x.replace(",", ".")) if x else 0.0 for x in m.groups())
        return h * 3600 + mi * 60 + se
    raise ValueError(f"не понимаю время '{value}' (ожидается 1:02:03, 62.5 или 1h2m3s)")


def fmt_time(sec: float, ms: bool = True) -> str:
    """Секунды -> 'H:MM:SS.mmm' (или без миллисекунд)."""
    sec = max(0.0, float(sec))
    total_ms = int(round(sec * 1000))
    h, rem = divmod(total_ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, msec = divmod(rem, 1000)
    base = f"{h}:{m:02d}:{s:02d}"
    return f"{base}.{msec:03d}" if ms else base


def fmt_twitch_t(sec: float) -> str:
    sec = int(max(0, sec))
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{h}h{m}m{s}s"


def parse_rect(value: str | Sequence[int] | None, what: str) -> tuple[int, int, int, int] | None:
    if value is None or value == "":
        return None
    if isinstance(value, str):
        parts = re.split(r"[,\s:x]+", value.strip())
    else:
        parts = list(value)
    try:
        nums = [int(round(float(p))) for p in parts if str(p) != ""]
    except ValueError as e:
        raise PipelineError(f"{what}: ожидалось x,y,w,h (числа), получено '{value}'") from e
    if len(nums) != 4 or nums[2] <= 0 or nums[3] <= 0 or nums[0] < 0 or nums[1] < 0:
        raise PipelineError(f"{what}: ожидалось x,y,w,h с w,h > 0, получено '{value}'")
    return nums[0], nums[1], nums[2], nums[3]


# ---------------------------------------------------------------------------
# ffmpeg
# ---------------------------------------------------------------------------

def require_tool(name: str) -> str:
    path = shutil.which(name)
    if not path:
        hint = {
            "ffmpeg": "Установите: winget install Gyan.FFmpeg  (и перезапустите терминал, чтобы обновился PATH)",
            "ffprobe": "ffprobe идёт вместе с ffmpeg: winget install Gyan.FFmpeg",
        }.get(name, "")
        raise PipelineError(f"Не найден '{name}' в PATH. {hint}")
    return path


def run(cmd: Sequence[str], *, cwd: Path | None = None, capture: bool = True,
        what: str = "ffmpeg") -> subprocess.CompletedProcess:
    """Запускает процесс (без shell). При ошибке — хвост stderr в исключении."""
    try:
        proc = subprocess.run(
            list(map(str, cmd)), cwd=str(cwd) if cwd else None,
            stdout=subprocess.PIPE if capture else None,
            stderr=subprocess.PIPE if capture else None,
            text=True, encoding="utf-8", errors="replace",
        )
    except FileNotFoundError as e:
        raise PipelineError(f"Не удалось запустить {cmd[0]}: {e}") from e
    if proc.returncode != 0:
        tail = "\n".join((proc.stderr or "").strip().splitlines()[-25:])
        raise PipelineError(f"{what} завершился с кодом {proc.returncode}.\n"
                            f"Команда: {' '.join(map(str, cmd))}\n--- stderr (хвост) ---\n{tail}")
    return proc


def ffprobe_json(path: Path) -> dict[str, Any]:
    ffprobe = require_tool("ffprobe")
    proc = run([ffprobe, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
               what="ffprobe")
    return json.loads(proc.stdout or "{}")


def media_info(path: Path) -> dict[str, Any]:
    """width, height, fps, duration, has_audio."""
    if not path.is_file():
        raise PipelineError(f"Файл не найден: {path}")
    data = ffprobe_json(path)
    streams = data.get("streams", [])
    v = next((s for s in streams if s.get("codec_type") == "video"), None)
    a = next((s for s in streams if s.get("codec_type") == "audio"), None)
    info: dict[str, Any] = {"has_audio": a is not None, "has_video": v is not None}
    dur = data.get("format", {}).get("duration")
    info["duration"] = float(dur) if dur not in (None, "N/A") else None
    if v:
        info["width"] = int(v["width"])
        info["height"] = int(v["height"])
        fr = v.get("avg_frame_rate") or v.get("r_frame_rate") or "30/1"
        try:
            num, den = fr.split("/")
            info["fps"] = float(num) / float(den) if float(den) else 30.0
        except (ValueError, ZeroDivisionError):
            info["fps"] = 30.0
        if not info["fps"] or info["fps"] > 240:
            info["fps"] = 30.0
    return info


# ---------------------------------------------------------------------------
# Шрифты и цвета
# ---------------------------------------------------------------------------

# (путь, имя семейства для ASS, жирный ли файл сам по себе)
_FONT_CANDIDATES: list[tuple[str, str]] = [
    # Windows
    (r"C:\Windows\Fonts\ariblk.ttf", "Arial Black"),
    (r"C:\Windows\Fonts\arialbd.ttf", "Arial"),
    (r"C:\Windows\Fonts\impact.ttf", "Impact"),
    (r"C:\Windows\Fonts\segoeuib.ttf", "Segoe UI"),
    # macOS
    ("/System/Library/Fonts/Supplemental/Arial Black.ttf", "Arial Black"),
    ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "Arial"),
    # Linux
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "DejaVu Sans"),
    ("/usr/share/fonts/TTF/DejaVuSans-Bold.ttf", "DejaVu Sans"),
    ("/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf", "DejaVu Sans"),
    ("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "Liberation Sans"),
    ("/usr/share/fonts/truetype/freefont/FreeSansBold.ttf", "FreeSans"),
]


def resolve_font(style: dict[str, Any]) -> tuple[Path, str]:
    """Возвращает (файл шрифта, имя семейства для .ass)."""
    font_file = style.get("font_file") or "auto"
    font_name = style.get("font_name") or "auto"
    if str(font_file).lower() != "auto":
        p = Path(os.path.expandvars(str(font_file))).expanduser()
        if not p.is_file():
            raise PipelineError(f"style.font_file не найден: {p}")
        if str(font_name).lower() == "auto":
            font_name = _known_family(p) or p.stem
        return p, str(font_name)
    windir = os.environ.get("WINDIR")
    candidates = list(_FONT_CANDIDATES)
    if windir:
        candidates = [(c.replace(r"C:\Windows", windir), n) if c.startswith("C:") else (c, n)
                      for c, n in candidates]
    for c, n in candidates:
        p = Path(c)
        if p.is_file():
            return p, (n if str(font_name).lower() == "auto" else str(font_name))
    raise PipelineError("Не найден жирный системный шрифт. Укажите style.font_file (путь к .ttf) "
                        "и style.font_name в config.yaml")


def _known_family(p: Path) -> str | None:
    low = p.name.lower()
    for c, n in _FONT_CANDIDATES:
        if Path(c.replace("\\", "/")).name.lower() == low:
            return n
    return None


def parse_color(value: str) -> tuple[int, int, int]:
    s = str(value).strip().lstrip("#")
    if s.lower().startswith("0x"):
        s = s[2:]
    if not re.fullmatch(r"[0-9a-fA-F]{6}", s):
        raise PipelineError(f"цвет '{value}' — ожидается формат #RRGGBB")
    return int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)


def ff_color(value: str, opacity: float = 1.0) -> str:
    """#RRGGBB -> 0xRRGGBB@a для drawtext."""
    r, g, b = parse_color(value)
    return f"0x{r:02X}{g:02X}{b:02X}@{max(0.0, min(1.0, float(opacity))):.2f}"


def ass_color(value: str, alpha: int = 0) -> str:
    """#RRGGBB -> &HAABBGGRR (alpha 0 = непрозрачно)."""
    r, g, b = parse_color(value)
    return f"&H{alpha:02X}{b:02X}{g:02X}{r:02X}"


def iter_files(patterns: Iterable[str], exts: set[str]) -> list[Path]:
    """Разворачивает маски сами (PowerShell не раскрывает *.mp4 для внешних программ)."""
    out: list[Path] = []
    for pat in patterns:
        p = Path(pat)
        if any(ch in pat for ch in "*?["):
            base = p.parent if str(p.parent) not in ("", ".") else Path(".")
            out.extend(sorted(x for x in base.glob(p.name) if x.is_file()))
        elif p.is_dir():
            out.extend(sorted(x for x in p.iterdir() if x.is_file() and x.suffix.lower() in exts))
        else:
            out.append(p)
    seen: set[Path] = set()
    uniq = []
    for x in out:
        r = x.resolve()
        if r not in seen:
            seen.add(r)
            uniq.append(x)
    return uniq
