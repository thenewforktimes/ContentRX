/**
 * Unit tests for the sensitive-pattern pre-screen.
 *
 * The bar each pattern test holds:
 *   1. The canonical positive case fires the right type.
 *   2. The canonical negative case (the false-positive shape we'd hate
 *      to block) does NOT fire.
 *   3. The matched text never appears in the function's return value.
 *
 * Test card numbers below are Stripe / Visa / etc. published test
 * values that are Luhn-valid by design. Real PANs are not in this
 * file (and shouldn't be — `git log` is not the place for cardholder
 * data).
 */

import { describe, expect, it } from "vitest";
import {
  detectSensitivePatterns,
  sensitiveDataErrorMessage,
} from "./pii-screen";

describe("SSN detection", () => {
  it("fires on a hyphenated SSN", () => {
    expect(detectSensitivePatterns("My SSN is 123-45-6789.")).toEqual(["ssn"]);
  });

  it("fires when SSN is the entire string", () => {
    expect(detectSensitivePatterns("123-45-6789")).toEqual(["ssn"]);
  });

  it("does NOT fire on bare 9 digits (too high false-positive surface)", () => {
    expect(detectSensitivePatterns("123456789")).toEqual([]);
  });

  it("does NOT fire on a phone number", () => {
    expect(detectSensitivePatterns("Call 1-800-555-1234")).toEqual([]);
  });
});

describe("credit card detection", () => {
  // Stripe-published test card numbers, Luhn-valid by design.
  const VISA_TEST = "4111111111111111";
  const MASTERCARD_TEST = "5555555555554444";

  it("fires on a Visa test number", () => {
    expect(detectSensitivePatterns(`Card: ${VISA_TEST}`)).toEqual([
      "credit_card",
    ]);
  });

  it("fires on a Mastercard test number", () => {
    expect(detectSensitivePatterns(MASTERCARD_TEST)).toEqual(["credit_card"]);
  });

  it("fires on an Amex test number with spaces", () => {
    // 15 digits, Amex format
    const spaced = "3782 822463 10005";
    expect(detectSensitivePatterns(spaced)).toEqual(["credit_card"]);
  });

  it("fires on a hyphen-separated card", () => {
    expect(detectSensitivePatterns("4111-1111-1111-1111")).toEqual([
      "credit_card",
    ]);
  });

  it("does NOT fire on a non-Luhn 16-digit number", () => {
    // Random 16-digit run that fails Luhn — order ID, tracking number,
    // anything other than a real card.
    expect(detectSensitivePatterns("1234567890123456")).toEqual([]);
  });

  it("does NOT fire on a 12-digit number (below card length)", () => {
    expect(detectSensitivePatterns("123456789012")).toEqual([]);
  });
});

describe("AWS access key detection", () => {
  it("fires on a well-formed AKIA key", () => {
    // Synthetic — 16 base32 chars after AKIA, enough to match the regex.
    expect(detectSensitivePatterns("AKIAIOSFODNN7EXAMPLE")).toEqual([
      "aws_key",
    ]);
  });

  it("does NOT fire on the prefix alone", () => {
    expect(detectSensitivePatterns("AKIA-prefix")).toEqual([]);
  });
});

describe("Stripe key detection", () => {
  it("fires on a Stripe test secret key", () => {
    const fakeStripe = "sk_test_" + "A".repeat(40);
    expect(detectSensitivePatterns(fakeStripe)).toEqual(["api_key"]);
  });

  it("fires on a Stripe live secret key", () => {
    const fakeStripe = "sk_live_" + "B".repeat(40);
    expect(detectSensitivePatterns(fakeStripe)).toEqual(["api_key"]);
  });
});

describe("generic sk- API key detection", () => {
  it("fires on an OpenAI-style sk- key", () => {
    const fakeKey = "sk-" + "C".repeat(48);
    expect(detectSensitivePatterns(fakeKey)).toEqual(["api_key"]);
  });

  it("fires on an Anthropic-style sk-ant- key", () => {
    const fakeKey = "sk-ant-" + "D".repeat(48);
    expect(detectSensitivePatterns(fakeKey)).toEqual(["api_key"]);
  });

  it("does NOT fire on short sk- strings (false-positive risk)", () => {
    expect(detectSensitivePatterns("see sk-2 in the docs")).toEqual([]);
  });
});

describe("GitHub PAT detection", () => {
  it("fires on a ghp_ token", () => {
    const fakeToken = "ghp_" + "E".repeat(40);
    expect(detectSensitivePatterns(fakeToken)).toEqual(["api_key"]);
  });

  it("fires on a gho_ token", () => {
    const fakeToken = "gho_" + "F".repeat(40);
    expect(detectSensitivePatterns(fakeToken)).toEqual(["api_key"]);
  });

  it("fires on a ghs_ token", () => {
    const fakeToken = "ghs_" + "G".repeat(40);
    expect(detectSensitivePatterns(fakeToken)).toEqual(["api_key"]);
  });
});

describe("clean strings", () => {
  it("returns empty for ordinary UI copy", () => {
    expect(detectSensitivePatterns("Click here to learn more")).toEqual([]);
  });

  it("returns empty for prose with numbers", () => {
    expect(
      detectSensitivePatterns(
        "Your team uses 4 of 5 seats. 250 checks remaining this month.",
      ),
    ).toEqual([]);
  });

  it("returns empty on the empty string", () => {
    expect(detectSensitivePatterns("")).toEqual([]);
  });
});

describe("multiple patterns in one string", () => {
  it("dedupes to unique types", () => {
    // Two SSN-shaped values — should still report `ssn` exactly once.
    const input = "Two SSNs: 111-22-3333 and 444-55-6666";
    expect(detectSensitivePatterns(input)).toEqual(["ssn"]);
  });

  it("reports both types when both fire", () => {
    const input = "SSN 123-45-6789, Card 4111111111111111";
    const result = detectSensitivePatterns(input);
    expect(result).toContain("ssn");
    expect(result).toContain("credit_card");
    expect(result).toHaveLength(2);
  });
});

describe("sensitiveDataErrorMessage", () => {
  it("names a single pattern", () => {
    const msg = sensitiveDataErrorMessage(["ssn"]);
    expect(msg).toContain("Social Security Number");
    expect(msg).toContain("placeholder");
  });

  it("joins multiple patterns", () => {
    const msg = sensitiveDataErrorMessage(["ssn", "credit_card"]);
    expect(msg).toContain("Social Security Number");
    expect(msg).toContain("credit card number");
  });

  it("never echoes a raw matched value", () => {
    // The matched value isn't an input here — proving by construction
    // that the message function takes only the type, not the text.
    const msg = sensitiveDataErrorMessage(["api_key"]);
    expect(msg).not.toMatch(/sk_test_|ghp_|AKIA/);
  });
});
