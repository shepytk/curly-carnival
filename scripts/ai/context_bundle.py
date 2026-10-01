#!/usr/bin/env python3
"""Create a bounded, local-only context packet for a coding-agent task."""

from __future__ import annotations

import argparse
import math
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SKIP_DIRS = {".git", ".venv", "node_modules", "dist", "build", "coverage", "__pycache__"}
SKIP_NAMES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "poetry.lock",
    "uv.lock",
    "cargo.lock",
}
SKIP_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip",
    ".wasm", ".p12", ".pfx", ".pem", ".key", ".crt", ".cer",
}
MAX_FILE_BYTES = 100_000


def git(*args: str) -> bytes:
    result = subprocess.run(
        ["git", "-C", str(ROOT), *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return result.stdout


def safe_path(raw: str) -> tuple[str, Path] | None:
    """Return a normalized repo-relative path if it is safe to include."""
    candidate = (ROOT / raw).resolve()
    try:
        relative = candidate.relative_to(ROOT.resolve())
    except ValueError:
        return None

    parts = {part.lower() for part in relative.parts}
    name = relative.name.lower()
    if parts & SKIP_DIRS:
        return None
    if name in SKIP_NAMES or name.endswith(tuple(SKIP_SUFFIXES)):
        return None
    if name == ".env" or name.startswith(".env."):
        return None
    if any(word in name for word in ("secret", "credential", "private_key", "id_rsa")):
        return None
    return relative.as_posix(), candidate


def read_text(path: Path) -> str | None:
    try:
        if path.stat().st_size > MAX_FILE_BYTES:
            return None
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Print a size-limited context bundle; it does not call an AI or network service."
    )
    parser.add_argument(
        "--base",
        default="HEAD",
        help="Git revision to diff against (default: HEAD; e.g. origin/main for a branch review).",
    )
    parser.add_argument("--focus", action="append", default=[], help="Include a target file in full; repeat as needed.")
    parser.add_argument("--include", action="append", default=[], help="Include one supporting file in full; repeat as needed.")
    parser.add_argument("--skill", action="append", default=[], help="Include a repo skill by directory name; repeat as needed.")
    parser.add_argument("--max-chars", type=int, default=24_000, help="Hard output limit in characters (default: 24000).")
    args = parser.parse_args()
    if args.max_chars < 1_000:
        parser.error("--max-chars must be at least 1000")

    try:
        changed = git("diff", "--name-only", "-z", args.base, "--").decode("utf-8").split("\0")
        untracked = git("ls-files", "--others", "--exclude-standard", "-z").decode("utf-8").split("\0")
        status = git("status", "--short").decode("utf-8", errors="replace").strip() or "(clean)"
        status = "; ".join(line.strip() for line in status.splitlines())
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        detail = getattr(exc, "stderr", b"")
        print(f"Unable to read Git context: {detail.decode('utf-8', errors='replace')}", file=sys.stderr)
        return 2

    changed_paths: list[str] = []
    for value in [*changed, *untracked]:
        if value and value not in changed_paths:
            changed_paths.append(value)

    focus_paths: list[str] = []
    include_paths: list[str] = []
    for requested, target in [(args.focus, focus_paths), (args.include, include_paths)]:
        for value in requested:
            checked = safe_path(value)
            if checked is None:
                print(f"Skipping unsafe or excluded path: {value}", file=sys.stderr)
                continue
            rel, path = checked
            if not path.is_file():
                print(f"Skipping missing/non-file path: {value}", file=sys.stderr)
                continue
            if rel not in target:
                target.append(rel)

    skill_paths: list[str] = []
    for skill in args.skill:
        if "/" in skill or "\\" in skill or skill in ("", ".", ".."):
            print(f"Skipping invalid skill name: {skill}", file=sys.stderr)
            continue
        skill_paths.append(f".codex/skills/{skill}/SKILL.md")

    sections: list[str] = []
    used = 0
    truncated = False

    def add(title: str, body: str) -> None:
        nonlocal used, truncated
        if truncated or not body:
            return
        section = f"\n## {title}\n\n{body.rstrip()}\n"
        remaining = args.max_chars - used
        if len(section) <= remaining:
            sections.append(section)
            used += len(section)
            return
        marker = "\n[truncated at configured context limit]\n"
        keep = max(0, remaining - len(marker))
        if keep:
            sections.append(section[:keep] + marker)
            used += keep + len(marker)
        truncated = True

    add(
        "Task packet header",
        "This packet was assembled locally by scripts/ai/context_bundle.py. It makes no model or network calls. "
        f"Approximate input tokens: about one per four characters. Git status: `{status}`. "
        f"Changed paths: {', '.join(changed_paths) if changed_paths else '(none detected)'}.",
    )

    instruction_paths = ["AGENTS.md", *skill_paths, *include_paths]
    for rel in instruction_paths:
        checked = safe_path(rel)
        if checked is None:
            continue
        normalized, path = checked
        content = read_text(path)
        if content is not None:
            add(f"File: {normalized}", content)

    # Focus files are included as current full text; do not repeat their diffs.
    for rel in focus_paths:
        checked = safe_path(rel)
        if checked is None:
            continue
        normalized, path = checked
        content = read_text(path)
        if content is None:
            add(f"File: {normalized}", "[omitted: binary, unreadable, or larger than the file limit]")
        else:
            add(f"File: {normalized}", content)

    focus_set = set(focus_paths)
    diff_paths: list[str] = []
    for rel in changed_paths:
        checked = safe_path(rel)
        if checked is None:
            continue
        normalized, _ = checked
        if normalized not in focus_set and normalized not in diff_paths:
            diff_paths.append(normalized)

    if diff_paths and not truncated:
        try:
            diff = git("diff", "--no-ext-diff", "--unified=24", args.base, "--", *diff_paths).decode(
                "utf-8", errors="replace"
            )
            add("Relevant diff", diff or "(No tracked diff; new files are included below.)")
        except subprocess.CalledProcessError as exc:
            print(exc.stderr.decode("utf-8", errors="replace"), file=sys.stderr)
            return 2

    # Git diff does not print the contents of untracked files.
    tracked = set(git("ls-files", "-z").decode("utf-8").split("\0"))
    untracked_paths = [p for p in changed_paths if p and p not in tracked and p not in focus_set]
    for rel in untracked_paths:
        checked = safe_path(rel)
        if checked is None:
            continue
        normalized, path = checked
        content = read_text(path)
        if content is not None:
            add(f"New file: {normalized}", content)

    output = "".join(sections).lstrip()
    print(output, end="" if output.endswith("\n") else "\n")
    print(
        f"\n[context bundle: {len(output):,} chars, approximately {math.ceil(len(output) / 4):,} tokens; "
        f"limit {args.max_chars:,} chars]",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
