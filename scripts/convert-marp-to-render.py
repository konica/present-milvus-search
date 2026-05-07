#!/usr/bin/env python3
"""
Convert a Marp-style markdown file to the report-render skill convention.

Transforms applied:
  1. Replace the Marp YAML front-matter with report-render front-matter
     (title taken from the first H1; subtitle from the first H2 inside the cover slide).
  2. Drop the cover slide (the H1 + subtitle + author block before the first `---`).
  3. Replace each `---` slide separator with a blank line (slides are now driven by H2s).
  4. Convert remaining `# Heading` lines into `## Heading`.
  5. Append a numeric suffix to repeated H2 headings so each slide has a unique title.

Usage: convert-marp-to-render.py <input.md> <output.md>
"""

from __future__ import annotations

import argparse
import re
from collections import Counter
from pathlib import Path


FRONT_MATTER_TEMPLATE = """---
title: {title}
subtitle: {subtitle}
category: Technical Presentation
author: {author}
date: {date}
doc_id: {doc_id}
version: 1.0
---
"""


def strip_front_matter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    fm_block = text[3:end].strip()
    body = text[end + 4 :].lstrip("\n")
    fm: dict[str, str] = {}
    for line in fm_block.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            fm[k.strip()] = v.strip()
    return fm, body


def extract_cover(body: str) -> tuple[dict[str, str], str]:
    """Pull title/subtitle/author from the cover slide (everything before the first `---` separator)."""
    parts = re.split(r"^---\s*$", body, maxsplit=1, flags=re.MULTILINE)
    cover, rest = (parts[0], parts[1]) if len(parts) == 2 else (body, "")
    cover_lines = [l.strip() for l in cover.strip().splitlines() if l.strip()]

    info = {"title": "", "subtitle": "", "author": ""}
    for line in cover_lines:
        if line.startswith("# ") and not info["title"]:
            info["title"] = line[2:].strip()
        elif line.startswith("## ") and not info["subtitle"]:
            info["subtitle"] = line[3:].strip()
        elif line.startswith("### ") and not info["author"]:
            info["author"] = line[4:].strip()
    return info, rest


def dedup_headings(body: str) -> str:
    """For repeated H2 titles, append a short suffix derived from the first bullet/text on each slide."""
    slides = re.split(r"(?=^## )", body, flags=re.MULTILINE)
    titles = Counter()
    for slide in slides:
        m = re.match(r"## (.+)", slide)
        if m:
            titles[m.group(1).strip()] += 1
    duplicates = {t for t, n in titles.items() if n > 1}

    seen: dict[str, int] = {}
    out: list[str] = []
    for slide in slides:
        m = re.match(r"## (.+)", slide)
        if m and m.group(1).strip() in duplicates:
            base = m.group(1).strip()
            seen[base] = seen.get(base, 0) + 1
            new_title = f"{base} ({seen[base]})"
            slide = re.sub(r"^## .+", f"## {new_title}", slide, count=1, flags=re.MULTILINE)
        out.append(slide)
    return "".join(out)


def rewrite_image_paths(body: str, source_dir: Path) -> str:
    """Make relative image paths absolute so the rendered .md works from any location."""
    def repl(m: re.Match[str]) -> str:
        alt, src = m.group(1), m.group(2)
        if re.match(r"^(https?:|data:|/)", src):
            return m.group(0)
        abs_path = (source_dir / src).resolve()
        return f"![{alt}]({abs_path})"
    return re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", repl, body)


def convert(input_path: Path, output_path: Path) -> None:
    text = input_path.read_text(encoding="utf-8")
    _, body = strip_front_matter(text)
    cover_info, rest = extract_cover(body)

    # H1 -> H2 in remaining body
    rest = re.sub(r"^# (.+)$", r"## \1", rest, flags=re.MULTILINE)
    # Drop horizontal-rule slide separators
    rest = re.sub(r"^---\s*$", "", rest, flags=re.MULTILINE)
    # Collapse runs of blank lines
    rest = re.sub(r"\n{3,}", "\n\n", rest).strip() + "\n"
    # Make each slide title unique
    rest = dedup_headings(rest)
    # Resolve relative image paths against the source markdown's directory
    rest = rewrite_image_paths(rest, input_path.resolve().parent)

    title = cover_info["title"] or input_path.stem
    subtitle = cover_info["subtitle"]
    author_line = cover_info["author"]

    # `### AI VN Team - 5.2026` → author "AI VN Team", date "5.2026"
    author, date = author_line, ""
    m = re.match(r"(.+?)\s*[-–—]\s*(.+)", author_line)
    if m:
        author, date = m.group(1).strip(), m.group(2).strip()

    front = FRONT_MATTER_TEMPLATE.format(
        title=title,
        subtitle=subtitle,
        author=author or "Author",
        date=date or "",
        doc_id=input_path.stem,
    )
    output_path.write_text(front + "\n" + rest, encoding="utf-8")
    print(f"✓ Converted {input_path} → {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    convert(args.input, args.output)


if __name__ == "__main__":
    main()
