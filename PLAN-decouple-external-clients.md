# Decouple Atlantic Compressor + Air Service of Florida from the JDD console

**Status:** drafted 2026-10-21, not started
**Scope:** JDD-side decoupling only. GitHub repos, Vercel projects, Resend and domains are
handled by the separate client-ownership migration and are **not touched here**.

> Paths in this file use forward slashes deliberately. Tailwind v4 auto-detects its content
> sources from the git root (`jdd-ops`) and this console has no `@source` overrides, so a
> markdown file here containing `C:` + backslash + `Users` fails the build with
> "Invalid code point" blamed on `globals.css:1:1`.

---

## 1. What this actually is

It is **one client relationship**, not two. `scripts/link-external-client.js` wrote both sites
onto a single portal account and a single ClientRecord:

- Account email: `sales@atlanticcompressor.com`
- Primary slug: `atlantic-compressor`; `air-service-florida` is the secondary slug on the same record
- Client id: **`c_b66ecf7660be4b48af85`** (resolved live; re-resolve before applying)

Two surfaces hold it: the **disk roster** (`clients/<slug>/`, which is what `/manage` and the
root picker enumerate) and **prod KV** (`tolerant-pug-147398`).

## 2. Verified state (read-only probe, 2026-10-21)

| Fact | Value |
|---|---|
| KV target | `tolerant-pug-147398.upstash.io` — prod. Test KV (`rich-eel`) is commented out at `jdd-ops/.env:62` |
| Total keys in prod KV | **8**; six of them are this relationship |
| `jdd:client:index` members | exactly one — `c_b66ecf7660be4b48af85` |
| Client's Clerk user | `clerkUserId: null` — they never signed up, so there is **no** `account-by-user` key for them |
| `jdd:account-by-user:user_3KMtKElJodKcxOHtSKK0C8rtJrj` | maps to `xanderjuneau@gmail.com`. **Yours. Never touch.** |
| `jdd:account:xanderjuneau@gmail.com` | **still lists `air-service-florida` in `sites[]`** — stale `portal.attach` from 2026-10-07, never undone |
| `_e2e_test_growth` / `_e2e_test_starter` | disk only; **no KV presence in prod at all** |
| Baseline | `tsc --noEmit` exit 0, `check-schema` green, with 60 uncommitted wizard files present |
| Hardcoded refs outside `clients/` | `scripts/link-external-client.js`, `HANDOFF-starter-receptionist.md:174-175`. No TypeScript references either slug |

### Two corrections to the incoming handoff

1. It missed `jdd:account:xanderjuneau@gmail.com` still holding `air-service-florida`.
   Detaching the client's account alone leaves the site visible in **your own** portal.
2. Its caution that "other clients live in `jdd:client:index`" is wrong — this is the only
   member. `ZREM` is still the correct op (via `deleteClientRecord`), but nothing else is at risk.

### Why the existing teardown route cannot be used

`console/src/app/api/manage/teardown/route.ts` does exactly phases 0, 1 and 8 of what we want —
and then phases 2 through 7 delete the Vercel project, GitHub repo, Retell agent + LLM, Twilio
number, Make scenario and Airtable base. Those are the client's property under the ownership
migration. We need the detach-only subset, which is why this gets its own script.

---

## 3. Exact KV target list

Re-resolve the id first: `GET jdd:client:by-slug:atlantic-compressor`. Do not hardcode it.

**DELETE (5 keys)**

1. `jdd:account:sales@atlanticcompressor.com`
2. `jdd:client:c_b66ecf7660be4b48af85`
3. `jdd:client:by-slug:atlantic-compressor`
4. `jdd:client:by-slug:air-service-florida`
5. `jdd:client:by-email:sales@atlanticcompressor.com`

**ZREM (1)**

6. `jdd:client:index` — remove member `c_b66ecf7660be4b48af85`; do not delete the set

**EDIT, do not delete (1)**

7. `jdd:account:xanderjuneau@gmail.com` — remove the `air-service-florida` entry from `sites[]`.
   The account record and its `account-by-user` index stay.

**NEVER TOUCH**

- `jdd:account-by-user:user_3KMtKElJodKcxOHtSKK0C8rtJrj` (yours)

### Coverage note

`deleteClientRecord(id)` in `lib/client-record-store.js:158` already handles items 2, 3, 5 and
the ZREM. It does **not** handle item 4 — `by-slug:air-service-florida` was written by hand at
`scripts/link-external-client.js:114` because `saveClientRecord` only indexes `record.slug`.
The reverse script must delete it by hand, mirroring the linker exactly.

---

## 4. Phases

### Phase 0 — Archive before anything (zero mutations)

Destination: **`ops/client-archives/`** (i.e. `C:/Users/Xander/Desktop/ops/client-archives/`) —
outside the repo, because `/clients/*` is fully gitignored and would not survive a reclone.
These are business records, alongside the EIN and LLC filings.

```
ops/client-archives/
  README.md                          what these are, why, and how to re-onboard
  atlantic-compressor/
    site.ts                          verbatim
    env.local.txt                    verbatim shim env
    vercel-env.json                  optional, see below
    kv-snapshot.json                 all 7 KV values verbatim, pre-delete
  air-service-florida/
    site.ts
    env.local.txt
    draft.json                       composition draft, Air Service only
    vercel-env.json                  optional
```

- Copy each `clients/<slug>/site.ts`, `.env.local`, and Air Service's `.draft.json`.
- Write `kv-snapshot.json` holding the raw value of every key in section 3 **before** any
  delete. This is the only thing that makes item 7 reversible.
- **Flag:** the shim `.env.local` files hold only three pointer vars (`VERCEL_PROJECT_NAME`,
  `VERCEL_PROJECT_ID`, `PORTAL_ACCOUNT_EMAIL`). The site's *real* env lives in the client's
  Vercel project. If a true re-onboard snapshot is wanted, add a **read-only** Vercel env
  fetch per project; that is a read, not a mutation, but confirm before adding it.

### Phase 1 — Reverse script

New file `scripts/unlink-external-client.js`, mirroring `link-external-client.js` in shape and
conventions: `import 'dotenv/config'`, dry-run by default, writes only on `--apply`, same
`accountStoreConfigured()` / `clientRecordsConfigured()` preflight.

It must:

1. **Assert the KV host contains `tolerant-pug`** and abort otherwise. This is the landmine
   guard — a run against `rich-eel` would silently do nothing and look successful.
2. Resolve the client id live from `by-slug:atlantic-compressor`; abort if absent.
3. Print every key with its current value and the intended op, then stop unless `--apply`.
4. On `--apply`, in this order:
   - `detachSiteFromAccount('sales@atlanticcompressor.com', <each slug>)`
   - `detachSiteFromAccount('xanderjuneau@gmail.com', 'air-service-florida')`
   - `deleteClientRecord(id)`
   - `redis.del(clientBySlugKey('air-service-florida'))` — the manual one
   - `redis.del(accountKey('sales@atlanticcompressor.com'))`
5. Re-read all seven keys afterward and print the result, so the run proves itself.

Add `"unlink-external-client": "node scripts/unlink-external-client.js"` to `package.json`
scripts, matching the existing entries.

Gate: run **without** `--apply`, show the output, get the go-ahead, then `--apply`.

### Phase 2 — Drop from the disk roster

`listClientContexts` (`console/src/lib/clients.ts:140`) enumerates `clients/`, skipping
dotfiles and `_`-prefixed fixtures. Moving a folder under `clients/.archive/` removes it from
the roster, which is the convention the teardown route already uses.

```
clients/atlantic-compressor/   ->  clients/.archive/atlantic-compressor/
clients/air-service-florida/   ->  clients/.archive/air-service-florida/
```

Do this **after** Phase 0 has copies outside the repo, and after Phase 1 verifies clean.
Leave `_e2e_test_growth`, `_e2e_test_starter`, `juneau-s-digital-designs` alone.

### Phase 3 — Side-effects

1. ~~**`console/.state/orphan-ignore.json`**~~ — **NOT NEEDED; the premise was wrong.**

   The plan assumed `/orphans` would flag `atlantic-compressor`, `air-service-florida` and
   `atlantic-compressor-checkout` as unclaimed Vercel projects once the client folders were
   gone. It does not: both recorded project ids return 404 to the JDD Vercel token in every
   scope (personal and the `juneau-digital-designs-projects` team), and the team holds only
   `e2e_test_growth` and `juneau-digital-designs`. These projects were never under JDD's
   Vercel account.

   An ignore file was created and then removed — entries that can never match would have
   implied the projects were still ours. Verified post-decoupling: `/orphans` reports two
   items, `juneau-digital-designs` and the demo-line Retell agent, neither related to this
   work. Both are pre-existing permanent false positives and are left alone here.

   Side finding recorded in the archive README: the `VERCEL_PROJECT_ID` in each shim's
   `.env.local` was already unresolvable to the JDD token, so the "health/deploy VIEWS" the
   shim comments describe were 404ing for both clients before any of this.

2. **Retire `scripts/link-external-client.js`.** Once decoupled it is a loaded gun: a stray
   `--apply` recreates all six keys. Delete it; its content survives in git history, and the
   reverse script documents what it did.

3. **`HANDOFF-starter-receptionist.md:174-175`** — mark both slugs decoupled as of 2026-10-21
   with a pointer to `ops/client-archives/`, so the doc stops contradicting the roster.

### Phase 4 — Verify

`check-schema` and `tsc` were already green before this work and reference neither slug, so
they prove nothing on their own. Run them as regression gates, but the real checks are functional:

- [ ] Re-run the unlink script's read phase — all 5 deleted keys absent, `jdd:client:index`
      empty, `jdd:account:xanderjuneau@gmail.com` present with `air-service-florida` gone and
      its other fields intact
- [ ] `jdd:account-by-user:user_3KMt...` still maps to `xanderjuneau@gmail.com`
- [ ] `clients/` still contains `_e2e_test_growth`, `_e2e_test_starter`, `juneau-s-digital-designs`
- [ ] `grep -rnE 'atlantic-compressor|air-service-florida'` over tracked files returns only the
      archive README, the dated HANDOFF note, the orphan-ignore list and git history
- [ ] `npm run check-schema` green
- [ ] `cd console && npx tsc --noEmit` exit 0
- [ ] `cd console && npm run build` succeeds — watch `.next/prerender-manifest.json`, not
      `BUILD_ID`, for real completion
- [ ] Console dev server: root picker and `/manage` show neither client, no broken card.
      **`npm run dev` only — never `--turbo`,** it breaks `intake.ts` client-schema loading
- [ ] `/orphans` does not list the three Vercel projects

---

## 5. Git

Branch from the **current tip** of `feat/onboard-wizard-redesign` so this lands *on top of*
the wizard work, never beside it:

```bash
git checkout -b feat/decouple-external-clients     # tip of feat/onboard-wizard-redesign
# ...phases 1-3...
git add scripts/unlink-external-client.js package.json HANDOFF-starter-receptionist.md
git rm scripts/link-external-client.js
git commit
git checkout feat/onboard-wizard-redesign
git merge feat/decouple-external-clients           # fast-forward, nothing diverged
```

The 60 uncommitted wizard files travel with the working tree across both switches and are
**never staged** — verified zero overlap: every tracked file this task touches is clean, and
the dirty set is entirely `console/src/**` plus `lib/vercel-sync.js` and `onboard.js`.
`lib/account-store.js` and `lib/client-record-store.js`, which the new script imports, are
unmodified.

Everything in `clients/`, `console/.state/` and `ops/client-archives/` is gitignored or outside
the repo, so the commit is just: new script, deleted script, `package.json`, one doc edit.

---

## 6. Done when

- Both sites absent from the console roster and from every KV account record
- Archives outside the repo, with a `kv-snapshot.json` that makes item 7 reversible
- Your own portal account intact but no longer holding `air-service-florida`
- Fixtures untouched
- `check-schema`, `tsc`, `build` green; console renders; `/orphans` quiet
- One line of history, merged back onto `feat/onboard-wizard-redesign`
