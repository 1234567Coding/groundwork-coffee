#!/usr/bin/env python3
"""Generate search-index.json for the Groundwork Coffee static site.

Reads every article HTML file in articles/, extracts:
  - title    : <h1> text (falls back to <title>)
  - url      : "articles/<slug>.html"
  - excerpt  : first ~160 chars of the first non-byline paragraph
  - headings : list of <h2> texts (excludes "Keep Reading" nav section)
Writes the index to the site root as search-index.json, then validates:
  - the JSON parses with json.load
  - every URL in it resolves to a real local file
"""
import json
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTICLES_DIR = ROOT / "articles"
OUT_FILE = ROOT / "search-index.json"


class ArticleParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.title_text = []
        self.in_post = False
        self.in_keep_reading = False
        self.in_h1 = False
        self.h1_text = []
        self.in_h2 = False
        self.h2_text = []
        self.headings = []
        self.in_p = False
        self.p_text = []
        self.p_class = ""
        self.excerpt = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag == "article" and "post" in a.get("class", "").split():
            self.in_post = True
        if self.in_post:
            if tag == "nav" and "keep-reading" in a.get("class", "").split():
                self.in_keep_reading = True
            if tag == "h1":
                self.in_h1 = True
                self.h1_text = []
            elif tag == "h2" and not self.in_keep_reading:
                self.in_h2 = True
                self.h2_text = []
            elif tag == "p" and self.excerpt is None:
                self.in_p = True
                self.p_text = []
                self.p_class = a.get("class", "")

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "article" and self.in_post and not self.in_keep_reading:
            self.in_post = False
        if tag == "nav" and self.in_keep_reading:
            self.in_keep_reading = False
        if tag == "h1" and self.in_h1:
            self.in_h1 = False
        if tag == "h2" and self.in_h2:
            self.in_h2 = False
            text = "".join(self.h2_text).strip()
            if text:
                self.headings.append(text)
        if tag == "p" and self.in_p:
            self.in_p = False
            if "byline" not in self.p_class.split() and self.excerpt is None:
                text = " ".join("".join(self.p_text).split())
                if len(text) >= 40:  # skip stray short fragments
                    self.excerpt = text[:160].rstrip()
                    if len(text) > 160:
                        self.excerpt += "..."

    def handle_data(self, data):
        if self.in_title:
            self.title_text.append(data)
        if self.in_h1:
            self.h1_text.append(data)
        if self.in_h2:
            self.h2_text.append(data)
        if self.in_p:
            self.p_text.append(data)


def main():
    entries = []
    files = sorted(ARTICLES_DIR.glob("*.html"))
    if not files:
        print("No article files found in", ARTICLES_DIR, file=sys.stderr)
        sys.exit(1)

    for path in files:
        parser = ArticleParser()
        parser.feed(path.read_text(encoding="utf-8"))
        title = " ".join("".join(parser.h1_text).split())
        if not title:
            title = "".join(parser.title_text).split("—")[0].strip()
        entry = {
            "title": title,
            "url": "articles/" + path.name,
            "excerpt": parser.excerpt or "",
            "headings": parser.headings,
        }
        entries.append(entry)

    OUT_FILE.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_FILE} with {len(entries)} entries")

    # ---- Validation ----
    data = json.loads(OUT_FILE.read_text(encoding="utf-8"))  # parses cleanly
    assert isinstance(data, list) and len(data) == len(files), "entry count mismatch"
    for entry in data:
        assert entry["title"], f"missing title for {entry['url']}"
        target = ROOT / entry["url"]
        assert target.is_file(), f"URL does not resolve to a local file: {entry['url']}"
        assert isinstance(entry["headings"], list) and entry["headings"], f"no h2 headings for {entry['url']}"
    print(f"Validation OK: JSON parses, all {len(data)} URLs resolve to real files")


if __name__ == "__main__":
    main()
