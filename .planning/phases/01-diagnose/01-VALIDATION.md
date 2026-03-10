---
phase: 1
slug: diagnose
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual diagnostic (no automated test framework for security rules in this project) |
| **Config file** | none — see Wave 0 |
| **Quick run command** | `diff -u /tmp/live-firestore.rules firestore.rules` |
| **Full suite command** | Run all three diffs + function list + CORS check + reproduction tests |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Verify diffs produce expected output
- **After every plan wave:** N/A (single-wave phase)
- **Before `/gsd:verify-work`:** DIAGNOSIS.md exists with all sections populated, every divergence mapped to impact
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | DIAG-01 | smoke | `diff -u /tmp/live-firestore.rules firestore.rules` | No (temp files at runtime) | ⬜ pending |
| 01-01-02 | 01 | 1 | DIAG-02 | smoke | `diff -u /tmp/live-storage.rules storage.rules` | No (temp files at runtime) | ⬜ pending |
| 01-01-03 | 01 | 1 | DIAG-03 | manual-only | Review DIAGNOSIS.md for completeness | N/A — output is a document | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No existing `storage.rules` in PWA repo — must note in diagnosis (Phase 2 fix)
- [ ] No `@firebase/rules-unit-testing` setup — out of scope (v2 requirement TEST-01)

*Existing infrastructure covers diff-based verification; no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All changes documented with impact mapping | DIAG-03 | Output is a written document, not testable code | Review DIAGNOSIS.md for: every divergence listed, each mapped to a symptom, impact assessment included |
| Google Cloud Console API key check | DIAG-01 | Requires manual Console access (`gcloud` auth unavailable) | Open Google Cloud Console > APIs & Services > Credentials, check for key restrictions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
