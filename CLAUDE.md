# Level Up Cincinnati — PWA Repo CLAUDE Context

## Firebase Infrastructure Ownership (Phase 14, 2026-04)

This repo (`level-up-pwa/`) owns ONLY **hosting** on the `level-up-app-c9f47` project.

Cloud Functions, firestore.rules, and storage.rules are owned by the mobile repo:
`~/Projects/level-up/level-up-app/`

### Deploy commands (PWA repo)

| Target | Command |
|--------|---------|
| Hosting | `firebase deploy --only hosting --project level-up-app-c9f47` |

That's it. No functions deploys, no rules deploys, no firestore/storage block in `firebase.json`.

### Archived (do not edit)

- `functions.archived/` — pre-Phase-14 functions, preserved for rollback safety. Will be deleted in a follow-up cleanup ~7-14 days after Phase 14 ships.

### Rollback Phase 14 (emergency only)

```bash
git revert <phase-14-commit-sha>
git push origin main
mv functions.archived functions
# DO NOT redeploy from this repo. The mobile repo is canonical.
# This rollback is only for retrieving config or reading old code.
```

The Phase 14 disconnect commit is tagged `phase14-pwa-disconnected`.

### See also

- `~/Projects/level-up/level-up-app/CLAUDE.md` — mobile repo deploy procedures
- `~/Projects/level-up/level-up-app/.planning/phases/14-firebase-infrastructure-consolidation/` — full Phase 14 docs
