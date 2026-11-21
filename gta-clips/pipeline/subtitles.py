#!/usr/bin/env python3
"""Субтитры в стиле шортсов: faster-whisper (word timestamps) -> .ass -> (опц.) вжигание в видео.

  python subtitles.py out/clips/*.mp4 --burn
      -> clip_01_....words.json  (слова с таймкодами — можно править руками)
      -> clip_01_....ass         (1-3 слова на экран, подсветка текущего слова)
      -> clip_01_..._subs.mp4    (с --burn)

  python subtitles.py out/clips/clip_01_....words.json --burn
      -> пересобрать .ass/видео из исправленного words.json без повторной транскрипции

Модель whisper скачивается с HuggingFace при первом запуске (small ~ 480 МБ) в кэш
(%USERPROFILE%\\.cache\\huggingface). GPU (NVIDIA, CUDA 12 + cuDNN 9) используется автоматически,
если доступен; иначе CPU int8.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Any

from _common import (PipelineError, ass_color, encoder_args, iter_files, load_config, media_info, override,
                     require_tool, resolve_font, run, run_main, section)

MEDIA_EXTS = {".mp4", ".mkv", ".mov", ".webm", ".m4a", ".mp3", ".wav", ".flac", ".aac", ".ogg", ".ts"}

SUB_DEFAULTS: dict[str, Any] = {
    "model": "small", "language": "auto", "device": "auto", "compute_type": "auto", "beam_size": 5,
    "vad_filter": True, "max_words": 3, "max_chars": 16, "pause_break_sec": 0.45, "linger_sec": 0.25,
    "uppercase": True, "strip_punctuation": True, "font_size": 84, "primary_color": "#FFFFFF",
    "highlight_color": "#FFE600", "outline_color": "#000000", "outline": 9, "shadow": 3,
    "highlight_scale": 112, "pop_in": True, "position_y": 0.66, "margin_x": 110,
}


# ---------------------------------------------------------------------------
# Транскрипция
# ---------------------------------------------------------------------------

def _add_nvidia_dll_dirs() -> None:
    """Windows: CUDA-библиотеки из pip-пакетов nvidia-cublas-cu12 / nvidia-cudnn-cu12 не видны
    ctranslate2 по умолчанию — добавляем их папки bin в поиск DLL."""
    if os.name != "nt":
        return
    for base in map(Path, sys.path):
        nv = base / "nvidia"
        if not nv.is_dir():
            continue
        for bin_dir in nv.glob("*/bin"):
            try:
                os.add_dll_directory(str(bin_dir))  # type: ignore[attr-defined]
            except (OSError, AttributeError):
                pass
            os.environ["PATH"] = str(bin_dir) + os.pathsep + os.environ.get("PATH", "")


def pick_device(device: str) -> str:
    if device != "auto":
        return device
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            return "cuda"
    except Exception:  # noqa: BLE001 — любые проблемы с CUDA = CPU
        pass
    return "cpu"


_CUDA_ERR = re.compile(r"cublas|cudnn|cuda|libcu|\.dll|CUBLAS|CUDNN", re.I)


class Transcriber:
    def __init__(self, sc: dict[str, Any], model_dir: Path | None):
        try:
            import faster_whisper  # noqa: F401
        except ImportError as e:
            raise PipelineError("Не установлен faster-whisper: pip install -r requirements.txt") from e
        _add_nvidia_dll_dirs()
        self.sc = sc
        self.model_dir = model_dir
        self.device = pick_device(str(sc["device"]))
        self.model = None

    def _load(self, device: str):
        from faster_whisper import WhisperModel
        ct = str(self.sc["compute_type"])
        if ct == "auto":
            ct = "float16" if device == "cuda" else "int8"
        print(f"  загрузка модели whisper '{self.sc['model']}' ({device}, {ct})...")
        try:
            return WhisperModel(str(self.sc["model"]), device=device, compute_type=ct,
                                download_root=str(self.model_dir) if self.model_dir else None)
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            if "huggingface" in msg.lower() or "connect" in msg.lower() or "snapshot" in msg.lower():
                raise PipelineError(f"Не удалось скачать модель '{self.sc['model']}' с HuggingFace: {msg}\n"
                                    "Проверьте интернет/прокси или скачайте модель вручную "
                                    "(Systran/faster-whisper-<size>) и передайте путь в --model.") from e
            raise

    def transcribe(self, media: Path) -> dict[str, Any]:
        if self.model is None:
            self.model = self._load(self.device)
        lang = None if str(self.sc["language"]).lower() in ("auto", "", "none") else str(self.sc["language"])
        try:
            return self._run(media, lang)
        except (RuntimeError, OSError) as e:
            if self.device == "cuda" and _CUDA_ERR.search(str(e)):
                print(f"  ! GPU не завёлся ({e}).\n  ! Переключаюсь на CPU (int8). "
                      "Как починить CUDA — см. SETUP-WINDOWS.md")
                self.device = "cpu"
                self.sc = {**self.sc, "compute_type": "int8"}
                self.model = self._load("cpu")
                return self._run(media, lang)
            raise

    def _run(self, media: Path, lang: str | None) -> dict[str, Any]:
        segments, info = self.model.transcribe(
            str(media), language=lang, word_timestamps=True, beam_size=int(self.sc["beam_size"]),
            vad_filter=bool(self.sc["vad_filter"]), condition_on_previous_text=False)
        words = []
        for seg in segments:  # генератор: реальная работа (и ошибки CUDA) происходят здесь
            for w in seg.words or []:
                words.append({"start": round(float(w.start), 3), "end": round(float(w.end), 3),
                              "word": w.word, "p": round(float(w.probability), 3)})
        return {"language": info.language, "language_probability": round(float(info.language_probability), 3),
                "words": words}


# ---------------------------------------------------------------------------
# ASS
# ---------------------------------------------------------------------------

_PUNCT_STRIP = re.compile(r"[.,;:\"«»„“”()\[\]…—–]+")
_SENT_END = re.compile(r"[.!?…]$")


def clean_word(word: str, sc: dict[str, Any]) -> str:
    w = word.strip()
    if sc["strip_punctuation"]:
        w = _PUNCT_STRIP.sub("", w).strip("-'")
    if sc["uppercase"]:
        w = w.upper()
    return w.replace("\\", "/").replace("{", "(").replace("}", ")")


def group_words(words: list[dict[str, Any]], sc: dict[str, Any]) -> list[list[dict[str, Any]]]:
    groups: list[list[dict[str, Any]]] = []
    cur: list[dict[str, Any]] = []
    max_words, max_chars, pause = int(sc["max_words"]), int(sc["max_chars"]), float(sc["pause_break_sec"])
    prev_raw = ""
    for w in words:
        txt = clean_word(str(w.get("word", "")), sc)
        if not txt:
            continue
        item = {"start": float(w["start"]), "end": max(float(w["end"]), float(w["start"]) + 0.05), "text": txt}
        if cur:
            chars = sum(len(x["text"]) for x in cur) + len(cur) + len(txt)
            if (len(cur) >= max_words or chars > max_chars or item["start"] - cur[-1]["end"] > pause
                    or _SENT_END.search(prev_raw.strip())):
                groups.append(cur)
                cur = []
        cur.append(item)
        prev_raw = str(w.get("word", ""))
    if cur:
        groups.append(cur)
    return groups


def _ass_time(t: float) -> str:
    cs = int(round(max(0.0, t) * 100))
    h, rem = divmod(cs, 360000)
    m, rem = divmod(rem, 6000)
    s, cs = divmod(rem, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def build_ass(words: list[dict[str, Any]], sc: dict[str, Any], font_name: str, W: int, H: int) -> tuple[str, int]:
    k = H / 1920.0
    size = int(round(float(sc["font_size"]) * k))
    outline = float(sc["outline"]) * k
    shadow = float(sc["shadow"]) * k
    mx = int(round(float(sc["margin_x"]) * W / 1080.0))
    primary = ass_color(sc["primary_color"])
    hl = ass_color(sc["highlight_color"])
    oc = ass_color(sc["outline_color"])
    x, y = W // 2, int(round(float(sc["position_y"]) * H))
    hs = int(sc["highlight_scale"])

    header = f"""[Script Info]
; Сгенерировано subtitles.py
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Shorts,{font_name},{size},{primary},&H000000FF,{oc},&H80000000,-1,0,0,0,100,100,0,0,1,{outline:.1f},{shadow:.1f},5,{mx},{mx},0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    groups = group_words(words, sc)
    linger = float(sc["linger_sec"])
    for gi, g in enumerate(groups):
        g_start = g[0]["start"]
        g_end = g[-1]["end"] + linger
        if gi + 1 < len(groups):
            nxt = groups[gi + 1][0]["start"]
            if nxt - g_end < 0.35:  # маленький разрыв — держим до следующего куска, без мигания
                g_end = nxt
            g_end = min(g_end, nxt)
        g_end = max(g_end, g_start + 0.1)
        starts = [g_start] + [max(w["start"], g_start) for w in g[1:]]
        for wi in range(len(g)):
            ws = starts[wi]
            we = starts[wi + 1] if wi + 1 < len(g) else g_end
            if we - ws < 0.02:
                continue
            parts = []
            for j, w in enumerate(g):
                is_hl = j == wi
                color = hl if is_hl else primary
                sc_ = hs if is_hl else 100
                tag = f"\\c{color}\\fscx{sc_}\\fscy{sc_}"
                if sc["pop_in"] and wi == 0:
                    small = int(sc_ * 0.82)
                    tag = f"\\c{color}\\fscx{small}\\fscy{small}\\t(0,90,\\fscx{sc_}\\fscy{sc_})"
                parts.append(f"{{{tag}}}{w['text']}")
            text = f"{{\\an5\\pos({x},{y})}}" + " ".join(parts)
            lines.append(f"Dialogue: 0,{_ass_time(ws)},{_ass_time(we)},Shorts,,0,0,0,,{text}")
    return header + "\n".join(lines) + "\n", len(groups)


# ---------------------------------------------------------------------------
# Вжигание
# ---------------------------------------------------------------------------

def burn(video: Path, ass: Path, out: Path, font_file: Path, rc: dict[str, Any]) -> None:
    ffmpeg = require_tool("ffmpeg")
    work = out.parent / f"_work_{out.stem}"
    work.mkdir(parents=True, exist_ok=True)
    try:
        # Копии рядом с процессом ffmpeg: никаких проблем с экранированием C:\... в фильтре subtitles
        shutil.copyfile(ass, work / "subs.ass")
        shutil.copyfile(font_file, work / "font.ttf")
        cmd = [ffmpeg, "-hide_banner", "-y", "-i", str(video.resolve()),
               "-vf", "subtitles=filename=subs.ass:fontsdir=.,format=yuv420p",
               "-map", "0:v:0", "-map", "0:a?", "-c:a", "copy"]
        cmd += encoder_args({**rc, "crf": min(int(rc.get("crf", 20)), 18)})
        cmd += ["-movflags", "+faststart", str(out.resolve())]
        run(cmd, cwd=work, what="ffmpeg (вжигание субтитров)")
    finally:
        shutil.rmtree(work, ignore_errors=True)


# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Транскрипция (faster-whisper) и субтитры .ass в стиле шортсов.")
    p.add_argument("inputs", nargs="+", help="видео/аудио файлы, папка или маска (*.mp4); либо *.words.json")
    p.add_argument("-o", "--out-dir", type=Path, default=None, help="куда класть .ass (по умолчанию рядом с файлом)")
    p.add_argument("-c", "--config", type=Path, default=None)
    p.add_argument("--model", default=None, help="tiny/base/small/medium/large-v3/large-v3-turbo или путь к папке модели")
    p.add_argument("--model-dir", type=Path, default=None, help="куда кэшировать модели")
    p.add_argument("--language", default=None, help="auto | ru | en | ...")
    p.add_argument("--device", choices=["auto", "cpu", "cuda"], default=None)
    p.add_argument("--compute-type", default=None, help="auto | int8 | float16 | int8_float16 | float32")
    p.add_argument("--max-words", type=int, default=None)
    p.add_argument("--position-y", type=float, default=None, help="центр текста, доля высоты (0.66)")
    p.add_argument("--burn", action="store_true", help="вжечь субтитры: <имя>_subs.mp4")
    p.add_argument("--video", type=Path, default=None,
                   help="для входа *.words.json: какое видео использовать при --burn (по умолчанию <имя>.mp4)")
    return p


def main() -> int:
    args = build_parser().parse_args()
    cfg = load_config(args.config)
    sc = {**SUB_DEFAULTS, **section(cfg, "subtitles")}
    override(sc, model=args.model, language=args.language, device=args.device, compute_type=args.compute_type,
             max_words=args.max_words, position_y=args.position_y)
    rc = section(cfg, "render")
    st = section(cfg, "style")
    font_file, font_name = resolve_font(st)
    W, H = int(rc.get("width", 1080)), int(rc.get("height", 1920))

    files = iter_files(args.inputs, MEDIA_EXTS | {".json"})
    if not files:
        raise PipelineError("Не найдено входных файлов")
    transcriber: Transcriber | None = None

    for f in files:
        if not f.is_file():
            raise PipelineError(f"Файл не найден: {f}")
        if f.name.endswith("_subs.mp4"):
            continue  # уже с субтитрами
        is_words = f.suffix.lower() == ".json"
        stem = f.name[: -len(".words.json")] if f.name.endswith(".words.json") else f.stem
        out_dir = args.out_dir or f.parent
        out_dir.mkdir(parents=True, exist_ok=True)
        print(f"\n{f.name}")
        if is_words:
            try:
                data = json.loads(f.read_text(encoding="utf-8-sig"))
            except json.JSONDecodeError as e:
                raise PipelineError(f"{f}: битый JSON: {e}") from e
            if not isinstance(data, dict) or not isinstance(data.get("words"), list):
                raise PipelineError(f"{f}: ожидается {{\"words\": [{{\"start\", \"end\", \"word\"}}, ...]}}")
            video = args.video or f.with_name(stem + ".mp4")
        else:
            if transcriber is None:
                transcriber = Transcriber(sc, args.model_dir)
            data = transcriber.transcribe(f)
            (out_dir / f"{stem}.words.json").write_text(json.dumps(data, ensure_ascii=False, indent=1),
                                                       encoding="utf-8")
            video = f
            print(f"  язык: {data.get('language')} ({data.get('language_probability')}), слов: {len(data['words'])}")

        w, h = W, H
        if video.is_file() and video.suffix.lower() in {".mp4", ".mkv", ".mov", ".webm", ".ts"}:
            info = media_info(video)
            if info.get("has_video"):
                w, h = info["width"], info["height"]
        ass_text, n_groups = build_ass(data["words"], sc, font_name, w, h)
        ass_path = out_dir / f"{stem}.ass"
        ass_path.write_text(ass_text, encoding="utf-8-sig")
        print(f"  -> {ass_path}  ({n_groups} фраз, {w}x{h}, шрифт '{font_name}')")
        if not data["words"]:
            print("  ! речь не распознана — субтитры пустые")

        if args.burn:
            if not video.is_file():
                raise PipelineError(f"--burn: видео не найдено: {video} (укажите --video)")
            out = out_dir / f"{stem}_subs.mp4"
            burn(video, ass_path, out, font_file, rc)
            print(f"  -> {out}")
    return 0


if __name__ == "__main__":
    run_main(main)
