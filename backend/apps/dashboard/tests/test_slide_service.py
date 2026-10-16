from django.test import TestCase
from apps.dashboard.services.slide_service import SlideService


class SlideServiceTests(TestCase):

    def test_slide_deck_structure(self):
        deck = SlideService.get_slide_deck()
        self.assertIn("period", deck)
        self.assertIn("deck_summary", deck)
        self.assertIn("slides", deck)
        self.assertIn("total_slides", deck["deck_summary"])
        self.assertIn("total_kpis", deck["deck_summary"])

        if deck["slides"]:
            first_slide = deck["slides"][0]
            self.assertIn("slide_id", first_slide)
            self.assertIn("slide_number", first_slide)
            self.assertIn("title", first_slide)
            self.assertIn("hierarchy", first_slide)
            self.assertIn("summary", first_slide)
            self.assertIn("kpis", first_slide)
            self.assertIn("issues", first_slide)
            self.assertIn("actions", first_slide)
            self.assertIn("circle", first_slide["hierarchy"])
            self.assertIn("domain", first_slide["hierarchy"])
