# Stability report: 3 eval runs

**Date:** 2026-03-24 19:57 UTC
**Model:** claude-sonnet-4-20250514
**Cases:** 41

## Per-run accuracy

- Run 1: 82.9%
- Run 2: 82.9%
- Run 3: 80.5%
- Average: 82.1%

## Stability

- Stable passes (correct every time): 33/41
- Stable fails (wrong every time): 7/41
- Unstable (flipped between runs): 1/41

## Quality metrics

- False positives: 12
- False positive rate: 19.0%
- Standard ID accuracy: 96.2%

## Performance

- Average latency: 5.6s per check
- Total tokens: 474,273 input / 42,769 output
- Estimated cost: $2.06

## Unstable cases

- **TRN-04 novel idiom**: correct 2/3 times
  - Input: "Getting started is a breeze."
  - Expected: fail
