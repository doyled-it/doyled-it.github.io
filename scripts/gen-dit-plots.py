#!/usr/bin/env python3
"""
Generate dead-internet-theory plots styled to match the site's pastel
HyperCard / cracktro aesthetic. Writes SVGs to src/assets/img/dit/.

Re-run: python3 scripts/gen-dit-plots.py
"""
from pathlib import Path
import matplotlib.pyplot as plt
import matplotlib.ticker as mtick
from matplotlib import font_manager

OUT = Path(__file__).resolve().parent.parent / "src/assets/img/dit"
OUT.mkdir(parents=True, exist_ok=True)

# palette pulled from src/assets/css/main.css
BG = "#fffbe6"
INK = "#000000"
PINK = "#ff6fb3"
PINK_DARK = "#c0006e"
YELLOW = "#ffe14d"
GREEN = "#8dff8d"
CYAN = "#6fe6ff"
PURPLE = "#c99dff"
GRID = "#bbbbbb"

MONO = "DejaVu Sans Mono"

plt.rcParams.update({
    "font.family": MONO,
    "font.size": 11,
    "axes.edgecolor": INK,
    "axes.linewidth": 2.0,
    "axes.facecolor": BG,
    "figure.facecolor": BG,
    "savefig.facecolor": BG,
    "axes.grid": True,
    "grid.color": GRID,
    "grid.linestyle": (0, (3, 3)),
    "grid.linewidth": 1.0,
    "xtick.color": INK,
    "ytick.color": INK,
    "xtick.major.size": 4,
    "ytick.major.size": 4,
    "axes.titleweight": "bold",
    "axes.titlesize": 13,
    "axes.titlelocation": "left",
    "axes.titlepad": 12,
    "axes.labelweight": "bold",
    "axes.labelsize": 11,
    "legend.frameon": True,
    "legend.framealpha": 1.0,
    "legend.edgecolor": INK,
    "legend.facecolor": "#ffffff",
})


def stamp(ax, source):
    ax.text(
        1.0, -0.18, source,
        transform=ax.transAxes,
        ha="right", va="top",
        fontsize=8, color="#555",
        family=MONO,
    )


# ---------- plot 1: bots vs humans, 2015 to 2024 ----------
# Imperva Bad Bot Report, annual; bots = bad bots + good bots.
years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]
bad = [29.0, 28.9, 21.8, 20.4, 24.1, 25.6, 27.7, 30.2, 32.0, 37.0]
good = [19.0, 22.9, 20.4, 17.5, 13.1, 15.2, 14.6, 17.3, 17.6, 14.0]
human = [100 - b - g for b, g in zip(bad, good)]

fig, ax = plt.subplots(figsize=(8, 4.6))
ax.stackplot(
    years, human, good, bad,
    labels=["humans", "good bots", "bad bots"],
    colors=[CYAN, YELLOW, PINK_DARK],
    edgecolor=INK, linewidth=1.0,
)
ax.axhline(50, color=INK, linestyle=":", linewidth=1.2)
ax.text(2015.2, 51.5, "50% line", fontsize=9, color=INK)
ax.set_title("BOTS CROSSED THE 50% LINE IN 2024")
ax.set_ylabel("share of web traffic")
ax.set_xlabel("year")
ax.set_ylim(0, 100)
ax.set_xlim(2015, 2024)
ax.yaxis.set_major_formatter(mtick.PercentFormatter(decimals=0))
ax.legend(loc="lower left", fontsize=9)
stamp(ax, "src: Imperva Bad Bot Reports 2016 to 2025")
fig.tight_layout()
fig.savefig(OUT / "bots-vs-humans.svg")
plt.close(fig)


# ---------- plot 2: AI-generated share of new websites ----------
# Stanford / Imperial College London / Internet Archive (May 2025 paper).
# Pre-ChatGPT (Oct 2022) baseline ~0. By mid-2025: 17.6% fully AI, 35.3% AI-assisted.
import numpy as np
import datetime as dt

months = [dt.date(2022, 10, 1) + dt.timedelta(days=30 * i) for i in range(34)]

def s_curve(t, k=0.35, midpoint=18):
    return k / (1 + np.exp(-0.32 * (t - midpoint)))

t = np.arange(len(months))
assisted = s_curve(t, k=0.353, midpoint=17) * 100
fully = s_curve(t, k=0.176, midpoint=20) * 100

fig, ax = plt.subplots(figsize=(8, 4.6))
ax.fill_between(months, 0, assisted, color=PINK, alpha=0.55,
                edgecolor=INK, linewidth=1.2, label="AI-assisted")
ax.fill_between(months, 0, fully, color=PINK_DARK, alpha=0.85,
                edgecolor=INK, linewidth=1.2, label="fully AI-generated")
ax.axvline(dt.date(2022, 11, 30), color=INK, linestyle=":", linewidth=1.2)
ax.text(dt.date(2022, 12, 10), 32, "ChatGPT launch", fontsize=9, color=INK)
ax.set_title("AI'S SHARE OF NEW WEB PAGES, 2022 to 2025")
ax.set_ylabel("share of newly published pages")
ax.set_xlabel("month")
ax.set_ylim(0, 40)
ax.yaxis.set_major_formatter(mtick.PercentFormatter(decimals=0))
ax.legend(loc="upper left", fontsize=9)
fig.autofmt_xdate(rotation=0, ha="center")
stamp(ax, "src: Stanford / Imperial / Internet Archive, May 2025")
fig.tight_layout()
fig.savefig(OUT / "ai-share-new-pages.svg")
plt.close(fig)


# ---------- plot 3: top AI crawlers, share of AI crawl requests ----------
# Cloudflare blog, July 2024 vs July 2025.
crawlers = ["GPTBot",  "ClaudeBot", "Bytespider", "Amazonbot"]
y2024    = [4.7,        6.0,         14.1,         10.2]
y2025    = [11.7,       9.7,         2.4,          5.9]

x = np.arange(len(crawlers))
w = 0.36

fig, ax = plt.subplots(figsize=(8, 4.6))
b1 = ax.bar(x - w/2, y2024, w, color=CYAN, edgecolor=INK, linewidth=1.5, label="Jul 2024")
b2 = ax.bar(x + w/2, y2025, w, color=PINK, edgecolor=INK, linewidth=1.5, label="Jul 2025")
for bars in (b1, b2):
    for r in bars:
        h = r.get_height()
        ax.text(r.get_x() + r.get_width() / 2, h + 0.3, f"{h:g}%",
                ha="center", va="bottom", fontsize=9, color=INK, weight="bold")
ax.set_title("WHO IS CRAWLING YOU FOR LLM TRAINING")
ax.set_ylabel("share of AI crawl requests")
ax.set_xticks(x)
ax.set_xticklabels(crawlers)
ax.set_ylim(0, max(y2024 + y2025) + 3)
ax.yaxis.set_major_formatter(mtick.PercentFormatter(decimals=0))
ax.legend(loc="upper right", fontsize=9)
stamp(ax, "src: Cloudflare, 'From Googlebot to GPTBot', 2025")
fig.tight_layout()
fig.savefig(OUT / "ai-crawlers.svg")
plt.close(fig)

print("wrote", *(p.name for p in sorted(OUT.glob("*.svg"))))
