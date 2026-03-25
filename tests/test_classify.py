"""Tests for the content type classifier (heuristic mode only)."""

import pytest

from content_checker.classify import classify, classify_heuristic
from content_checker.models import TokenUsage


class TestHeuristicClassifier:
    @pytest.mark.parametrize("text,expected", [
        ("Create account", "button_cta"),
        ("Save changes", "button_cta"),
        ("Get started", "button_cta"),
        ("Delete", "button_cta"),
        ("Sign in", "button_cta"),
        ("Export data", "button_cta"),
    ])
    def test_buttons(self, text, expected):
        assert classify_heuristic(text) == expected

    @pytest.mark.parametrize("text,expected", [
        ("Upload failed. Try again later.", "error_message"),
        ("Something went wrong. Please try again.", "error_message"),
        ("We couldn't save your changes.", "error_message"),
    ])
    def test_errors(self, text, expected):
        assert classify_heuristic(text) == expected

    @pytest.mark.parametrize("text,expected", [
        ("Your changes are saved.", "confirmation"),
        ("Your account has been successfully created.", "confirmation"),
        ("Your email has been sent.", "confirmation"),
        ("The file has been deleted.", "confirmation"),
    ])
    def test_confirmations(self, text, expected):
        assert classify_heuristic(text) == expected

    def test_tooltip(self):
        assert classify_heuristic("What does this setting do?") == "tooltip_microcopy"

    @pytest.mark.parametrize("text,expected", [
        ("Account settings", "ui_label"),
        ("Billing", "ui_label"),
        ("New project", "ui_label"),
    ])
    def test_labels(self, text, expected):
        assert classify_heuristic(text) == expected

    def test_short_ui_copy(self):
        assert classify_heuristic("You can upload files up to 25 MB. For larger files, use our desktop app.") == "short_ui_copy"

    def test_long_form(self):
        long = (
            "To complete verification you will need to provide a valid government-issued "
            "photo ID and you should also have a recent utility bill or bank statement "
            "that shows your current address on file with us. Once verified, you will be "
            "able to access all features of your account including the ability to send and "
            "receive payments, manage your team members, and configure security settings."
        )
        assert classify_heuristic(long) == "long_form_copy"

    def test_error_priority_over_button(self):
        """Error keywords should take priority over button keywords."""
        assert classify_heuristic("Upload failed. Try again later.") == "error_message"

    def test_confirmation_priority_over_button(self):
        """Confirmation keywords should take priority over button keywords."""
        assert classify_heuristic("Your changes are saved.") == "confirmation"


class TestClassifyWrapper:
    def test_returns_tuple(self):
        result, latency, tokens = classify("Save changes", use_llm=False)
        assert result == "button_cta"
        assert latency == 0.0
        assert isinstance(tokens, TokenUsage)
        assert tokens.input == 0
        assert tokens.output == 0

    def test_no_content_types_uses_heuristic(self):
        result, _, _ = classify("Save changes", content_types=None, use_llm=True)
        assert result == "button_cta"
