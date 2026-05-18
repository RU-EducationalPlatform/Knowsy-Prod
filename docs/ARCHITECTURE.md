# Knowsy — Architecture

A short, opinionated map of how the pieces fit and **why** each piece is the way it is. If you change one of the boxes, update this doc.

## Goals

1. **Free to run.** Stays on every vendor's free tier at small/medium scale.
2. **Scales horizontally.** Adding the 100,000th student should not require code changes — only flipping a quota.
3. **Student-friendly.** Plain JavaScript, ES modules, minimal build magic. Anyone with a browser and `npm` can contribute.
4. **Deployable in one command.** `npm run deploy`.

## Stack at a glance

```
                  ┌─────────────────────────────┐
   Browser  ◄────►│  Firebase Hosting (CDN)     │     (free, global edge)
                  └──────────────┬──────────────┘
                                 │ static files (Vite build)
                                 ▼
                  ┌─────────────────────────────┐
                  │  /         Knowsy landing   │
                  │  /login.html                │
                  │  /DynamicContent.html → app │
                  │  /modules/<category>/*.js (widgets) │
                  │  /modules/docs/**/*.md (lessons)│
                  └─────────────────────────────┘

   Browser  ────► Firebase Authentication        (free tier: unlimited users)
                       Google · Apple · SAML (Rutgers) · Email/password

   Browser  ────► Firestore                       (free tier: 1 GB, 50k reads/day)
                       per-user state, cohort docs, progress

   Browser  ────► Firebase Cloud Functions        (free: 125k invocations/mo)
                       any logic that can't run on the client safely
```

## Why each piece

| Layer | Choice | Why this, free? scales? |
|---|---|---|
| Bundler / dev server | **Vite** | Zero-config ESM, instant HMR, tiny prod build. Free, MIT. |
| Hosting | **Firebase Hosting** | Static + global CDN. Free for 10 GB transfer/month, 1 GB storage. Custom domains free. |
| Auth | **Firebase Auth** | Google, Apple, SAML providers. Free unlimited users on Spark plan. |
| Database | **Firestore** | Realtime, scales to millions of docs, security rules instead of a backend. Free tier covers small classes. |
| Server logic | **Cloud Functions** | Only when needed (sending email, calling third-party APIs, secrets). Free 125k inv/mo. |
| CI / CD | **GitHub Actions** | Free for public repos; 2,000 min/mo free for private. |
| Tests | **Vitest + happy-dom** | Same engine as Vite. Fast. Free. |
| Lint / format | **ESLint + Prettier** | Standard. Free. |

Anything we'd add later (analytics, error reporting, queues) has a free tier we should pick before paying.

## Data model

```
users/{uid}                       # one doc per signed-in user
  email, displayName, createdAt, role: "student" | "teacher" | "admin"

users/{uid}/progress/{lessonId}   # per-user, per-lesson state
  status: "started" | "complete"
  score, attempts, updatedAt

classes/{classId}                 # a teacher-owned class
  teacherUid, name, courseCode, term, moduleIds:[]
classes/{classId}/members/{uid}   # roster (server-side written via joinClassByCode)

classes/{classId}/announcements/{aid}    # teacher → class (banner-style)
classes/{classId}/messages/{mid}         # text chat (any member, 4 KB cap)

classes/{classId}/availability/{slotId}  # bookable office-hours slots
classes/{classId}/bookings/{bid}         # student-claimed slots; syncs to GCal

classes/{classId}/broadcasts/active      # singleton pointer to current live session
classes/{classId}/broadcasts/{sessionId} # per-session metadata
classes/{classId}/broadcasts/{sessionId}/chunks/{idx}  # WebM segment index
  url, sizeBytes, startMs, durationMs, isInit

classes/{classId}/assignments/{aid}      # authored against modules in class.moduleIds
classes/{classId}/assignments/{aid}/rubricVersions/{v}
classes/{classId}/assignments/{aid}/submissions/{uid}
classes/{classId}/assignments/{aid}/submissions/{uid}/peerReviews/{reviewerUid}

teachers/{uid}                    # private settings (GCal refresh token, channelId)
classCodes/{code}                 # admin-only; resolves a join code → classId
teacherEmails/{email}             # admin allowlist for role assignment
lessons/{lessonId}                # public lesson metadata
```

Membership shortcut: the user's list of class IDs lives on their Firebase ID-token custom claim as `classes:[…]` (cap 50). Rules check `classId in request.auth.token.classes` instead of `exists()` per query — saves a Firestore read on every chat message + announcement read.

Security rules summary (see `firestore.rules`):
- `users/{uid}` readable + writable only by that user; `role` field is server-only.
- `classes/{c}` readable by members + teacher; writable only by class teacher; `moduleIds` controls which modules can be authored against (assignment writes are rejected if `moduleId` isn't listed).
- `classes/{c}/messages` writable by any member as themselves (4 KB cap, 5-min author-retract window).
- `classes/{c}/broadcasts/{sid}/chunks` are append-only by the class teacher; cleanup is admin-SDK only.
- `classes/{c}/assignments/{a}/submissions/{uid}` writable only by uid; teachers grade via callables.
- `teachers/{uid}` and `classCodes/{code}` are admin-SDK only.
- Deprecated: `cohorts/*` is locked down post-migration (see `infra/scripts/migrate-cohorts-to-classes.mjs`).

## Scaling levers (when we hit limits)

| Symptom | Lever |
|---|---|
| Hosting bandwidth exceeded | Move heavy assets (images, video) to Cloud Storage with public CDN; static JS/CSS stays on Hosting. |
| Firestore reads spike | Add denormalized counters / cached aggregates updated by Functions. |
| Auth abuse | Enable Firebase App Check (free) — blocks non-app traffic. |
| Geographic latency | Hosting is already global; Firestore can have multi-region replicas (paid). |
| Cold-start on Functions | Stay on small per-function logic; or switch to Cloud Run (paid) for sustained load. |

## What is **not** here on purpose

- **No backend server.** We rely on Firestore + security rules + Cloud Functions (only where required). One fewer thing to deploy / patch.
- **No bundled SPA framework.** Each widget is a self-contained ES module. Easier for new contributors to drop one in.
- **No global state library.** Per-widget state + Firestore for shared state. Simpler than Redux for the scale we're at.
- **No TypeScript (yet).** Plain JS keeps the barrier to entry low for undergrad contributors. We can add `// @ts-check` per file when it earns its keep.

## Deploy environments

- **Production** (`main` branch) → `knowsy` Firebase project (the user-facing site).
- **Development / staging** (`dev` branch) → a separate Firebase project (same code, isolated data).
- **PR previews** — each PR auto-deploys to a temporary Firebase Hosting channel that expires in 7 days.

The two projects are completely isolated: separate Firestore data, separate Auth user pools, separate domains. Exploding dev never affects prod.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the workflow.
