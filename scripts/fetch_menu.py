#!/usr/bin/env python3
"""Fetch Nynässkolan's RSS menu and future published weeks from Skolmaten."""
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import json
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET

FEED_URL = "https://skolmaten.se/api/4/rss/week/nynasskolan?locale=sv"
SCHOOL_URL = "https://skolmaten.se/nynasskolan"
SITE_URL = "https://skolmaten.se/"
API_BASE = "https://skolmaten.se/api/4"
WEEKS_AHEAD = 8
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "menu.json"
USER_AGENT = "NynasskolanMatsedel/1.0 (+GitHub Actions)"


def clean_html(text: str) -> str:
    text = re.sub(r"<\s*br\s*/?\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    return " ".join(text.replace("\xa0", " ").split())


def fetch_bytes(url: str, headers: dict[str, str] | None = None, timeout: int = 20) -> bytes:
    request_headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if headers:
        request_headers.update(headers)
    request = urllib.request.Request(url, headers=request_headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise ValueError(f"Servern svarade med HTTP {response.status}.")
        return response.read()


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
        label = item.findtext("title", default="")
        pub_date = item.findtext("pubDate", default="")
        if not pub_date:
            continue
        menu_date = parsedate_to_datetime(pub_date).date()
        description = clean_html(item.findtext("description", default=""))
        # Alternatives start with an uppercase letter; lowercase continuation
        # text (for example "potatis och lingonsylt") belongs to the same dish.
        meals = [
            {"name": meal.strip(), "description": ""}
            for meal in re.split(r",\s+(?=[A-ZÅÄÖ])", description)
            if meal.strip()
        ]
        days.append({
            "date": menu_date.isoformat(),
            "label": label,
            "meals": meals,
            "cancelled": False,
        })

    if not days:
        raise ValueError("RSS-flödet innehöll inga publicerade dagar.")
    days.sort(key=lambda day: day["date"])
    iso = date.fromisoformat(days[0]["date"]).isocalendar()
    if any(date.fromisoformat(day["date"]).isocalendar()[:2] != iso[:2] for day in days):
        raise ValueError("RSS-flödet innehöll dagar från flera veckor.")
    return {
        "status": "ok",
        "school": "Nynässkolan",
        "year": iso.year,
        "week": iso.week,
        "days": days,
        "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sourceUrl": FEED_URL,
        "weeks": [{"year": iso.year, "week": iso.week, "days": days}],
        "weekFetchWarning": "",
    }


def public_api_headers() -> dict[str, str]:
    """Read Skolmaten's public web-client token at runtime; never store it."""
    homepage = fetch_bytes(SITE_URL).decode("utf-8")
    script_match = re.search(
        r'<script[^>]+src=["\']([^"\']+\.js(?:\?[^"\']*)?)["\']',
        homepage,
        flags=re.IGNORECASE,
    )
    if not script_match:
        raise ValueError("Skolmatens webbklient hittades inte.")
    script_url = urllib.parse.urljoin(SITE_URL, script_match.group(1))
    bundle = fetch_bytes(script_url).decode("utf-8")
    token_match = re.search(r'"Client-Token"\s*:\s*"([^"]+)"', bundle, flags=re.IGNORECASE)
    version_match = re.search(r'"Client-Version"\s*:\s*"([^"]+)"', bundle, flags=re.IGNORECASE)
    if not token_match or not version_match:
        raise ValueError("Skolmatens offentliga API-inställningar hittades inte.")
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Client-Token": token_match.group(1),
        "Client-Version": version_match.group(1),
        "x-session-id": str(uuid.uuid4()),
        "x-correlation-id": str(uuid.uuid4()),
        "Referer": SITE_URL,
    }


def parse_api_week(payload: dict, year: int, week: int) -> dict | None:
    week_state = payload.get("WeekState")
    if not isinstance(week_state, dict):
        return None
    if int(week_state.get("year", -1)) != year or int(week_state.get("week", -1)) != week:
        return None

    days = []
    for source_day in week_state.get("Days", []):
        raw_date = source_day.get("date")
        if not raw_date:
            continue
        menu_date = datetime.fromisoformat(raw_date.replace("Z", "+00:00")).date()
        iso = menu_date.isocalendar()
        if iso.year != year or iso.week != week:
            continue
        meals = []
        for source_meal in sorted(source_day.get("Meals", []), key=lambda meal: meal.get("order", 0)):
            name = str(source_meal.get("name", "")).strip()
            if name:
                meals.append({
                    "name": name,
                    "description": str(source_meal.get("description", "")).strip(),
                })
        days.append({
            "date": menu_date.isoformat(),
            "label": "",
            "meals": meals,
            "cancelled": bool(source_day.get("cancelled")),
        })

    days.sort(key=lambda day: day["date"])
    if not days or not any(day["meals"] or day["cancelled"] for day in days):
        return None
    return {"year": year, "week": week, "days": days}


def fetch_future_weeks(current: dict) -> tuple[list[dict], str]:
    try:
        headers = public_api_headers()
    except (urllib.error.URLError, TimeoutError, UnicodeDecodeError, ValueError) as error:
        print(f"Kommande veckor kunde inte kontrolleras: {error}")
        return [], "Kommande veckor kunde inte kontrolleras just nu."

    current_monday = date.fromisocalendar(current["year"], current["week"], 1)
    weeks = []
    failed = False
    for offset in range(1, WEEKS_AHEAD + 1):
        requested_week = (current_monday + timedelta(weeks=offset)).isocalendar()
        query = urllib.parse.urlencode({"year": requested_week.year, "week": requested_week.week})
        url = f"{API_BASE}/menu/school/nynasskolan?{query}"
        try:
            raw = fetch_bytes(url, headers=headers, timeout=15)
            payload = json.loads(raw)
            menu_week = parse_api_week(payload, requested_week.year, requested_week.week)
            if menu_week:
                weeks.append(menu_week)
        except urllib.error.HTTPError as error:
            # A future week without a published menu can return not-found.
            if error.code != 404:
                failed = True
        except (urllib.error.URLError, TimeoutError, UnicodeDecodeError, json.JSONDecodeError, ValueError, TypeError) as error:
            print(f"Vecka {requested_week.week} kunde inte hämtas: {error}")
            failed = True
            # Stop on a transport or format failure instead of repeating it for
            # every remaining week. The current RSS menu remains available.
            break
    warning = "Kommande veckor kunde inte kontrolleras helt just nu." if failed else ""
    return weeks, warning


def error_payload(error: Exception) -> dict:
    return {
        "status": "error",
        "school": "Nynässkolan",
        "year": None,
        "week": None,
        "days": [],
        "weeks": [],
        "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sourceUrl": FEED_URL,
        "weekFetchWarning": "",
        "error": f"Matsedeln kunde inte hämtas från Skolmaten.se. {error}",
    }


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    try:
        current = parse_feed(fetch_bytes(FEED_URL))
        future_weeks, warning = fetch_future_weeks(current)
        current["weeks"].extend(future_weeks)
        current["weekFetchWarning"] = warning
        payload = current
    except (urllib.error.URLError, TimeoutError, ET.ParseError, UnicodeDecodeError, ValueError) as error:
        payload = error_payload(error)
        print(payload["error"])

    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if payload["status"] != "ok":
        raise SystemExit(1)
    print(f"Hämtade {len(payload['weeks'])} publicerade veckor ({len(payload['days'])} dagar i aktuell vecka).")


if __name__ == "__main__":
    main()
