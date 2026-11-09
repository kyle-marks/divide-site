#!/usr/bin/env python3
"""Checks the landing page before it ships. Standard library only.

    python3 scripts/check_site.py

- receipt: the hero's line items add up to its total, and "Drea owes you"
  follows from a 50/50 split of those lines (the payer absorbs an odd cent).
- media: every file under media/ the page uses exists, each is at most
  1.6 MB, and they total at most 6.5 MB.
- preload: every video.clip has preload="none".
- forbidden: the page doesn't mention unbuilt features or competitors.
- links: every beta button points to the same URL.
"""

import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_FILE = 1.6 * 1024 * 1024
MAX_TOTAL = 6.5 * 1024 * 1024
FORBIDDEN = ["e-transfer", "interac", "splitwise", "tricount", "receipt scanning", "divide plus"]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []          # (cents, payer)
        self.total_text = ""
        self.amount_text = ""
        self.media = set()
        self.videos = []        # attrs of video.clip
        self.beta_hrefs = []
        self.text = []
        self._in = None
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = (a.get("class") or "").split()
        if tag in ("script", "style"):
            self._skip += 1
        if tag == "tr" and "data-cents" in a:
            self.rows.append((int(a["data-cents"]), a.get("data-payer")))
        if tag == "tr" and "total" in classes:
            self._in = "total"
        if tag == "p" and "amount" in classes:
            self._in = "amount"
        for key in ("src", "poster"):
            if a.get(key, "").startswith("media/"):
                self.media.add(a[key])
        if tag == "video" and "clip" in classes:
            self.videos.append(a)
        if tag == "a" and "beta-link" in classes:
            self.beta_hrefs.append(a.get("href", ""))

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self._skip -= 1
        if (tag == "tr" and self._in == "total") or (tag == "p" and self._in == "amount"):
            self._in = None

    def handle_data(self, data):
        if self._skip:
            return
        self.text.append(data)
        if self._in == "total":
            self.total_text += data
        elif self._in == "amount":
            self.amount_text += data


def cents(text):
    digits = re.sub(r"[^0-9.]", "", text)
    return round(float(digits) * 100)


def check(page):
    failures = []

    # receipt
    total = sum(c for c, _ in page.rows)
    if total != cents(page.total_text):
        failures.append(f"receipt: lines sum to {total} cents but the total says {page.total_text.strip()!r}")
    kyle_net = 0
    for amount, payer in page.rows:
        half = amount // 2
        kyle_share = amount - half if payer == "kyle" else half
        kyle_net += (amount if payer == "kyle" else 0) - kyle_share
    if kyle_net != cents(page.amount_text):
        failures.append(f"receipt: Drea owes {kyle_net} cents but the page says {page.amount_text.strip()!r}")

    # media
    used = 0
    for path in sorted(page.media):
        full = os.path.join(ROOT, path)
        if not os.path.exists(full):
            failures.append(f"media: missing {path}")
            continue
        size = os.path.getsize(full)
        used += size
        if size > MAX_FILE:
            failures.append(f"media: {path} is {size / 1048576:.2f} MB (max 1.6)")
    if used > MAX_TOTAL:
        failures.append(f"media: {used / 1048576:.2f} MB in total (max 6.5)")

    # preload
    for video in page.videos:
        if video.get("preload") != "none":
            failures.append(f"preload: {video.get('poster')} is not preload=\"none\"")

    # forbidden
    text = " ".join(page.text).lower()
    for word in FORBIDDEN:
        if word in text:
            failures.append(f"forbidden: the page mentions {word!r}")

    # links
    if not page.beta_hrefs:
        failures.append("links: no beta buttons")
    elif len(set(page.beta_hrefs)) != 1:
        failures.append(f"links: beta buttons disagree: {sorted(set(page.beta_hrefs))}")

    return failures


def main():
    page = Page()
    with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as handle:
        page.feed(handle.read())
    failures = check(page)
    for failure in failures:
        print(f"FAIL: {failure}")
    if failures:
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
