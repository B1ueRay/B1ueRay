#!/usr/bin/env python3
"""Поиск смешных моментов стрима по реакции чата.

Поддерживаемые форматы чата (определяются автоматически):
  * TwitchDownloaderCLI `chatdownload` JSON (.json или .json.gz):
        {"streamer": {...}, "video": {"id", "start", "end", "length", ...},
         "comments": [{"content_offset_seconds": 12.3,
                       "commenter": {"name", "display_name", ...},
                       "message": {"body": "...", "fragments": [{"text", "emoticon"}], ...}}, ...]}
  * yt-dlp `--write-subs --sub-langs live_chat` -> <name>.live_chat.json (JSON Lines):
        {"replayChatItemAction": {"actions": [{"addChatItemAction": {"item": {
            "liveChatTextMessageRenderer": {"message": {"runs": [{"text"} | {"emoji"}]},
                                            "authorName": {"simpleText"}, ...}}}}],
                                  "videoOffsetTimeMsec": "12345"}}

Алгоритм:
  1. Каждое сообщение получает вес активности (message_weight, с антиспамом по юзеру)
     и смех-вес (сумма весов смех-маркеров из config.yaml, с потолком).
  2. Веса суммируются в скользящем окне (window_sec, центрированное) -> H(t).
  3. Базовый уровень B(t) — скользящая медиана H за baseline_sec (устойчива к всплескам),
     score(t) = H(t) / max(B(t), baseline_floor). Так просто активный чат не даёт пиков.
  4. Окна, где доля смеха < min_laugh_share, отбрасываются (это хайп/донат, а не угар).
  5. Пики выбираются жадно по score с разносом min_gap_sec. Для каждого пика находится
     всплеск (где score >= половины пика), время сдвигается назад на chat_delay_sec,
     добавляются отступы pad_before/pad_after.

Выход: moments.json + moments.csv (+ chat_activity.png с --plot).
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import math
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from _common import (PipelineError, fmt_time, fmt_twitch_t, load_config, override, parse_time,
                     run_main, section)

try:
    import numpy as np
except ImportError:  # pragma: no cover
    np = None  # проверяется в main()


@dataclass(slots=True)
class Msg:
    t: float
    user: str
    text: str


# ---------------------------------------------------------------------------
# Чтение чата
# ---------------------------------------------------------------------------

def _read_text(path: Path) -> str:
    raw = path.read_bytes()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise PipelineError(f"{path}: файл не в UTF-8 (ожидается JSON из TwitchDownloader или yt-dlp)") from e


def _twitch_text(message: dict[str, Any]) -> str:
    body = message.get("body")
    if isinstance(body, str) and body:
        return body
    frags = message.get("fragments") or []
    return "".join(str(f.get("text", "")) for f in frags if isinstance(f, dict))


def parse_twitch(doc: dict[str, Any]) -> tuple[list[Msg], dict[str, Any]]:
    msgs: list[Msg] = []
    for c in doc.get("comments") or []:
        try:
            t = float(c["content_offset_seconds"])
        except (KeyError, TypeError, ValueError):
            continue
        commenter = c.get("commenter") or {}
        user = str(commenter.get("name") or commenter.get("_id") or commenter.get("display_name") or "?")
        text = _twitch_text(c.get("message") or {})
        msgs.append(Msg(t, user, text))
    video = doc.get("video") or {}
    streamer = doc.get("streamer") or {}
    meta = {
        "platform": "twitch",
        "video_id": str(video.get("id") or "") or None,
        "title": video.get("title"),
        "streamer": streamer.get("name") or streamer.get("login") or video.get("user_name"),
        "length": float(video["length"]) if isinstance(video.get("length"), (int, float)) and video["length"] > 0 else None,
    }
    return msgs, meta


def _yt_runs_text(runs: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for r in runs or []:
        if "text" in r:
            parts.append(str(r["text"]))
        elif "emoji" in r:
            e = r["emoji"] or {}
            shortcuts = e.get("shortcuts") or []
            if e.get("isCustomEmoji"):
                # кастомные эмодзи канала: ":_kekw:" -> " kekw "
                sc = str(shortcuts[0]) if shortcuts else str(e.get("emojiId", ""))
                parts.append(f" {sc.strip(':').lstrip('_')} ")
            else:
                parts.append(str(e.get("emojiId") or (shortcuts[0] if shortcuts else "")))
    return "".join(parts)


_YT_RENDERERS = ("liveChatTextMessageRenderer", "liveChatPaidMessageRenderer")


def parse_youtube_lines(text: str) -> tuple[list[Msg], dict[str, Any]]:
    msgs: list[Msg] = []
    bad = 0
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            bad += 1
            continue
        rep = obj.get("replayChatItemAction")
        if not isinstance(rep, dict):
            continue
        off = rep.get("videoOffsetTimeMsec", obj.get("videoOffsetTimeMsec"))
        try:
            t = int(off) / 1000.0
        except (TypeError, ValueError):
            continue
        for action in rep.get("actions") or []:
            item = ((action or {}).get("addChatItemAction") or {}).get("item") or {}
            for key in _YT_RENDERERS:
                r = item.get(key)
                if not r:
                    continue
                user = ((r.get("authorName") or {}).get("simpleText")
                        or r.get("authorExternalChannelId") or "?")
                msgs.append(Msg(t, str(user), _yt_runs_text((r.get("message") or {}).get("runs") or [])))
    if bad:
        print(f"  предупреждение: пропущено {bad} битых строк JSON")
    return msgs, {"platform": "youtube", "video_id": None, "title": None, "streamer": None, "length": None}


def load_chat(path: Path) -> tuple[list[Msg], dict[str, Any]]:
    if not path.is_file():
        raise PipelineError(f"Файл чата не найден: {path}")
    text = _read_text(path)
    stripped = text.lstrip()
    if not stripped:
        raise PipelineError(f"{path}: пустой файл")
    doc = None
    if stripped.startswith("{"):
        try:
            doc = json.loads(stripped)
        except json.JSONDecodeError:
            doc = None  # вероятно JSON Lines
    if isinstance(doc, dict) and "comments" in doc:
        msgs, meta = parse_twitch(doc)
    elif isinstance(doc, dict) and "replayChatItemAction" in doc:
        msgs, meta = parse_youtube_lines(stripped)  # файл из одной строки
    elif doc is None:
        msgs, meta = parse_youtube_lines(stripped)
    else:
        raise PipelineError(f"{path}: неизвестный формат чата. Ожидается JSON TwitchDownloaderCLI "
                            "(chatdownload -o chat.json) или yt-dlp live_chat.json")
    if not msgs:
        raise PipelineError(f"{path}: в чате не найдено ни одного сообщения")
    msgs.sort(key=lambda m: m.t)
    return msgs, meta


# ---------------------------------------------------------------------------
# Смех-маркеры
# ---------------------------------------------------------------------------

_TOKEN_STRIP = ".,!?;:()[]{}\"'«»…*~|<>"


class LaughScorer:
    def __init__(self, markers: dict[str, Any], cap: float):
        self.case_sensitive = bool(markers.get("emotes_case_sensitive", False))
        self.emotes: dict[str, float] = {}
        for k, v in (markers.get("emotes") or {}).items():
            key = str(k) if self.case_sensitive else str(k).casefold()
            self.emotes[key] = max(self.emotes.get(key, 0.0), float(v))
        self.emoji = [(str(k), float(v)) for k, v in (markers.get("emoji") or {}).items()]
        self.regex = []
        for pat, w in (markers.get("regex") or {}).items():
            try:
                self.regex.append((re.compile(str(pat), re.IGNORECASE), float(w)))
            except re.error as e:
                raise PipelineError(f"config laugh_markers.regex: неверное выражение '{pat}': {e}") from e
        if not (self.emotes or self.emoji or self.regex):
            raise PipelineError("config: список laugh_markers пуст")
        self.cap = float(cap)

    def __call__(self, text: str) -> float:
        w = 0.0
        if self.emotes:
            for tok in text.split():
                tok = tok.strip(_TOKEN_STRIP)
                if not tok:
                    continue
                w += self.emotes.get(tok if self.case_sensitive else tok.casefold(), 0.0)
        for e, ew in self.emoji:
            n = text.count(e)
            if n:
                w += n * ew
        for rx, rw in self.regex:
            if rx.search(text):
                w += rw
        return min(w, self.cap)


# ---------------------------------------------------------------------------
# Анализ
# ---------------------------------------------------------------------------

def _window_sum(arr, k: int):
    """Центрированная сумма по окну из k бинов (той же длины, что arr)."""
    c = np.concatenate(([0.0], np.cumsum(arr)))
    n = len(arr)
    half_l = k // 2
    idx = np.arange(n)
    lo = np.clip(idx - half_l, 0, n)
    hi = np.clip(idx - half_l + k, 0, n)
    return c[hi] - c[lo]


def _rolling_median(arr, k: int):
    """Центрированная скользящая медиана (считается на прореженной сетке + интерполяция)."""
    n = len(arr)
    if n == 0:
        return arr
    k = max(3, min(k, n))
    stride = max(1, k // 30)
    centers = np.arange(0, n, stride)
    if centers[-1] != n - 1:
        centers = np.append(centers, n - 1)
    half = k // 2
    med = np.empty(len(centers))
    for j, c in enumerate(centers):
        lo = max(0, c - half)
        hi = min(n, lo + k)
        lo = max(0, hi - k)
        med[j] = np.median(arr[lo:hi])
    return np.interp(np.arange(n), centers, med)


def _normalize_msg(text: str) -> str:
    toks = text.split()
    out: list[str] = []
    for tok in toks:  # схлопываем «KEKW KEKW KEKW» -> «KEKW»
        if not out or out[-1].casefold() != tok.casefold():
            out.append(tok)
    s = " ".join(out)
    return s[:80] + ("…" if len(s) > 80 else "")


def analyze(msgs: list[Msg], conf: dict[str, Any], scorer: LaughScorer,
            t_from: float | None, t_to: float | None, media_len: float | None) -> dict[str, Any]:
    step = float(conf["step_sec"])
    if step <= 0:
        raise PipelineError("step_sec должен быть > 0")
    msgs = [m for m in msgs if (t_from is None or m.t >= t_from) and (t_to is None or m.t <= t_to)]
    if len(msgs) < 10:
        raise PipelineError(f"Слишком мало сообщений в выбранном диапазоне ({len(msgs)}) для анализа")
    origin = float(t_from) if t_from is not None else math.floor(max(0.0, msgs[0].t))
    end_t = float(t_to) if t_to is not None else msgs[-1].t
    n = int(math.ceil((end_t - origin) / step)) + 1

    act = np.zeros(n)
    laugh = np.zeros(n)
    cnt = np.zeros(n)
    bins: list[int] = []
    last_seen: dict[str, float] = {}
    cooldown = float(conf["user_cooldown_sec"])
    repeat_f = float(conf["user_repeat_factor"])
    mw = float(conf["message_weight"])
    lw_list: list[float] = []
    for m in msgs:
        b = min(n - 1, max(0, int((m.t - origin) / step)))
        bins.append(b)
        f = 1.0
        prev = last_seen.get(m.user)
        if prev is not None and m.t - prev < cooldown:
            f = repeat_f
        last_seen[m.user] = m.t
        lw = scorer(m.text)
        lw_list.append(lw)
        act[b] += mw * f
        laugh[b] += lw * f
        cnt[b] += 1

    k = max(1, int(round(float(conf["window_sec"]) / step)))
    w_act = _window_sum(act, k)
    w_laugh = _window_sum(laugh, k)
    w_cnt = _window_sum(cnt, k)
    hype = w_act + w_laugh
    base = _rolling_median(hype, max(k * 3, int(round(float(conf["baseline_sec"]) / step))))
    base = np.maximum(base, float(conf["baseline_floor"]))
    score = hype / base
    share = w_laugh / np.maximum(w_cnt, 1.0)
    eligible = (share >= float(conf["min_laugh_share"])) & (score >= float(conf["min_score"]))

    # --- выбор пиков ---
    gap_bins = max(1, int(round(float(conf["min_gap_sec"]) / step)))
    order = np.argsort(-score, kind="stable")
    picked: list[int] = []
    taken = np.zeros(n, dtype=bool)
    top_n = int(conf["top_n"])
    for i in order:
        if len(picked) >= top_n:
            break
        if not eligible[i] or taken[i]:
            continue
        picked.append(int(i))
        taken[max(0, i - gap_bins):min(n, i + gap_bins + 1)] = True

    delay = float(conf["chat_delay_sec"])
    pad_b = float(conf["pad_before_sec"])
    pad_a = float(conf["pad_after_sec"])
    min_len = float(conf["min_clip_sec"])
    max_len = float(conf["max_clip_sec"])
    if max_len < min_len:
        raise PipelineError("max_clip_sec меньше min_clip_sec")
    bins_arr = np.asarray(bins)
    texts = [m.text for m in msgs]

    moments = []
    for i in picked:
        peak = score[i]
        half = max(float(conf["min_score"]) * 0.75, peak * 0.5)
        a = i
        while a > 0 and score[a - 1] >= half and i - a < gap_bins:
            a -= 1
        b = i
        while b < n - 1 and score[b + 1] >= half and b - i < gap_bins:
            b += 1
        burst_start = origin + a * step
        burst_end = origin + (b + 1) * step
        event = burst_start - delay
        start = event - pad_b
        end = burst_end - delay + pad_a
        if end - start > max_len:
            end = start + max_len
        if end - start < min_len:
            extra = min_len - (end - start)
            start -= extra * 0.4
            end += extra * 0.6
        if start < 0:
            end -= start
            start = 0.0
        if media_len:
            if end > media_len:
                start = max(0.0, start - (end - media_len))
                end = media_len
        # сообщения всплеска
        lo_b = int((burst_start - origin) / step)
        hi_b = int((burst_end - origin) / step)
        sel = np.nonzero((bins_arr >= lo_b) & (bins_arr <= hi_b))[0]
        counter = Counter(_normalize_msg(texts[j]) for j in sel if texts[j].strip())
        top = [f"{t} (x{c})" if c > 1 else t for t, c in counter.most_common(int(conf["top_messages"]))]
        moments.append({
            "start": round(start, 2),
            "end": round(end, 2),
            "duration": round(end - start, 2),
            "event_time": round(max(0.0, event), 2),
            "chat_peak": round(origin + i * step, 2),
            "score": round(float(peak), 3),
            "messages": int(len(sel)),
            "laugh_weight": round(float(sum(lw_list[j] for j in sel)), 1),
            "laugh_share": round(float(share[i]), 3),
            "top_messages": top,
        })
    moments.sort(key=lambda m: -m["score"])
    for r, m in enumerate(moments, 1):
        m["rank"] = r

    return {
        "moments": moments,
        "series": {
            "t": origin + np.arange(n) * step,
            "score": score,
            "w_cnt": w_cnt,
            "w_laugh": w_laugh,
        },
        "stats": {"messages": len(msgs), "from": origin, "to": end_t,
                  "median_msgs_per_window": float(np.median(w_cnt))},
    }


# ---------------------------------------------------------------------------
# Вывод
# ---------------------------------------------------------------------------

def make_link(meta: dict[str, Any], t: float) -> str | None:
    vid = meta.get("video_id")
    if not vid:
        return None
    t = max(0, int(t) - 3)
    if meta.get("platform") == "twitch":
        return f"https://www.twitch.tv/videos/{vid}?t={fmt_twitch_t(t)}"
    if meta.get("platform") == "youtube":
        return f"https://youtu.be/{vid}?t={t}"
    return None


CSV_FIELDS = ["rank", "start", "end", "duration", "start_hms", "end_hms", "event_hms", "score",
              "messages", "laugh_share", "link", "top_messages"]


def write_outputs(result: dict[str, Any], meta: dict[str, Any], out_dir: Path, chat_path: Path,
                  params: dict[str, Any], delimiter: str) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    for m in result["moments"]:
        m["start_hms"] = fmt_time(m["start"])
        m["end_hms"] = fmt_time(m["end"])
        m["event_hms"] = fmt_time(m["event_time"], ms=False)
        m["link"] = make_link(meta, m["event_time"])
    jpath = out_dir / "moments.json"
    doc = {
        "source_chat": str(chat_path),
        "platform": meta.get("platform"),
        "video_id": meta.get("video_id"),
        "streamer": meta.get("streamer"),
        "title": meta.get("title"),
        "stats": result["stats"],
        "params": params,
        "moments": result["moments"],
    }
    jpath.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    cpath = out_dir / "moments.csv"
    # utf-8-sig — чтобы Excel правильно показал кириллицу
    with cpath.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS, delimiter=delimiter, extrasaction="ignore")
        w.writeheader()
        for m in result["moments"]:
            row = dict(m)
            row["top_messages"] = " | ".join(m["top_messages"])
            row["link"] = m["link"] or ""
            w.writerow(row)
    return jpath, cpath


def plot(result: dict[str, Any], conf: dict[str, Any], out: Path, title: str) -> Path | None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.ticker import FuncFormatter
    except ImportError:
        print("  matplotlib не установлен — график пропущен (pip install matplotlib)")
        return None
    s = result["series"]
    t = s["t"]
    span = float(t[-1] - t[0]) if len(t) > 1 else 1.0
    width = max(12.0, min(48.0, span / 300.0))
    ink, ink2, grid, surface = "#0b0b0b", "#52514e", "#e4e3df", "#fcfcfb"
    blue, orange = "#2a78d6", "#eb6834"
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(width, 6.5), sharex=True, facecolor=surface,
                                   gridspec_kw={"height_ratios": [3, 2], "hspace": 0.12})
    for ax in (ax1, ax2):
        ax.set_facecolor(surface)
        ax.grid(axis="y", color=grid, linewidth=0.8)
        for side in ("top", "right"):
            ax.spines[side].set_visible(False)
        for side in ("left", "bottom"):
            ax.spines[side].set_color(grid)
        ax.tick_params(colors=ink2, labelsize=9)
    ax1.plot(t, s["score"], color=blue, linewidth=1.6)
    ax1.axhline(float(conf["min_score"]), color=ink2, linewidth=1, linestyle=(0, (4, 3)))
    ax1.text(t[0], float(conf["min_score"]), f"  порог {conf['min_score']}", va="bottom", fontsize=8, color=ink2)
    ymax = float(max(s["score"].max(), float(conf["min_score"])) * 1.15)
    ax1.set_ylim(0, ymax)
    for m in result["moments"]:
        ax1.axvspan(m["start"], m["end"], color=blue, alpha=0.10, linewidth=0)
        ax1.annotate(f"#{m['rank']}", (m["chat_peak"], min(m["score"], ymax / 1.15)),
                     xytext=(0, 6), textcoords="offset points", ha="center", fontsize=8, color=ink)
    ax1.set_ylabel("индекс угара (x базового)", color=ink2, fontsize=9)
    ax1.set_title(title, loc="left", color=ink, fontsize=11)
    ax2.plot(t, s["w_cnt"], color=blue, linewidth=1.2, label=f"сообщений за {conf['window_sec']} с")
    ax2.plot(t, s["w_laugh"], color=orange, linewidth=1.2, label="смех-вес за окно")
    ax2.set_ylabel("чат", color=ink2, fontsize=9)
    ax2.legend(loc="upper right", frameon=False, fontsize=8, labelcolor=ink2)
    ax2.xaxis.set_major_formatter(FuncFormatter(lambda x, _: fmt_time(x, ms=False)))
    ax2.set_xlim(t[0], t[-1])
    fig.savefig(out, dpi=110, bbox_inches="tight", facecolor=surface)
    plt.close(fig)
    return out


# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Найти смешные моменты стрима по чату (Twitch/YouTube).")
    p.add_argument("chat", type=Path, help="chat.json (TwitchDownloaderCLI) или *.live_chat.json (yt-dlp)")
    p.add_argument("-o", "--out-dir", type=Path, default=Path("out"), help="куда писать moments.json/csv (по умолчанию ./out)")
    p.add_argument("-c", "--config", type=Path, default=None, help="путь к config.yaml (по умолчанию рядом со скриптом)")
    p.add_argument("-n", "--top", type=int, default=None, help="сколько моментов вернуть (top_n)")
    p.add_argument("--window", type=float, default=None, help="окно, сек (window_sec)")
    p.add_argument("--baseline", type=float, default=None, help="окно базового уровня, сек (baseline_sec)")
    p.add_argument("--delay", type=float, default=None, help="задержка реакции чата, сек (chat_delay_sec)")
    p.add_argument("--pad-before", type=float, default=None)
    p.add_argument("--pad-after", type=float, default=None)
    p.add_argument("--min-score", type=float, default=None)
    p.add_argument("--min-gap", type=float, default=None, help="мин. расстояние между моментами, сек")
    p.add_argument("--max-len", type=float, default=None, help="макс. длина клипа, сек (max_clip_sec)")
    p.add_argument("--from", dest="t_from", default=None, help="анализировать чат начиная с (1:00:00)")
    p.add_argument("--to", dest="t_to", default=None, help="... и до (2:00:00)")
    p.add_argument("--video-length", default=None, help="длина видео (чтобы клипы не вылезали за конец)")
    p.add_argument("--video-id", default=None, help="ID видео для ссылок (для YouTube — из URL)")
    p.add_argument("--platform", choices=["twitch", "youtube"], default=None, help="переопределить платформу для ссылок")
    p.add_argument("--plot", action="store_true", help="сохранить PNG-график активности чата")
    return p


def main() -> int:
    args = build_parser().parse_args()
    if np is None:
        raise PipelineError("Не установлен numpy. Выполните: pip install -r requirements.txt")
    cfg = load_config(args.config)
    conf = override(section(cfg, "chat"), top_n=args.top, window_sec=args.window, baseline_sec=args.baseline,
                    chat_delay_sec=args.delay, pad_before_sec=args.pad_before, pad_after_sec=args.pad_after,
                    min_score=args.min_score, min_gap_sec=args.min_gap, max_clip_sec=args.max_len)
    defaults = {"window_sec": 15, "step_sec": 1, "baseline_sec": 300, "baseline_floor": 4.0, "chat_delay_sec": 7,
                "message_weight": 1.0, "max_laugh_per_message": 5.0, "user_cooldown_sec": 4,
                "user_repeat_factor": 0.3, "min_laugh_share": 0.15, "min_score": 1.8, "min_gap_sec": 45,
                "top_n": 15, "pad_before_sec": 20, "pad_after_sec": 8, "min_clip_sec": 15, "max_clip_sec": 59,
                "csv_delimiter": ";", "top_messages": 6}
    for k, v in defaults.items():
        conf.setdefault(k, v)
    scorer = LaughScorer(section(cfg, "laugh_markers"), conf["max_laugh_per_message"])

    try:
        t_from = parse_time(args.t_from) if args.t_from else None
        t_to = parse_time(args.t_to) if args.t_to else None
        media_len = parse_time(args.video_length) if args.video_length else None
    except ValueError as e:
        raise PipelineError(str(e)) from e

    print(f"Чат: {args.chat}")
    msgs, meta = load_chat(args.chat)
    if args.video_id:
        meta["video_id"] = args.video_id
    if args.platform:
        meta["platform"] = args.platform
    media_len = media_len or meta.get("length")
    print(f"  формат: {meta['platform']}, сообщений: {len(msgs)}, "
          f"диапазон: {fmt_time(msgs[0].t, False)} - {fmt_time(msgs[-1].t, False)}")

    result = analyze(msgs, conf, scorer, t_from, t_to, media_len)
    params = {k: conf[k] for k in defaults if k in conf}
    jpath, cpath = write_outputs(result, meta, args.out_dir, args.chat, params, str(conf["csv_delimiter"]))

    moms = result["moments"]
    print(f"\nНайдено моментов: {len(moms)} (медиана сообщений за окно: "
          f"{result['stats']['median_msgs_per_window']:.1f})")
    for m in moms:
        top = "; ".join(m["top_messages"][:3])
        print(f"  #{m['rank']:>2}  {m['start_hms']} - {m['end_hms']}  ({m['duration']:.0f}s)  "
              f"score={m['score']:.2f}  смех={m['laugh_share']:.2f}  | {top}")
    if not moms:
        print("  Ничего не прошло порог. Попробуйте --min-score 1.4 или уменьшить min_laugh_share в config.yaml")
    print(f"\n-> {jpath}\n-> {cpath}")
    if args.plot:
        title = f"{meta.get('streamer') or ''} {meta.get('title') or args.chat.name}".strip()
        png = plot(result, conf, args.out_dir / "chat_activity.png", title)
        if png:
            print(f"-> {png}")
    return 0


if __name__ == "__main__":
    run_main(main)
