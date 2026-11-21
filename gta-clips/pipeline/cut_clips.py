#!/usr/bin/env python3
"""Нарезка моментов из VOD в вертикальные шортсы 1080x1920.

Режимы (--layout):
  cam  — сверху кроп вебки (--cam x,y,w,h в пикселях исходника), снизу геймплей;
  blur — геймплей по центру, сзади он же, растянутый и размытый.

Звук нормализуется loudnorm (по умолчанию I=-14 LUFS, TP=-1.5 dBTP, LRA=11) в два прохода:
1-й проход меряет именно вырезаемый кусок, 2-й применяет измеренные значения (linear=true).
Нарезка точная (перекодирование, -ss перед -i — в ffmpeg это кадр-точный seek).

Плашка с ником (style.streamer_name / --streamer), водяной знак (--watermark: текст или PNG),
субтитры .ass (--subs-dir: ищется <имя клипа>.ass, либо --subs файл.ass для одного клипа).
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import shutil
from pathlib import Path
from typing import Any

from _common import (PipelineError, encoder_args, ff_color, fmt_time, fmt_twitch_t, load_config, media_info, override,
                     parse_rect, parse_time, require_tool, resolve_font, run, run_main, section)


# ---------------------------------------------------------------------------
# Список моментов
# ---------------------------------------------------------------------------

def _row_time(row: dict[str, Any], *keys: str) -> float | None:
    for k in keys:
        v = row.get(k)
        if v not in (None, ""):
            try:
                return parse_time(v)
            except ValueError as e:
                raise PipelineError(f"моменты: поле '{k}' = '{v}': {e}") from e
    return None


def load_moments(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise PipelineError(f"Файл моментов не найден: {path}")
    text = path.read_text(encoding="utf-8-sig")
    rows: list[dict[str, Any]]
    if path.suffix.lower() == ".json":
        try:
            doc = json.loads(text)
        except json.JSONDecodeError as e:
            raise PipelineError(f"{path}: битый JSON: {e}") from e
        rows = doc.get("moments", []) if isinstance(doc, dict) else doc
        if not isinstance(rows, list):
            raise PipelineError(f"{path}: ожидался список моментов")
    else:
        try:
            dialect = csv.Sniffer().sniff(text[:4096], delimiters=";,\t")
            delim = dialect.delimiter
        except csv.Error:
            delim = ";"
        rows = list(csv.DictReader(io.StringIO(text), delimiter=delim))
    out = []
    for i, row in enumerate(rows, 1):
        start = _row_time(row, "start", "start_hms")
        end = _row_time(row, "end", "end_hms")
        if start is None or end is None:
            continue  # пустые строки после правки в Excel
        if end <= start:
            raise PipelineError(f"{path}: момент #{i}: end ({end}) <= start ({start})")
        rank = row.get("rank")
        try:
            rank = int(float(rank)) if rank not in (None, "") else i
        except ValueError:
            rank = i
        out.append({"rank": rank, "start": start, "end": end})
    return out


def parse_range(s: str) -> tuple[float, float]:
    m = re.match(r"^\s*(.+?)\s*(?:-|\.\.|–)\s*(.+?)\s*$", s)
    if not m:
        raise PipelineError(f"--range '{s}': ожидается START-END, например 1:02:03-1:02:40")
    try:
        a, b = parse_time(m.group(1)), parse_time(m.group(2))
    except ValueError as e:
        raise PipelineError(f"--range '{s}': {e}") from e
    if b <= a:
        raise PipelineError(f"--range '{s}': конец раньше начала")
    return a, b


# ---------------------------------------------------------------------------
# loudnorm
# ---------------------------------------------------------------------------

def measure_loudness(ffmpeg: str, video: Path, ss: float, dur: float, ln: dict[str, Any]) -> dict[str, str] | None:
    af = f"loudnorm=I={ln['I']}:TP={ln['TP']}:LRA={ln['LRA']}:print_format=json"
    proc = run([ffmpeg, "-hide_banner", "-nostats", "-ss", f"{ss:.3f}", "-t", f"{dur:.3f}", "-i", str(video),
                "-map", "0:a:0", "-vn", "-af", af, "-f", "null", "-"], what="ffmpeg (loudnorm, проход 1)")
    blocks = re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", proc.stderr or "")
    if not blocks:
        raise PipelineError("loudnorm: не удалось разобрать результат 1-го прохода")
    data = json.loads(blocks[-1])
    try:
        if float(data["input_i"]) < -70 or "inf" in str(data["input_i"]).lower():
            return None  # тишина — нормализовать нечего
    except ValueError:
        return None
    return data


def loudnorm_filter(ln: dict[str, Any], meas: dict[str, str] | None) -> str:
    base = f"loudnorm=I={ln['I']}:TP={ln['TP']}:LRA={ln['LRA']}"
    if not meas:
        return base
    return (f"{base}:measured_I={meas['input_i']}:measured_TP={meas['input_tp']}"
            f":measured_LRA={meas['input_lra']}:measured_thresh={meas['input_thresh']}"
            f":offset={meas['target_offset']}:linear=true:print_format=summary")


# ---------------------------------------------------------------------------
# Видеофильтры
# ---------------------------------------------------------------------------

def _even(x: float) -> int:
    return max(2, int(round(x / 2.0)) * 2)


def _fit_crop(src_w: int, src_h: int, aspect: float) -> tuple[int, int, int, int]:
    """Максимальный центрированный кроп с соотношением aspect (= w/h)."""
    if src_w / src_h > aspect:
        w = _even(src_h * aspect)
        h = src_h - src_h % 2
    else:
        w = src_w - src_w % 2
        h = _even(src_w / aspect)
    return w, h, (src_w - w) // 2, (src_h - h) // 2


def _check_rect(rect: tuple[int, int, int, int], src_w: int, src_h: int, what: str) -> None:
    x, y, w, h = rect
    if x + w > src_w or y + h > src_h:
        raise PipelineError(f"{what}={x},{y},{w},{h} выходит за кадр исходника {src_w}x{src_h}")


def _fill(label_in: str, rect: tuple[int, int, int, int] | None, W: int, H: int, label_out: str) -> str:
    """crop (если задан) -> заполнить W x H (scale с запасом + центр-кроп)."""
    parts = []
    if rect:
        x, y, w, h = rect
        parts.append(f"crop={w}:{h}:{x}:{y}")
    parts.append(f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos")
    parts.append(f"crop={W}:{H}")
    parts.append("setsar=1")
    return f"[{label_in}]{','.join(parts)}[{label_out}]"


def build_video_graph(info: dict[str, Any], rc: dict[str, Any], st: dict[str, Any], *,
                      layout: str, has_nick: bool, wm_text: bool, wm_image: bool, subs: bool) -> str:
    W, H = int(rc["width"]), int(rc["height"])
    sw, sh = info["width"], info["height"]
    fps = float(rc.get("fps") or 0)
    head = f"[0:v]fps={fps:g}," if fps > 0 else "[0:v]"
    chains: list[str] = []
    nick_y_expr: str

    if layout == "cam":
        cam = parse_rect(rc.get("cam_crop"), "--cam")
        if not cam:
            raise PipelineError("layout=cam требует координаты вебки: --cam x,y,w,h (пиксели исходника). "
                                "Посмотрите кадр: ffmpeg -ss 60 -i vod.mp4 -frames:v 1 frame.png")
        _check_rect(cam, sw, sh, "--cam")
        cam_h = _even(H * float(rc.get("cam_share", 0.375)))
        game_h = H - cam_h
        game = parse_rect(rc.get("game_crop"), "--game")
        if game:
            _check_rect(game, sw, sh, "--game")
        else:
            gw, gh, gx, gy = _fit_crop(sw, sh, W / game_h)
            game = (gx, gy, gw, gh)
        chains.append(f"{head}split=2[vc][vg]")
        chains.append(_fill("vc", cam, W, cam_h, "cam"))
        chains.append(_fill("vg", game, W, game_h, "game"))
        chains.append("[cam][game]vstack=inputs=2[base]")
        nick_y_expr = f"{cam_h}-text_h/2"  # плашка на стыке вебки и геймплея
    elif layout == "blur":
        zoom = max(1.0, float(rc.get("fg_zoom", 1.0)))
        cw = _even(sw / zoom)
        fg_h = _even(W * sh / cw)
        if fg_h > H:
            fg_h = H
        blur = max(1.0, float(rc.get("blur_strength", 30)))
        dim = max(0.0, min(1.0, float(rc.get("blur_dim", 0.75))))
        # фон: уменьшаем в 4 раза, размываем, растягиваем обратно — в разы быстрее boxblur на 1080x1920
        sw4, sh4 = _even(W / 4), _even(H / 4)
        chains.append(f"{head}split=2[bgsrc][fgsrc]")
        chains.append(f"[bgsrc]scale={sw4}:{sh4}:force_original_aspect_ratio=increase,crop={sw4}:{sh4},"
                      f"gblur=sigma={blur / 4:.2f},scale={W}:{H}:flags=bicubic,"
                      f"colorchannelmixer=rr={dim:.3f}:gg={dim:.3f}:bb={dim:.3f},setsar=1[bg]")
        crop = f"crop={cw}:{sh}:{(sw - cw) // 2}:0," if cw < sw else ""
        chains.append(f"[fgsrc]{crop}scale={W}:{fg_h}:force_original_aspect_ratio=increase:flags=lanczos,"
                      f"crop={W}:{fg_h},setsar=1[fg]")
        fg_y = (H - fg_h) // 2
        chains.append(f"[bg][fg]overlay=0:{fg_y}[base]")
        nick_y_expr = f"{max(40, fg_y - 30)}-text_h"  # плашка над геймплеем
    else:
        raise PipelineError(f"неизвестный layout '{layout}' (cam | blur)")

    cur = "base"
    font = "fontfile=font.ttf:expansion=none"
    if has_nick:
        chains.append(
            f"[{cur}]drawtext={font}:textfile=nick.txt:fontsize={int(st.get('nick_font_size', 54))}"
            f":fontcolor={ff_color(st.get('nick_text_color', '#FFFFFF'))}"
            f":box=1:boxcolor={ff_color(st.get('nick_box_color', '#9146FF'), st.get('nick_box_opacity', 0.85))}"
            f":boxborderw=18:x=(w-text_w)/2:y={nick_y_expr}[nick]")
        cur = "nick"
    pos = str(st.get("watermark_position", "top-right"))
    mx, top_y, bot_y = 70, 230, H - 600  # вне зоны интерфейса Shorts/TikTok
    if wm_text:
        x = "w-text_w-%d" % mx if "right" in pos else str(mx)
        y = str(bot_y) if "bottom" in pos else str(top_y)
        chains.append(
            f"[{cur}]drawtext={font}:textfile=watermark.txt:fontsize={int(st.get('watermark_font_size', 40))}"
            f":fontcolor={ff_color('#FFFFFF', st.get('watermark_opacity', 0.55))}"
            f":shadowcolor=0x000000@0.5:shadowx=2:shadowy=2:x={x}:y={y}[wm]")
        cur = "wm"
    if wm_image:
        op = max(0.0, min(1.0, float(st.get("watermark_opacity", 0.55))))
        chains.append(f"[1:v]scale=220:-1,format=rgba,colorchannelmixer=aa={op:.2f}[logo]")
        x = f"W-w-{mx}" if "right" in pos else str(mx)
        y = str(bot_y) if "bottom" in pos else str(top_y)
        chains.append(f"[{cur}][logo]overlay={x}:{y}[wm]")
        cur = "wm"
    if subs:
        chains.append(f"[{cur}]subtitles=filename=subs.ass:fontsdir=.[subs]")
        cur = "subs"
    chains.append(f"[{cur}]format=yuv420p[vout]")
    return ";".join(chains)


# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Нарезать моменты из VOD в вертикальные шортсы 1080x1920.")
    p.add_argument("video", type=Path, help="скачанный VOD (mp4/mkv/...)")
    p.add_argument("-m", "--moments", type=Path, default=None, help="moments.json или moments.csv из find_moments.py")
    p.add_argument("-r", "--range", action="append", default=[], metavar="START-END",
                   help="вручную: 1:02:03-1:02:40 (можно несколько раз)")
    p.add_argument("--only", default=None, help="только эти ранги из moments, например 1,3,5")
    p.add_argument("-o", "--out-dir", type=Path, default=Path("out/clips"))
    p.add_argument("-c", "--config", type=Path, default=None)
    p.add_argument("--layout", choices=["cam", "blur"], default=None)
    p.add_argument("--cam", default=None, help="кроп вебки x,y,w,h в пикселях исходника")
    p.add_argument("--game", default=None, help="кроп геймплея x,y,w,h (для cam; по умолчанию центр)")
    p.add_argument("--cam-share", type=float, default=None, help="доля высоты под вебку (0.35-0.40)")
    p.add_argument("--fg-zoom", type=float, default=None, help="blur: увеличение геймплея (1.0-1.6)")
    p.add_argument("--video-offset", default="0",
                   help="с какого времени VOD начинается файл (если качали кусок через --download-sections)")
    p.add_argument("--streamer", default=None, help="текст плашки с ником, например @nick")
    p.add_argument("--watermark", default=None, help="водяной знак: текст или путь к PNG")
    p.add_argument("--subs-dir", type=Path, default=None, help="папка с <имя_клипа>.ass для вжигания")
    p.add_argument("--subs", type=Path, default=None, help="один .ass для всех клипов (обычно с одним --range)")
    p.add_argument("--codec", default=None, help="libx264 | h264_nvenc | h264_qsv | h264_amf")
    p.add_argument("--crf", type=int, default=None)
    p.add_argument("--fps", type=float, default=None)
    p.add_argument("--no-loudnorm", action="store_true")
    p.add_argument("--prefix", default="clip", help="префикс имён файлов")
    p.add_argument("-y", "--overwrite", action="store_true", help="перезаписывать существующие клипы")
    p.add_argument("--dry-run", action="store_true", help="только показать команды ffmpeg")
    return p


def main() -> int:
    args = build_parser().parse_args()
    ffmpeg = require_tool("ffmpeg")
    require_tool("ffprobe")
    cfg = load_config(args.config)
    rc = override(section(cfg, "render"), layout=args.layout, cam_crop=args.cam, game_crop=args.game,
                  cam_share=args.cam_share, fg_zoom=args.fg_zoom, video_codec=args.codec, crf=args.crf, fps=args.fps)
    st = override(section(cfg, "style"), streamer_name=args.streamer, watermark=args.watermark)
    rc.setdefault("width", 1080)
    rc.setdefault("height", 1920)
    ln = {"I": -14, "TP": -1.5, "LRA": 11, "enabled": True, **(rc.get("loudnorm") or {})}
    if args.no_loudnorm:
        ln["enabled"] = False
    layout = str(rc.get("layout") or "blur")

    video = args.video.resolve()
    info = media_info(video)
    if not info.get("has_video"):
        raise PipelineError(f"{video}: нет видеодорожки")
    try:
        offset = parse_time(args.video_offset)
    except ValueError as e:
        raise PipelineError(f"--video-offset: {e}") from e

    items: list[dict[str, Any]] = []
    if args.moments:
        items += load_moments(args.moments)
    for r in args.range:
        a, b = parse_range(r)
        items.append({"rank": len(items) + 1, "start": a, "end": b})
    if args.only:
        try:
            keep = {int(x) for x in re.split(r"[,\s]+", args.only.strip()) if x}
        except ValueError as e:
            raise PipelineError(f"--only: ожидается список чисел, получено '{args.only}'") from e
        items = [m for m in items if m["rank"] in keep]
    if not items:
        raise PipelineError("Нет моментов: укажите --moments moments.json или --range START-END")

    font_path, _font_name = resolve_font(st)
    nick = st.get("streamer_name")
    wm = st.get("watermark")
    wm_image = bool(wm) and Path(str(wm)).suffix.lower() in (".png", ".webp") and Path(str(wm)).is_file()
    if wm and not wm_image and Path(str(wm)).suffix.lower() in (".png", ".webp"):
        raise PipelineError(f"водяной знак-картинка не найден: {wm}")

    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    work = out_dir / "_work"
    work.mkdir(exist_ok=True)
    shutil.copyfile(font_path, work / "font.ttf")
    # Тексты кладём в файлы: так не нужно экранировать ник/кавычки/двоеточия в фильтрах ffmpeg.
    if nick:
        (work / "nick.txt").write_text(str(nick), encoding="utf-8")
    if wm and not wm_image:
        (work / "watermark.txt").write_text(str(wm), encoding="utf-8")

    print(f"VOD: {video}  {info['width']}x{info['height']} @ {info['fps']:.2f} fps, "
          f"длительность {fmt_time(info['duration'] or 0, False)}, layout={layout}, клипов: {len(items)}")
    manifest = []
    for m in items:
        ss = m["start"] - offset
        dur = m["end"] - m["start"]
        if info["duration"]:
            if ss >= info["duration"]:
                print(f"  #{m['rank']}: {fmt_time(m['start'])} вне файла (offset={offset}) — пропуск")
                continue
            dur = min(dur, info["duration"] - max(ss, 0))
        if ss < 0:
            dur += ss
            ss = 0.0
        if dur < 1:
            print(f"  #{m['rank']}: слишком короткий после обрезки — пропуск")
            continue
        name = f"{args.prefix}_{m['rank']:02d}_{fmt_twitch_t(m['start'])}"
        out = out_dir / f"{name}.mp4"
        if out.exists() and not args.overwrite and not args.dry_run:
            print(f"  #{m['rank']}: {out.name} уже есть (используйте -y для перезаписи)")
            manifest.append({"rank": m["rank"], "file": str(out), "start": m["start"], "end": m["end"]})
            continue

        subs_src = None
        if args.subs:
            subs_src = args.subs
        elif args.subs_dir:
            cand = args.subs_dir / f"{name}.ass"
            subs_src = cand if cand.is_file() else None
            if not subs_src:
                print(f"  #{m['rank']}: нет {cand.name} в {args.subs_dir} — без субтитров")
        if subs_src:
            if not subs_src.is_file():
                raise PipelineError(f"файл субтитров не найден: {subs_src}")
            shutil.copyfile(subs_src, work / "subs.ass")

        graph = build_video_graph(info, rc, st, layout=layout, has_nick=bool(nick), wm_text=bool(wm) and not wm_image,
                                  wm_image=wm_image, subs=bool(subs_src))
        cmd = [ffmpeg, "-hide_banner", "-y", "-ss", f"{ss:.3f}", "-i", str(video)]
        if wm_image:
            cmd += ["-i", str(Path(str(wm)).resolve())]
        cmd += ["-t", f"{dur:.3f}", "-filter_complex", graph, "-map", "[vout]"]
        meas = None
        if info["has_audio"]:
            afilters = []
            if ln.get("enabled"):
                if not args.dry_run:
                    meas = measure_loudness(ffmpeg, video, ss, dur, ln)
                afilters.append(loudnorm_filter(ln, meas))
            afilters.append("aresample=48000")
            fade = float(rc.get("fade_sec", 0) or 0)
            if fade > 0 and dur > 4 * fade:
                afilters.append(f"afade=t=in:d={fade}")
                afilters.append(f"afade=t=out:st={dur - fade:.3f}:d={fade}")
            cmd += ["-map", "0:a:0", "-af", ",".join(afilters), "-c:a", "aac",
                    "-b:a", str(rc.get("audio_bitrate", "192k")), "-ar", "48000", "-ac", "2"]
        cmd += encoder_args(rc) + ["-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)]

        print(f"  #{m['rank']}: {fmt_time(m['start'])} - {fmt_time(m['end'])} ({dur:.1f}s) -> {out.name}"
              + (f"  [loudnorm: {meas['input_i']} LUFS -> {ln['I']}]" if meas else "")
              + ("  [+субтитры]" if subs_src else ""))
        if args.dry_run:
            print("    " + " ".join(f'"{c}"' if " " in str(c) or ";" in str(c) else str(c) for c in cmd))
            continue
        run(cmd, cwd=work, what=f"ffmpeg (клип #{m['rank']})")
        manifest.append({"rank": m["rank"], "file": str(out), "start": m["start"], "end": m["end"],
                         "layout": layout})

    if not args.dry_run:
        (out_dir / "clips.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        shutil.rmtree(work, ignore_errors=True)
        print(f"\nГотово: {len(manifest)} клип(ов) в {out_dir}")
    return 0


if __name__ == "__main__":
    run_main(main)
