"""Offline checks for the HTML, JavaScript, and local asset contract."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit
import unittest


ROOT = Path(__file__).resolve().parents[1]


class SiteParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.local_assets = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if attributes.get("id"):
            self.ids.append(attributes["id"])

        local_path = None
        if tag in {"script", "img"}:
            local_path = attributes.get("src")
        elif tag == "link":
            rel = set(attributes.get("rel", "").lower().split())
            if rel.intersection({"stylesheet", "icon"}):
                local_path = attributes.get("href")

        if local_path:
            parsed = urlsplit(local_path)
            if not parsed.scheme and not parsed.netloc:
                self.local_assets.append(unquote(parsed.path))


class SiteAssetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / "index.html").read_text(encoding="utf-8")
        cls.app = (ROOT / "app.js").read_text(encoding="utf-8")
        cls.parser = SiteParser()
        cls.parser.feed(cls.html)

    def test_html_ids_are_unique(self):
        duplicates = [element_id for element_id, count in Counter(self.parser.ids).items() if count > 1]
        self.assertEqual(duplicates, [])

    def test_local_html_assets_exist(self):
        missing = [path for path in self.parser.local_assets if not (ROOT / path).exists()]
        self.assertEqual(missing, [])
        self.assertTrue((ROOT / "data" / "menu.json").is_file())

    def test_javascript_id_selectors_exist_in_html(self):
        selectors = set(re.findall(r'''querySelector(?:All)?\(\s*["']#([A-Za-z][\w-]*)["']''', self.app))
        html_ids = set(self.parser.ids)
        self.assertTrue(selectors)
        self.assertEqual(selectors - html_ids, set())


if __name__ == "__main__":
    unittest.main()

