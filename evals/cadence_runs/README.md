# Cadence runs

Filled-in templates from actual review cycles. Checked into git so
the hub (`/dashboard/cadence/overview`) and the CLI
(`tools/cadence_status.py`) can surface last-completion dates and
link the output.

Layout:

```
evals/cadence_runs/
├── weekly/<YYYY-Www>.md
├── monthly/<YYYY-MM>-<moment>.md
├── quarterly/<YYYY-Qn>.md
└── annual/<YYYY>.md
```

Each file is a cycle's completed template (see
`evals/cadence_templates/`). The hub picks up the newest file per
kind as the cadence's "last completed" timestamp.
