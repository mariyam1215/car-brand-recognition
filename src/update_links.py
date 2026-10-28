"""Put your project links into the website. Needs only Python (no extra packages).

1. Open web/links.json and paste your links between the quotes.
2. Run:  python src/update_links.py
3. Deploy the web/ folder again (push to GitHub; Vercel updates by itself).
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
LINK_CARDS = [  # key in links.json, title, description
    ("github", "GitHub repository", "source code, dataset link and model weights"),
    ("report", "Project report", "problem, dataset, architecture, training and results"),
    ("presentation", "Presentation slides", "PowerPoint / PDF of the project"),
    ("youtube", "YouTube video", "voice-over walkthrough of the slides"),
    ("linkedin", "LinkedIn post", "project announcement"),
]
esc = html.escape


def link_cards(links: dict) -> str:
    cards = []
    for key, title, desc in LINK_CARDS:
        url = links.get(key, "").strip()
        if url:
            cards.append(f'<a href="{esc(url)}"><b>{title}</b><span>{esc(url)}</span></a>')
        else:
            cards.append(f'<div class="off"><b>{title}</b><span>{desc} (link coming soon)</span></div>')
    cards.append('<a href="https://ai.stanford.edu/~jkrause/cars/car_dataset.html"><b>Dataset: Stanford Cars</b>'
                 '<span>ai.stanford.edu/~jkrause/cars/car_dataset.html</span></a>')
    cards.append('<a href="model/car_brand.onnx"><b>Model weights (ONNX)</b><span>model/car_brand.onnx, also in the GitHub repo</span></a>')
    return "\n".join(cards)


def apply(page: str, links: dict) -> str:
    """Rewrite the 'Project links' cards and every GitHub link in an index.html string."""
    github = links.get("github", "").strip().rstrip("/")

    def repo_link(m):
        path = m.group(2)
        url = (f"{github}/blob/main/{path}" if path else github) if github else "#links"
        return f'{m.group(1)}{url}"'

    page = re.sub(r"<!--LINKS-->.*?<!--/LINKS-->",
                  lambda m: f"<!--LINKS-->\n{link_cards(links)}\n<!--/LINKS-->", page, flags=re.S)
    return re.sub(r'(<a data-gh="([^"]*)" href=")[^"]*"', repo_link, page)


def main():
    links = json.loads((WEB / "links.json").read_text(encoding="utf-8"))
    for key, url in links.items():
        if url.strip() and not url.strip().startswith(("http://", "https://")):
            print(f"Warning: the '{key}' link should start with https:// -> {url}")
    index = WEB / "index.html"
    index.write_text(apply(index.read_text(encoding="utf-8"), links), encoding="utf-8")
    filled = [k for k, v in links.items() if v.strip()]
    print(f"Done. Links on the website: {', '.join(filled) or 'none yet'}")


if __name__ == "__main__":
    main()
