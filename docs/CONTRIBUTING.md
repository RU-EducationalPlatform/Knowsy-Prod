# Contributing to Knowsy

Welcome. Most of you are students. This doc is short on purpose.

## Setup once

```sh
git clone <repo>
cd InteractiveTextbook
npm install
cp .env.example .env       # then ask for the dev Firebase keys
npm run dev                # open http://localhost:5173
```

If you can hit the landing page and click "Sign in" → log in with Google → land on the textbook, your environment works.

## The workflow

```
feat/your-feature ──PR──► dev ──merge──► [auto-deploy to STAGING]
                                              ↓
                                        (test on staging)
                                              ↓
                          dev ──PR──► main ──merge──► [auto-deploy to PROD]
```

**Two-stage promotion.** Every change crosses two PR boundaries. The first PR (feature → `dev`) is where new code is reviewed and tested in staging. The second PR (`dev` → `main`) is a release promotion done by a maintainer.

### Branch protection (enforced on GitHub)

| Rule | `dev` | `main` |
|---|---|---|
| Required CI status check (`build-and-test`) | ✅ | ✅ |
| Required approving reviews | **2** | 1 |
| Stale reviews dismissed on new pushes | ✅ | ✅ |
| Code owner review required | ✅ | ✅ |
| Linear history (squash or rebase only) | ✅ | ✅ |
| Conversation resolution required | ✅ | ✅ |
| Direct pushes blocked | ✅ | ✅ |
| Force push blocked | ✅ | ✅ |

A maintainer applies these rules once via `bash tools/setup-branch-protection.sh`.

### As a contributor

```sh
# 1. Branch off the latest dev
git checkout dev
git pull
git checkout -b feat/short-description

# 2. Do the work, commit small + often
# Run `npm run ci` locally before you push — saves a round-trip when CI catches something.

# 3. Push and open a PR against dev
git push -u origin feat/short-description
gh pr create --base dev   # or use the GitHub UI

# 4. Address review feedback by pushing more commits.
#    A new push dismisses stale approvals — reviewers will re-look. That's the point.

# 5. Once approved + CI green, the PR is merge-able. Squash merge by default.
#    On merge to dev, GitHub Actions deploys to STAGING within a couple of minutes.
```

### As a maintainer (release to prod)

```sh
# Open a release PR
gh pr create --base main --head dev --title "release: $(date +%Y-%m-%d)"
# CI runs, you give it a sanity-review approval, merge.
# On merge to main, GitHub Actions deploys to PRODUCTION automatically.
```

If something is wrong in prod after a release: `firebase hosting:rollback`. Fix the bug on a feature branch, follow the normal flow back through dev. **Never hot-fix directly on main.**

## What every PR must have

1. **Passing CI** — lint, tests, and build all green. Run `npm run ci` locally first to catch problems before pushing.
2. **2 approvals on PRs to `dev`.** From any contributors with write access; you cannot approve your own PR.
3. **A test for new code.** Even a single `expect(...).toBe(...)` is fine. See `util/html.test.js` for the smallest possible template.
4. **A useful description.** Use the PR template — it asks for what / how-to-test / screenshots.
5. **One thing per PR.** A 200-line PR that does one thing is reviewable. A 200-line PR that does five things is not.

## As a reviewer

Things to check on every PR before approving:
- [ ] CI is green (the GitHub UI shows a check at the bottom of the PR).
- [ ] The change does what the description says — no surprises.
- [ ] New code has tests. If not, push back.
- [ ] No new direct DOM manipulation that bypasses `escapeHtml` / `escapeAttr` (XSS risk).
- [ ] No new feature flags or backward-compat shims that aren't strictly necessary.
- [ ] No commented-out code, debug `console.log`s, or hardcoded keys.

If you have a concern, use **Request changes**, not just a comment — that blocks the merge until addressed.

## Commands you'll use

```sh
npm run dev              # dev server with hot reload
npm run build            # production build → dist/
npm run preview          # serve the prod build locally
npm test                 # run unit tests once
npm run test:watch       # tests, but rerun on save
npm run test:coverage    # tests + coverage report
npm run lint             # ESLint
npm run lint:fix         # ESLint with auto-fix
npm run format           # Prettier write
npm run format:check     # Prettier check (used in CI)
npm run check            # registry/docs consistency for the textbook
npm run ci               # lint + test + build (what CI runs)
```

## Releasing a widget to production

A widget can land on `dev` and ship to staging without ever being visible on the production site. **Production only shows widgets that explicitly mark themselves done.** This is automatic — no central registry to update.

To mark a widget ready for prod, add **one line** near the top of its module:

```js
// modules/bits-and-gates/BitInterpreter.js
import { escapeAttr } from '../../util/html.js';

export const STATUS = 'done';   // ← add this

export class BitInterpreter { ... }
```

That's it. The next build picks it up:
- Vite scans `modules/**/*.js` at build time, finds the `STATUS = 'done'` exports, and embeds the manifest into the bundle.
- `DynamicContent.js` reads the manifest at runtime and filters the menu.
- On staging (`VITE_ENVIRONMENT=development`) — every widget is visible regardless of STATUS.
- On prod (`VITE_ENVIRONMENT=production`) — only `STATUS = 'done'` widgets show up.

### Lifecycle

| State | What it looks like | Where it shows |
|---|---|---|
| **wip** (default) | no STATUS export, or `STATUS = 'wip'` | local dev + staging only |
| **done** | `export const STATUS = 'done';` | local dev + staging + prod |
| **archived** | `export const STATUS = 'archived';` | hidden everywhere — kept in source for legacy permalinks |

### The promotion PR

Releasing a widget = a tiny PR that flips `STATUS = 'wip'` to `STATUS = 'done'` (or adds the line for the first time). It follows the normal flow:

```
feat/release-bitinterp ──PR──► dev   (CI + 2 reviews)
                                │
                                └─► merge ──► staging deploy (no visible change there)
                  dev ──PR──► main   (CI + 1 review)
                                │
                                └─► merge ──► PROD deploy ──► widget appears in prod menu
```

This means a widget appears in prod the moment its release PR lands on `main`. No manual step.

## Where to put code

| Doing... | Goes in... |
|---|---|
| Adding a new widget | `modules/<category>/YourWidget.js` + register it in `src/registry.js` + add `modules/docs/instructions/<id>.md` and `modules/docs/help/<id>.md` |
| Adding shared utilities | `util/` |
| Auth or app-shell logic | `src/` |
| New marketing pages | A new `<page>.html` at the root + entry in `vite.config.js` |
| Server-only logic | `functions/` (Cloud Functions) |
| Tests | next to the file under test, named `<name>.test.js` |

## Writing a test

Tests run in `happy-dom` (a fast, lightweight browser environment). All Vitest globals (`describe`, `it`, `expect`, etc.) are available without imports. From `util/html.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { escapeHtml } from './html.js';

describe('escapeHtml', () => {
  it('escapes <, >, &, and "', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});
```

Place the file next to the module. Run `npm test` to execute.

## Code style

- **Prettier owns formatting.** Don't argue with it; run `npm run format` and move on.
- **ESLint owns correctness.** If it warns, look — it's catching real bugs more often than it isn't.
- **Names matter.** Pick a name that makes the comment unnecessary.
- **Don't add comments that restate the code.** Add comments for **why** something is the way it is when "why" is non-obvious.

## When you get stuck

1. Re-read [ARCHITECTURE.md](./ARCHITECTURE.md) — it explains why pieces are arranged this way.
2. Look for an existing similar widget and copy its shape.
3. Ask. Don't burn three hours.
