"""Builds artifact.html (hosted version) from index.html (local version).

The hosted artifact page is wrapped in its own html/head/body skeleton and
its CSP blocks Google Fonts, so this strips the document wrapper and font
links, and adds a condensed system-font fallback for the big numbers.
Run after every index.html change, then republish artifact.html.
"""
import re, pathlib

src = pathlib.Path(__file__).parent / "index.html"
out = pathlib.Path(__file__).parent / "artifact.html"

html = src.read_text(encoding="utf-8")

# strip document wrapper tags
for pat in [
    r"<!DOCTYPE html>\s*", r"</?html[^>]*>\s*", r"</?head>\s*", r"</?body>\s*",
    r"<meta charset[^>]*>\s*",
    r"<link rel=\"preconnect\"[^>]*>\s*",
    r"<link href=\"https://fonts\.googleapis[^>]*>\s*",
    r"<link rel=\"manifest\"[^>]*>\s*",
    r"<link rel=\"apple-touch-icon\"[^>]*>\s*",
    r"<link rel=\"icon\"[^>]*>\s*",
    r"<meta name=\"theme-color\"[^>]*>\s*",
    r"<meta name=\"apple-mobile[^>]*>\s*",
]:
    html = re.sub(pat, "", html)

# condensed fallback for environments without Barlow
html = html.replace("font-family:'Barlow Condensed'",
                    "font-family:'Barlow Condensed','Arial Narrow','Helvetica Neue'")

out.write_text(html, encoding="utf-8")
print(f"wrote {out} ({len(html)} chars)")
