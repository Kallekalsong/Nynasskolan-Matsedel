#!/usr/bin/env python3
"""Fetch and normalize Nynässkolan's official Skolmaten RSS feed."""
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
from pathlib import Path
import re
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

FEED_URL = "https://skolmaten.se/api/4/rss/week/nynasskolan?locale=sv"
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "menu.json"


def clean_html(text: str) -> str:
    text = re.sub(r"<\s*br\s*/?\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    return " ".join(text.replace("\xa0", " ").split())


def parse_feed(xml: bytes) -> dict:
    root = ET.fromstring(xml)
    channel = root.find("channel")
    if channel is None:
        raise ValueError("RSS-flödet saknar en kanal.")
    title = channel.findtext("title", default="")
    if "Nynässkolan" not in title:
        raise ValueError("RSS-flödet innehöll inte Nynässkolans matsedel.")

    days = []
    for item in channel.findall("item"):
        title = item.findtext("title", default="")
        pub_date = item.findtext("pubDate", default="")
        if not pub_date:
            continue
        date = parsedate_to_datetime(pub_date).date()
        description = clean_html(item.findtext("description", default=""))
        # Skolmaten uses commas both between alternatives and inside dish names.
        # Alternatives start with an uppercase letter; lowercase continuation
        # text (for example "potatis och lingonsylt") belongs to the same dish.
        meals = [{"name": meal.strip(), "description": ""} for meal in re.split(r",\s+(?=[A-ZÅÄÖ])", description) if meal.strip()]
        days.append({"date": date.isoformat(), "label": title, "meals": meals})

    if not days:
        raise ValueError("RSS-flödet innehöll inga publicerade dagar.")
    days.sort(key=lambda day: day["date"])
    fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return {"status": "ok", "school": "Nynässkolan", "week": date.isocalendar().week, "days": days, "fetchedAt": fetched_at, "sourceUrl": FEED_URL}


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(FEED_URL, headers={"User-Agent": "NynasskolanMatsedel/1.0 (+GitHub Actions)"})
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            if response.status != 200:
                raise ValueError(f"RSS-servern svarade med HTTP {response.status}.")
            payload = parse_feed(response.read())
    except (urllib.error.URLError, TimeoutError, ET.ParseError, ValueError) as error:
        payload = {"status": "error", "school": "Nynässkolan", "week": None, "days": [], "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "sourceUrl": FEED_URL, "error": f"Matsedeln kunde inte hämtas från Skolmaten.se. {error}"}
        print(payload["error"])
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if payload["status"] != "ok":
        raise SystemExit(1)
    print(f"Hämtade {len(payload['days'])} dagar till {OUTPUT}")


if __name__ == "__main__":
    main()
