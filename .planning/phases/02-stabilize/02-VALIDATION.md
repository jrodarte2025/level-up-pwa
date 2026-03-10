---
phase: 2
slug: stabilize
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no automated tests exist in this project |
| **Config file** | None |
| **Quick run command** | N/A |
| **Full suite command** | N/A |
| **Estimated runtime** | N/A |

---

## Sampling Rate

- **After every task commit:** Manual syntax review of rules files
- **After every plan wave:** Jim performs live verification with admin + coach accounts
- **Before `/gsd:verify-work`:** All 5 success criteria from phase description confirmed
- **Max feedback latency:** N/A — manual verification

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-* | 01 | 1 | RULE-01 | manual | Check file existence + JSON key | N/A | ⬜ pending |
| 02-01-* | 01 | 1 | RULE-02 | manual | `firebase deploy --only firestore:rules --dry-run` | N/A | ⬜ pending |
| 02-01-* | 01 | 1 | RULE-04 | manual | Verify rules file syntax | N/A | ⬜ pending |
| 02-01-* | 01 | 1 | RULE-06 | manual | Review merged rules against native app operations | N/A | ⬜ pending |
| 02-02-* | 02 | 2 | RULE-03 | manual-only | Jim loads Squarespace page, photos appear | N/A | ⬜ pending |
| 02-02-* | 02 | 2 | RULE-05 | manual-only | Jim RSVPs with admin + coach account | N/A | ⬜ pending |
| 02-02-* | 02 | 2 | INTG-01 | manual-only | Jim checks website photo carousels | N/A | ⬜ pending |
| 02-02-* | 02 | 2 | INTG-02 | manual-only | Jim checks Salesforce contacts | N/A | ⬜ pending |
| 02-02-* | 02 | 2 | INTG-03 | manual | `curl` Cloud Function endpoints | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No automated test framework is needed for this phase — all verification is manual (deploying known-good rule patterns, not writing new logic).

Firebase Security Rules testing (`@firebase/rules-unit-testing`) is a future requirement (TEST-01), not in scope for Phase 2.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Squarespace photos load without 403 | RULE-03, INTG-01 | Requires live deploy + browser rendering | Jim loads levelupcincinnati.org, checks scholar/coach photo carousels |
| Salesforce photos load | INTG-02 | Requires live Salesforce integration | Jim checks Salesforce contact photos |
| RSVP flow completes end-to-end | RULE-05 | Requires live deploy + real user accounts | Jim RSVPs as admin and coach, confirms no blank screen |
| Native app compatibility | RULE-06 | Requires real device testing | Verify core native app flows still work after rule deployment |

---

## Validation Sign-Off

- [ ] All tasks have manual verify or Wave 0 dependencies
- [ ] Sampling continuity: manual review after each task commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency: acceptable for manual verification
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
