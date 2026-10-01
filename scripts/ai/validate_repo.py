#!/usr/bin/env python3
"""Check repository Markdown links and repo-local Codex skill manifests."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[2]
LINK = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")
SKILL_META = {
    "name": re.compile(r"^name:\s*([a-z0-9-]+)\s*$", re.MULTILINE),
    "description": re.compile(r"^description:\s*(.+?)\s*$", re.MULTILINE),
}


def markdown_files() -> list[Path]:
    files = [ROOT / "README.md", ROOT / "AGENTS.md"]
    files.extend((ROOT / "docs").rglob("*.md"))
    files.extend((ROOT / ".codex" / "skills").rglob("*.md"))
    return sorted({p for p in files if p.is_file()})


def check_links(files: list[Path]) -> list[str]:
    failures: list[str] = []
    for source in files:
        text = source.read_text(encoding="utf-8")
        for raw in LINK.findall(text):
            target = raw.strip().split(maxsplit=1)[0].strip("<>")
            parsed = urlsplit(target)
            if parsed.scheme or target.startswith("#") or not parsed.path:
                continue
            decoded = unquote(parsed.path)
            resolved = (ROOT / decoded.lstrip("/")) if decoded.startswith("/") else (source.parent / decoded)
            if not resolved.exists():
                failures.append(f"{source.relative_to(ROOT)}: broken local link: {target}")
    return failures


def check_skills() -> list[str]:
    failures: list[str] = []
    names: dict[str, Path] = {}
    skill_root = ROOT / ".codex" / "skills"
    if not skill_root.exists():
        return failures

    for folder in sorted(p for p in skill_root.iterdir() if p.is_dir()):
        manifest = folder / "SKILL.md"
        if not manifest.is_file():
            failures.append(f"{folder.relative_to(ROOT)}: missing SKILL.md")
            continue
        text = manifest.read_text(encoding="utf-8")
        match = re.match(r"\A---\s*\n(.*?)\n---\s*(?:\n|$)", text, re.DOTALL)
        if not match:
            failures.append(f"{manifest.relative_to(ROOT)}: missing YAML front matter")
            continue
        metadata = match.group(1)
        values: dict[str, str] = {}
        for key, pattern in SKILL_META.items():
            found = pattern.search(metadata)
            if not found:
                failures.append(f"{manifest.relative_to(ROOT)}: missing {key} metadata")
            else:
                values[key] = found.group(1).strip()
        if values.get("name") and values["name"] != folder.name:
            failures.append(f"{manifest.relative_to(ROOT)}: skill name must match directory `{folder.name}`")
        if len(values.get("description", "")) > 200:
            failures.append(f"{manifest.relative_to(ROOT)}: keep description at 200 characters or fewer")
        if values.get("name"):
            if values["name"] in names:
                failures.append(f"{manifest.relative_to(ROOT)}: duplicate skill name `{values['name']}`")
            names[values["name"]] = manifest
    return failures


def main() -> int:
    files = markdown_files()
    failures = check_links(files) + check_skills()
    if failures:
        print("Repository validation failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print(f"Repository validation passed: {len(files)} Markdown files, local links and skill manifests checked.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
