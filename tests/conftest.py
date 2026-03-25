"""Shared test fixtures for the content standards checker."""

import pytest

from content_checker.standards.loader import load_standards


@pytest.fixture
def standards_data():
    """Load the standards library once per test session."""
    return load_standards()
