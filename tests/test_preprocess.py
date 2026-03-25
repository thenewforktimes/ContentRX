"""Tests for the deterministic pre-processing layer."""

from content_checker.preprocess import (
    check_ampersand,
    check_date_format,
    check_numerals,
    check_oxford_comma,
    run_preprocess,
)


def _ids(violations):
    """Extract sorted standard IDs from a list of violations."""
    return sorted(set(v.standard_id for v in violations))


# --- GRM-01: Oxford comma ---

class TestOxfordComma:
    def test_missing_comma(self):
        result = check_oxford_comma("You can track orders, manage returns and contact support from your account page.")
        assert _ids(result) == ["GRM-01"]

    def test_comma_present(self):
        assert check_oxford_comma("You can track orders, manage returns, and contact support from your account page.") == []

    def test_two_items_no_comma_needed(self):
        assert check_oxford_comma("You can track orders and manage returns from your account page.") == []

    def test_missing_comma_with_or(self):
        assert _ids(check_oxford_comma("Choose between red, blue or green.")) == ["GRM-01"]

    def test_library_correct(self):
        assert check_oxford_comma("You can send emails, build landing pages, and manage contacts.") == []

    def test_library_incorrect(self):
        assert _ids(check_oxford_comma("You can send emails, build landing pages and manage contacts.")) == ["GRM-01"]

    def test_compound_sentence_not_a_list(self):
        assert check_oxford_comma("I opened the app, and it crashed immediately.") == []

    def test_four_item_list(self):
        assert _ids(check_oxford_comma("We support Chrome, Firefox, Safari and Edge.")) == ["GRM-01"]


# --- GRM-04: Ampersands ---

class TestAmpersand:
    def test_ampersand_in_copy(self):
        assert _ids(check_ampersand("Reporting & analytics")) == ["GRM-04"]

    def test_brand_att(self):
        assert check_ampersand("Powered by AT&T") == []

    def test_brand_hm(self):
        assert check_ampersand("Shop the H&M collection") == []

    def test_brand_pg(self):
        assert check_ampersand("Brought to you by P&G") == []

    def test_library_correct(self):
        assert check_ampersand("Terms and conditions") == []

    def test_library_incorrect(self):
        assert _ids(check_ampersand("Terms & conditions")) == ["GRM-04"]


# --- GRM-05: Numerals ---

class TestNumerals:
    def test_spelled_out_numbers(self):
        assert _ids(check_numerals("You have two new notifications and five pending requests.")) == ["GRM-05"]

    def test_number_starts_sentence_exception(self):
        assert check_numerals("Twelve users are currently online.") == []

    def test_numerals_correct(self):
        assert check_numerals("You have 3 invitations and 12 unread messages.") == []

    def test_one_as_pronoun(self):
        assert check_numerals("Pick one that works for you.") == []

    def test_library_correct(self):
        assert check_numerals("You have 3 invitations and 12 unread messages.") == []

    def test_library_incorrect(self):
        assert _ids(check_numerals("You have three invitations and twelve unread messages.")) == ["GRM-05"]

    def test_number_in_middle(self):
        assert _ids(check_numerals("Select three items from the list below.")) == ["GRM-05"]

    def test_multiple_sentences_number_starts_second(self):
        assert check_numerals("You have 5 items. Seven are on sale right now.") == []

    def test_version_numbers_ignored(self):
        assert check_numerals("Upgrade to version 3.2.1 for new features.") == []


# --- CON-03: Date format ---

class TestDateFormat:
    def test_numeric_date(self):
        assert _ids(check_date_format("Your trial expires on 3/16/26.")) == ["CON-03"]

    def test_spelled_out_date(self):
        assert check_date_format("Your trial expires on March 16, 2026.") == []

    def test_library_incorrect(self):
        assert _ids(check_date_format("3/16/26")) == ["CON-03"]

    def test_no_date(self):
        assert check_date_format("Your order has shipped.") == []


# --- Full pipeline ---

class TestRunPreprocess:
    def test_multiple_violations(self):
        assert sorted(_ids(run_preprocess("You can edit, preview & publish content on 3/16/26."))) == ["CON-03", "GRM-04"]

    def test_clean_copy(self):
        assert run_preprocess("Your changes are saved. Go to settings to update your preferences.") == []

    def test_novel_grm01(self):
        assert _ids(run_preprocess("You can track orders, manage returns and contact support from your account page.")) == ["GRM-01"]

    def test_novel_grm05(self):
        assert _ids(run_preprocess("You have two new notifications and five pending requests.")) == ["GRM-05"]

    def test_novel_grm05_sentence_start(self):
        assert run_preprocess("Twelve users are currently online.") == []

    def test_violations_have_deterministic_source(self):
        violations = run_preprocess("Terms & conditions")
        assert all(v.source == "deterministic" for v in violations)
