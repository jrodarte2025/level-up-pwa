# Requirements: Level Up App — PWA Stabilization & Transition

**Defined:** 2026-03-10
**Core Value:** The PWA must continue working reliably until users have migrated to the native app. No fix can break the new native app.

## v1 Requirements

### Diagnosis

- [x] **DIAG-01**: Diff live Firestore rules against both codebases' rule files to identify all divergences
- [x] **DIAG-02**: Diff live Storage rules against both codebases to identify access changes
- [x] **DIAG-03**: Document all rule changes and their impact on PWA, external integrations, and native app

### Firebase Rules

- [ ] **RULE-01**: Create canonical `storage.rules` file in PWA repo, registered in `firebase.json`
- [ ] **RULE-02**: Merge Firestore rules to work for both PWA and native app simultaneously
- [ ] **RULE-03**: Restore public read access on Storage paths used by external photo embeds
- [ ] **RULE-04**: Restore `registrationCodes` public read access (required for signup flow)
- [ ] **RULE-05**: Restore RSVP write permissions and admin override
- [ ] **RULE-06**: Validate all rule changes against native app compatibility before deploying

### External Integrations

- [ ] **INTG-01**: Fix Squarespace website photo embed (photos load from Firebase Storage)
- [ ] **INTG-02**: Fix Salesforce photo integration (photos pull correctly)
- [ ] **INTG-03**: Verify `getPhoto` and `listUserPhotos` Cloud Functions are deployed and accessible

### Transition

- [ ] **TRAN-01**: Build download banner component with App Store / Play Store links (hidden behind toggle until launch)
- [ ] **TRAN-02**: Implement platform detection to show correct store link (iOS vs Android vs desktop)
- [ ] **TRAN-03**: Add localStorage-based dismiss so banner doesn't annoy returning users
- [ ] **TRAN-04**: Document transition roadmap from PWA to native app (timeline, milestones, sunset criteria)

## v2 Requirements

### Testing & Prevention

- **TEST-01**: Add `@firebase/rules-unit-testing` for Firestore and Storage rule regression tests
- **TEST-02**: Add CI guard to prevent accidental rule overwrites from either codebase

### Transition Enhancements

- **TRAN-05**: Apple Smart App Banner meta tag (requires App Store ID)
- **TRAN-06**: Update FCM token schema for multi-device support (both apps active simultaneously)
- **TRAN-07**: Service worker deactivation logic for post-PWA sunset

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native app development | Already built and in App Store review |
| New PWA features | Focus is stabilization and transition, not enhancement |
| Firebase backend restructuring | Changes must be surgical, not architectural |
| PWA sunset execution | Planning only — not sunsetting yet |
| CORS changes for restricted endpoints | `getPhoto`/`listUserPhotos` already use wildcard CORS; only revisit if diagnosis reveals need |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DIAG-01 | Phase 1 | Complete |
| DIAG-02 | Phase 1 | Complete |
| DIAG-03 | Phase 1 | Complete |
| RULE-01 | Phase 2 | Pending |
| RULE-02 | Phase 2 | Pending |
| RULE-03 | Phase 2 | Pending |
| RULE-04 | Phase 2 | Pending |
| RULE-05 | Phase 2 | Pending |
| RULE-06 | Phase 2 | Pending |
| INTG-01 | Phase 2 | Pending |
| INTG-02 | Phase 2 | Pending |
| INTG-03 | Phase 2 | Pending |
| TRAN-01 | Phase 3 | Pending |
| TRAN-02 | Phase 3 | Pending |
| TRAN-03 | Phase 3 | Pending |
| TRAN-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after roadmap creation*
