# Roadmap: Level Up App — PWA Stabilization & Transition

## Overview

The PWA broke when the native app's Firebase rules overwrote production without a merge review. This roadmap restores the PWA to working order, fixes external integrations that depend on Firebase Storage, and builds the path for transitioning users to the native app. Three phases in strict sequence: read before touching, fix before directing, direct after confirming.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Diagnose** - Read live Firebase state and confirm root cause before touching anything
- [ ] **Phase 2: Stabilize** - Merge Firebase rules and restore PWA event registration and external photo integrations
- [ ] **Phase 3: Transition** - Build download banner and document the path from PWA to native app

## Phase Details

### Phase 1: Diagnose
**Goal**: Confirm the exact live Firebase state and root cause of all reported breakage before any deployment
**Depends on**: Nothing (first phase)
**Requirements**: DIAG-01, DIAG-02, DIAG-03
**Success Criteria** (what must be TRUE):
  1. Live Firestore rules have been captured and diffed against both the PWA repo and native app repo versions — divergences are documented
  2. Live Storage rules have been captured and diffed against both codebases — the storage access change is identified and documented
  3. A written summary exists mapping each reported symptom (blank RSVP screen, 403 photo errors) to a specific rule or config change
**Plans:** 1 plan

Plans:
- [ ] 01-01-PLAN.md — Fetch live Firebase rules, diff against both codebases, produce DIAGNOSIS.md with root cause mapping

### Phase 2: Stabilize
**Goal**: PWA event registration works and external photo integrations (Squarespace, Salesforce) return photos
**Depends on**: Phase 1
**Requirements**: RULE-01, RULE-02, RULE-03, RULE-04, RULE-05, RULE-06, INTG-01, INTG-02, INTG-03
**Success Criteria** (what must be TRUE):
  1. A scholar can open an event, click Register, complete the RSVP flow, and see their registration confirmed — no blank screen
  2. The Squarespace website photo embed loads coach/scholar headshots without a 403 error
  3. The Salesforce integration pulls user photos correctly
  4. A canonical `storage.rules` file exists in the PWA repo, is tracked in `firebase.json`, and is deployed from `Level-Up-App/` only
  5. All deployed rule changes have been validated against native app compatibility before going live
**Plans**: TBD

Plans:
- [ ] 02-01: Merge Firestore rules and create canonical storage.rules
- [ ] 02-02: Deploy merged rules and verify RSVP flow and external integrations

### Phase 3: Transition
**Goal**: PWA users can discover and download the native app, and the deployment protocol prevents future rule collisions
**Depends on**: Phase 2
**Requirements**: TRAN-01, TRAN-02, TRAN-03, TRAN-04
**Success Criteria** (what must be TRUE):
  1. A dismissible banner appears in the PWA on mobile directing users to the correct app store (iOS or Android) — does not appear on desktop
  2. A user who dismisses the banner does not see it again on return visits
  3. A documented transition roadmap exists covering timeline, milestones, and criteria for sunsetting the PWA
**Plans**: TBD

Plans:
- [ ] 03-01: Build AppDownloadBanner component with platform detection and localStorage dismissal
- [ ] 03-02: Document transition roadmap and canonical Firebase deploy protocol

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Diagnose | 0/1 | Not started | - |
| 2. Stabilize | 0/2 | Not started | - |
| 3. Transition | 0/2 | Not started | - |
