"""Offline checks for the Skolmaten menu parser and normalizer."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import fetch_menu


def make_feed(title="Nynässkolan", items=""):
    return f"""<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0"><channel><title>{title}</title>{items}</channel></rss>""".encode()


def feed_item(day, date, description):
    return f"""<item><title>{day}</title><pubDate>{date}</pubDate>
    <description><![CDATA[{description}]]></description></item>"""


class ParseFeedTests(unittest.TestCase):
    def test_sorts_days_and_splits_alternatives(self):
        items = feed_item(
            "Tisdag - Vecka 49", "Tue, 01 Dec 2026 12:00:00 +0100",
            "Testmåltid två, Testmåltid tre",
        ) + feed_item(
            "Måndag - Vecka 49", "Mon, 30 Nov 2026 12:00:00 +0100",
            "Testmåltid ett",
        )

        result = fetch_menu.parse_feed(make_feed(items=items))

        self.assertEqual((result["year"], result["week"]), (2026, 49))
        self.assertEqual([day["date"] for day in result["days"]], ["2026-11-30", "2026-12-01"])
        self.assertEqual([meal["name"] for meal in result["days"][1]["meals"]], ["Testmåltid två", "Testmåltid tre"])
        self.assertEqual(result["weeks"][0]["days"], result["days"])

    def test_rejects_a_different_school(self):
        with self.assertRaisesRegex(ValueError, "Nynässkolan"):
            fetch_menu.parse_feed(make_feed(title="En annan skola", items=feed_item(
                "Måndag", "Mon, 30 Nov 2026 12:00:00 +0100", "Testmåltid",
            )))

    def test_rejects_empty_or_mixed_week_feed(self):
        with self.assertRaisesRegex(ValueError, "inga publicerade dagar"):
            fetch_menu.parse_feed(make_feed())

        mixed = feed_item("Måndag", "Mon, 30 Nov 2026 12:00:00 +0100", "Testmåltid")
        mixed += feed_item("Måndag", "Mon, 07 Dec 2026 12:00:00 +0100", "Testmåltid")
        with self.assertRaisesRegex(ValueError, "flera veckor"):
            fetch_menu.parse_feed(make_feed(items=mixed))


class ParseApiWeekTests(unittest.TestCase):
    def test_orders_meals_and_preserves_description(self):
        payload = {"WeekState": {"year": 2026, "week": 49, "Days": [{
            "date": "2026-11-30", "cancelled": False, "Meals": [
                {"name": "Senare rätt", "order": 2},
                {"name": "Första rätt", "order": 1, "description": "Exempeltext"},
            ],
        }]}}

        result = fetch_menu.parse_api_week(payload, 2026, 49)

        self.assertEqual([meal["name"] for meal in result["days"][0]["meals"]], ["Första rätt", "Senare rätt"])
        self.assertEqual(result["days"][0]["meals"][0]["description"], "Exempeltext")

    def test_skips_unpublished_week_but_keeps_explicit_cancellation(self):
        empty = {"WeekState": {"year": 2026, "week": 49, "Days": [{
            "date": "2026-11-30", "cancelled": False, "Meals": [],
        }]}}
        self.assertIsNone(fetch_menu.parse_api_week(empty, 2026, 49))

        cancelled = {"WeekState": {"year": 2026, "week": 49, "Days": [{
            "date": "2026-11-30", "cancelled": True, "Meals": [],
        }]}}
        result = fetch_menu.parse_api_week(cancelled, 2026, 49)
        self.assertTrue(result["days"][0]["cancelled"])
        self.assertEqual(result["days"][0]["meals"], [])

    def test_rejects_wrong_week_and_ignores_out_of_week_dates(self):
        wrong_week = {"WeekState": {"year": 2026, "week": 50, "Days": []}}
        self.assertIsNone(fetch_menu.parse_api_week(wrong_week, 2026, 49))

        payload = {"WeekState": {"year": 2026, "week": 49, "Days": [
            {"date": "2026-12-07", "cancelled": False, "Meals": [{"name": "Utanför veckan"}]},
            {"date": "2026-11-30", "cancelled": False, "Meals": [{"name": "Rätt vecka"}]},
        ]}}
        result = fetch_menu.parse_api_week(payload, 2026, 49)
        self.assertEqual([day["date"] for day in result["days"]], ["2026-11-30"])


class ErrorPayloadTests(unittest.TestCase):
    def test_error_payload_contains_no_meals(self):
        result = fetch_menu.error_payload(ValueError("testfel"))
        self.assertEqual(result["status"], "error")
        self.assertEqual(result["days"], [])
        self.assertEqual(result["weeks"], [])
        self.assertIn("testfel", result["error"])


if __name__ == "__main__":
    unittest.main()

