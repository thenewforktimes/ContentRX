# Monthly moment deep-review — {moment}

**Reviewer:** {name}
**Completed:** {YYYY-MM-DD}
**Moment in rotation:** {n} of 13

The rotation is fixed by ISO week + year offset (`momentForWeek` in
`src/lib/cadence.ts`). Every moment surfaces for deep-review ≈4×
per year. Each cycle produces one of these.

## 1. Override signal for this moment (last 30 days)

Source: `/dashboard/cadence/moment/{moment}`.

- Total overrides: {n}
- Top 3 standards overridden:
  1. {standard_id}: {n}
  2. {standard_id}: {n}
  3. {standard_id}: {n}
- Override stance distribution: agree {n}, disagree {n}, agree_but_overriding {n}

## 2. Standard-level observations

For each standard with >5 overrides in the window, is the rule right
for this moment? Candidates for the refinement log:

- {standard_id}: {evidence + proposal}

## 3. Counterpart coverage

Source: `evals/counterparts/` panel if available. For standards
firing in this moment, do the counterparts reflect the situations
that trigger them?

- {standard_id}: coverage {tier-met / tier-short / missing}

## 4. Action items

- [ ] File refinement-log entries for {standards}
- [ ] Update moment-level `content_type_notes` where needed
- [ ] Queue any graduation re-eval triggered by this review

## 5. Notes for next rotation

{freeform — things to keep an eye on next time this moment surfaces}
