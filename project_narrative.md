

### Addendum: end-of-session fixes and next-session scope

**Python 3.14 editable install fix (resolved).** The root cause: Python 3.14 doesn't bundle `setuptools`. The `.pth` file from `pip install -e .` exists but Python can't process it without setuptools at runtime. Fix: `pip install setuptools` in the venv before `pip install -e .`. The `PYTHONPATH` workaround is no longer needed.

**Auto-annotator tool (scoped, not built).** Full spec in `auto_annotator_spec.md`. Two-stage process: (1) run each extracted case through `check()` to fill machine fields, (2) LLM annotation pass calibrated against the 119 existing human-annotated cases to pre-fill `human_verdict`, `human_confidence`, `human_notes`. Low confidence is the default for ambiguous cases. Voice calibration uses 8–10 few-shot examples from the user's best annotations. Output reads like the user wrote it. Lives in `tools/auto_annotate.py` and `tools/annotator_prompt.py`.

**Context continuity for future chats.** Three layers: memory (project summary + constraints), ARCHITECTURE.md (package structure + conventions), project_narrative.md (session history). If a future chat builds standalone files instead of integrating with the package at `src/content_checker/`, ARCHITECTURE.md isn't in context — point it there.
