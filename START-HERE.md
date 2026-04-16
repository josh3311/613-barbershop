# Start here (every session)

**Humans and AI assistants:** Read the files below **in order** before planning, reviewing, or implementing work. This keeps sessions aligned with architecture, sprint plan, and store/security constraints.

| Order | File | Why |
|------:|------|-----|
| 1 | **`ARCHITECT_PLAN.md`** | Navigation, Firestore schema, types, and conventions. **Read every session** so implementation matches the agreed architecture. |
| 2 | **`PROJECT_STATUS.md`** | What’s done, **ACTIVE SPRINT**, **BACKLOG**, UI rules, key files. **Primary source for what to build next.** |
| 3 | **`PROJECT-HANDOFF-FOR-KIMI.md`** | Security & App Store work already completed (env, Firestore rules, EAS, ErrorBoundary). Avoid redoing or contradicting this. |
| 4 | **`REVIEWER_CHECKLIST.md`** | Before release or security-sensitive changes: compliance gates (keys, rules, `app.json`, ErrorBoundary). |

**After shipping a meaningful change:** update **`PROJECT_STATUS.md`** (Last Updated, sprint/backlog, completed items). If you changed navigation, collections, or shared types, update **`ARCHITECT_PLAN.md`**. If you changed security or store config, update **`PROJECT-HANDOFF-FOR-KIMI.md`** or **`REVIEWER_CHECKLIST.md`** as appropriate.

---

*One sentence for bookmarks:* **Read `ARCHITECT_PLAN.md` then `PROJECT_STATUS.md`; add handoff + checklist when touching infra or release.**
