# Standards library audit: hard rules vs. nuanced guidelines

Each standard is classified as either **hard** (mechanical, binary check — the agent should apply it literally) or **nuanced** (context-dependent, requires judgment — the agent should consider the content type and context before flagging).

Standards marked as needing a rule revision have updated text noted below.

---

## Clarity

| ID | Rule type | Needs revision? | Notes |
|---|---|---|---|
| CLR-01 | Nuanced | No | "Unless the audience requires it" is already built into the rule. The challenge is that the agent can't know the audience. Works as-is because the escape hatch is explicit. |
| CLR-02 | Nuanced | No | What counts as "most important" depends on context. The rule is directional, not mechanical. |
| CLR-03 | Hard | Yes | Word count is mechanical, but "aim for" is soft. Revised to clarify this is a guideline with a hard ceiling. |
| CLR-04 | Nuanced | No | "One idea" is inherently subjective. The agent needs judgment here. |
| CLR-05 | Nuanced | Yes | "Not irreversible" is an obvious double negative, but "can't proceed without" is technically a double negative that reads naturally. The rule needs scoping to target confusing constructions, not all negation pairs. |

### Revised rules

**CLR-03:** "Use short sentences. Aim for 15–20 words per sentence. Sentences over 25 words should almost always be split."

**CLR-05:** "Avoid confusing double negatives that make the reader work to parse the meaning. Constructions like 'not irreversible' or 'not uncommon' should be rewritten as direct statements. Natural phrasing like 'can't proceed without' is acceptable when it reads clearly."

---

## Voice and tone

| ID | Rule type | Needs revision? | Notes |
|---|---|---|---|
| VT-01 | Nuanced | Yes | Active voice is better for instructions and explanations. Passive voice is appropriate for confirmations and status messages where the actor is irrelevant. The current rule is too absolute. |
| VT-02 | Nuanced | Yes | "You/your" is right for consumer UI. But admin panels, documentation, and system descriptions legitimately refer to "users" and "members." Needs a content-type scope. |
| VT-03 | Nuanced | No | "Conversational but not casual" is inherently a judgment call. The examples illustrate the extremes well enough. |
| VT-04 | Nuanced | No | The line between confidence and hedging requires judgment. "About 5 minutes" is confident enough; "should probably take around maybe" is not. |
| VT-05 | Nuanced | Yes | The appropriate level of empathy scales with severity. A failed drag-and-drop upload doesn't need the same warmth as a failed payment. Needs scoping. |

### Revised rules

**VT-01:** "Use active voice when giving instructions or describing user actions. Passive voice is acceptable for confirmations and system status messages where the actor is irrelevant or where naming the actor (e.g., 'we') would feel unnatural."

**VT-02:** "Address the user directly with 'you' and 'your' in consumer-facing UI copy. Third-person references to 'users,' 'members,' or 'customers' are acceptable in admin interfaces, documentation, and system descriptions where the reader is not the subject."

**VT-05:** "Show empathy in error and failure states, scaled to the severity of the problem. High-impact errors (payment failures, data loss) should acknowledge the frustration and reassure the user. Low-impact errors (failed upload, timeout) should be clear and helpful without over-dramatizing."

---

## Consistency

| ID | Rule type | Needs revision? | Notes |
|---|---|---|---|
| CON-01 | Nuanced | No | Requires knowing what terms are synonyms in context, which is a judgment call. Works as a guideline. |
| CON-02 | Hard | No | Capitalization is checkable character by character. Only exception is proper nouns, which the agent should recognize. |
| CON-03 | Hard | No | Either the month is spelled out or it isn't. Binary check. |
| CON-04 | Nuanced | No | Same as CON-01 — determining whether two words describe "the same action" requires context. |
| CON-05 | Hard | No | Product names have known capitalizations. Mechanical check. |

No revisions needed.

---

## Accessibility

| ID | Rule type | Needs revision? | Notes |
|---|---|---|---|
| ACC-01 | Hard | No | "Click here" and "learn more" as standalone links are specific anti-patterns. Easy to flag. |
| ACC-02 | Nuanced | No | Hard to fully evaluate from plain text, but the rule itself is clear. Flagging "highlighted in red" without a text alternative is a reasonable check. |
| ACC-03 | Nuanced | No | What counts as "describes the function" vs. "what it looks like" is a judgment call. The examples illustrate the spectrum well. |
| ACC-04 | Hard | No | "Above," "below," "to the right," "on the left" are specific words to flag. Mechanical check. |
| ACC-05 | Visual | N/A | Already tagged as visual. Can't check from text. |
| ACC-06 | Rich text | N/A | Already tagged as rich_text. Can't check from plain text. |
| ACC-07 | Nuanced | No | "Clear and concise" is subjective. Works as a guideline. |

No revisions needed.

---

## Action-oriented writing

| ID | Rule type | Needs revision? | Notes |
|---|---|---|---|
| ACT-01 | Nuanced | Yes | "Start CTAs with a verb" is correct for buttons. But labels, tabs, and navigation items are legitimately noun phrases ("New project," "Account settings"). The rule needs a content-type scope. |
| ACT-02 | Nuanced | No | What counts as "vague" is a judgment call, but the examples ("submit," "process") illustrate the pattern well. |
| ACT-03 | Nuanced | Yes | Sometimes you must tell users what they can't do — permissions, security restrictions, legal requirements. The rule should focus on framing, not an absolute prohibition on negative statements. |
| ACT-04 | Nuanced | No | What counts as a "clear primary action" depends on the screen. Works as a guideline. |

### Revised rules

**ACT-01:** "Start button and CTA text with a verb. Tell the user what will happen. Navigation labels, tabs, and section headings can use noun phrases ('Account settings,' 'New project') when they describe a destination rather than an action."

**ACT-03:** "When communicating a limitation, lead with what the user can do or offer an alternative path. Don't leave users at a dead end. Stating a restriction is acceptable when it's paired with a next step or workaround."

---

## Content structure

| ID | Rule type | Needs revision? | Notes |
|---|---|---|---|
| STR-01 | Nuanced | Yes | Only applies to content long enough to benefit from structure. Short UI copy, error messages, and tooltips don't need headings. |
| STR-02 | Hard | No | Paragraph length is mechanical. 2–3 sentences is a clear threshold. |
| STR-03 | Hard | No | Parallel grammatical structure can be checked mechanically — verb form, sentence pattern. |
| STR-04 | Nuanced | No | What's "key" information depends on context. Works as a guideline. |
| STR-05 | Nuanced | No | What's "related" is context-dependent. Also hard to evaluate from a single text snippet since it's about information architecture. |
| STR-06 | Rich text | N/A | Already tagged as rich_text. |

### Revised rules

**STR-01:** "Use headings to create scannable structure in help content, onboarding flows, and long-form UI copy. Short UI copy like error messages, tooltips, and confirmations don't need headings."

---

## Grammar and mechanics

| ID | Rule type | Needs revision? | Notes |
|---|---|---|---|
| GRM-01 | Hard | No | Oxford comma is present or absent. Binary check. |
| GRM-02 | Hard | Yes | The rule says "first use" but doesn't account for context. In a single tooltip, expanding "SSO" isn't practical. Applies to longer content where the reader encounters the acronym cold. |
| GRM-03 | Hard | No | Counting exclamation marks is mechanical. |
| GRM-04 | Hard | No | Ampersand is a character check. Brand name exception is narrow and recognizable. |
| GRM-05 | Hard | No | Numerals vs. spelled out is mechanical. Sentence-start exception is already in the rule. |

### Revised rules

**GRM-02:** "Spell out abbreviations and acronyms on first use in body copy, help content, and onboarding flows. Short UI elements like buttons, labels, and tooltips can use common abbreviations (FAQ, SSO, URL) without expansion when the audience is expected to know them."

---

## Inclusive language

| ID | Rule type | Needs revision? | Notes |
|---|---|---|---|
| INC-01 | Hard | No | "He or she" → "they" is a mechanical substitution check. |
| INC-02 | Nuanced | No | Evaluating whether gender is "necessary for the product" requires context. Already tagged as rich_text-adjacent since it's about form design. |

No revisions needed.

---

## Translation readiness

| ID | Rule type | Needs revision? | Notes |
|---|---|---|---|
| TRN-01 | Hard | No | Specific word list (once, right, since). Mechanical check. |
| TRN-02 | Nuanced | Yes | Some -ing words are necessary and natural. "Uploading your file..." as a progress message is fine. The rule should target unnecessary or confusing -ing constructions, not all of them. |
| TRN-03 | Hard | No | Checking for implied subjects is relatively mechanical. |
| TRN-04 | Hard | No | Idiom recognition is broad but the agent is good at it. The library example is clear enough. |
| TRN-05 | Hard | No | Missing function words are detectable. |
| TRN-06 | Hard | No | Currency symbols and non-metric units are mechanical checks. |
| TRN-07 | Nuanced | Yes | Determining whether two words are synonyms in context requires judgment. "Members" and "colleagues" might be synonyms or might refer to different groups depending on the product. |

### Revised rules

**TRN-02:** "Avoid unnecessary -ing words that create ambiguity in translation. Rewrite gerunds and -ing adjectives when a simpler form exists. Progressive verb forms are acceptable when they describe an ongoing action ('Uploading your file...', 'Loading results...')."

**TRN-07:** "Avoid using different words for the same concept within a single piece of content. If 'workspace,' 'team hub,' and 'project space' all refer to the same thing, pick one term and use it consistently. Different terms are acceptable when they refer to genuinely different concepts."

---

## Summary

| Classification | Count |
|---|---|
| Hard rules | 22 |
| Nuanced guidelines | 19 |
| Visual (can't check from text) | 1 |
| Rich text (can't check from plain text) | 2 |
| **Total** | **44 checkable + 2 deferred = 46** |

### Standards with revised rule text (12 total)

CLR-03, CLR-05, VT-01, VT-02, VT-05, ACT-01, ACT-03, STR-01, GRM-02, TRN-02, TRN-07, and VT-01's examples should be updated (both correct and incorrect).
