# Review cadence templates

Human-eval build plan Session 33. One template per cadence, plus
this README as the index.

| Cadence | Target interval | Template | Runs |
|---|---|---|---|
| Weekly | 7 days | [weekly.md](weekly.md) | Implicit — via `/dashboard/cadence` |
| Monthly | 4 weeks | [monthly.md](monthly.md) | Implicit — rotating moment via `/dashboard/cadence/moment/[moment]` |
| Quarterly | 13 weeks | [quarterly.md](quarterly.md) | `tools/drift_check.py` → artifact in `evals/drift/reports/` |
| Annual | 52 weeks | [annual.md](annual.md) | `tools/annual_audit_sample.py` + `tools/annual_audit_score.py` → artifact in `evals/annual_audit/reports/` |

The quarterly cadence is load-bearing: graduation thresholds
depend on the measured self-drift ceiling. A missed quarter leaves
the threshold out of calibration. Surfaces emphasise this.

Templates are prose skeletons — fill them in during the cycle, save
to `evals/cadence_runs/<cadence>/<date>.md`, and the hub picks them
up via disk artifact presence. The hub never edits these templates;
edit them when the process itself changes.
