# Knowsy — Interactive Textbook

## The two commands you'll actually use

```sh
npm run dev       # local development → http://localhost:5173
npm run deploy    # build + push to Firebase Hosting (production)
```

Everything else is in service of those two. The full table is at the bottom of this file.

## First-time setup

```sh
npm install                          # one-time
cp .env.example .env                 # paste your Firebase web-app config
# (optional, for `npm run deploy`)
npm install -g firebase-tools
firebase login
# point .firebaserc at your Firebase project IDs (default = prod)
```

## Running the demo on Linux (Pop!_OS / Ubuntu / Debian)

You don't need a real Firebase project. The demo runs entirely against
local emulators, with two pre-seeded users (teacher + student) and two
starter classes.

**One-time install** (copy-paste each block):

```sh
# 1. System packages (Node + Java + Git)
sudo apt update
sudo apt install -y curl git openjdk-21-jre-headless

# 2. Node.js 20 LTS via NodeSource (apt's default is older)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Clone + install deps
git clone -b dev git@github.com:RU-ECE/Knowsy.git
cd Knowsy
npm install
( cd infra/functions && npm install )
```

If `git clone` over SSH fails, use HTTPS instead:
`git clone -b dev https://github.com/RU-ECE/Knowsy.git`.

**Daily use** — two terminals, each with one command:

```sh
# Terminal 1 — Firebase emulators + auto-seed (first run downloads
# the emulator jars, ~200 MB; subsequent runs are instant).
npm run dev:emu

# Terminal 2 — Vite dev server (the website itself)
npm run dev:web
```

Then open <http://localhost:5173/login.html> and sign in with one of:

| Role    | Email          | Password      |
|---------|----------------|---------------|
| Teacher | `dov@test.com` | `knowsy2026`  |
| Student | `ava@test.com` | `knowsy2026`  |

Class join codes: **CPP224** (ECE 224) · **LOG332** (ECE 332).

`Ctrl-C` in the emulator terminal cleanly exits — the script exports
state to `./emulator-seed/` so the next run restores everything.

If something gets wedged, `npm run dev:emu:clean` kills any stale
emulator processes, wipes the seed dir, and starts completely fresh.

## Pages

**Public / shell**
- `/` — Knowsy landing
- `/login.html` — sign in (Google / Apple / Rutgers SSO / email + password)
- `/app.html` — post-login catalog
- `/DynamicContent.html` — legacy textbook launcher (auth-gated)
- `/calibrate.html` — color-vision calibration gate
- `/health.html` — uptime probe (point external monitors here)
- `/profile.html` — editorial student profile page

**Class platform** (all auth-gated; described in detail below)
- `/class-roster.html` — teacher: list/create/adopt classes
- `/class-join.html` — student: enter a 6-char code to enroll
- `/class-hub.html?c=<id>` — per-class tabs: Announcements · Chat · Calendar · Assignments · Broadcast
- `/assignment-author.html?c=<id>` — teacher CMS for authoring an assignment
- `/assignment-runner.html?c=<id>&a=<id>` — student opens an assignment
- `/assignment-grader.html?c=<id>&a=<id>` — teacher reviews submissions
- `/broadcast.html?c=<id>` — live screen-broadcast publisher (teacher) / viewer (student)
- `/app#/c/progress` — teacher dashboard (per-class submission overview)

## Class platform

A class-centric layer on top of the widget catalog. Teachers create or adopt sections, attach modules, post announcements, run a chat, publish calendar events, broadcast their screen, and author/grade assignments. Students join a class with a 6-character code, then see the same surfaces filtered to what their role can do.

### Data model (Firestore)

```
classes/{classId}                              Teacher-owned section.
  teacherUid, name, courseCode, term, moduleIds[], createdAt
  /members/{uid}                               Server-side written; one doc per student.
  /announcements/{aid}                         Teacher posts; markdown body; pinned shows as a class-wide banner.
  /messages/{mid}                              Class chat. Any member writes their own; 4 KB cap; 5-min self-retract.
  /events/{eid}                                Shared calendar. Everyone authors their own events with visibility=public|anonymous.
  /availability/{slotId}                       Legacy office-hours slots (superseded by events.bookable).
  /bookings/{bid}                              Per-student claims; onBookingWrite mirrors to Google Calendar.
  /broadcasts/active                           Singleton pointer to the current live session, if any.
  /broadcasts/{sessionId}                      Per-session metadata (codec, startedAt/endedAt).
    /chunks/{idx}                              Append-only WebM chunk index.
  /assignments/{aid}                           Authored against modules in class.moduleIds; published when ready.
    /rubricVersions/{v}                        Monotonic; bumped by a transactional callable.
    /submissions/{uid}                         Per-student work; autoScore + teacherScore.
      /peerReviews/{reviewerUid}               Post-due-date pairings (if peerReview=true).

teachers/{uid}                                 Admin-SDK only — holds gcalAuth (refreshToken, channelId).
classCodes/{code}                              Admin-SDK only — resolves a join code to a classId.
```

### Cloud Functions (`infra/functions/`)

- `class.js` — `createClass`, `joinClassByCode`, `setClassModules`, `removeMember`. Maintains a 50-class custom-claim cap (`request.auth.token.classes`) so rules can do zero-read membership checks on hot paths.
- `broadcasts.js` — `endBroadcast` callable + `cleanupBroadcastArtifacts` scheduler (every 30 min — reaps sessions >24h old, sweeps orphaned sessions >2h idle).
- `gcal.js` — `gcalConnect`/`gcalDisconnect` (OAuth code exchange), `onBookingWrite` + `onEventWrite` (outbound mirror), `gcalWebhook` (inbound), `gcalRenewChannels` (every 6 days), `claimEventSlot` (transactional bookable claim), `importGcalRange` (bulk import).
- `assignments.js` — `publishAssignment`, `unpublishAssignment`, `bumpRubricVersion` (transactional version bump), `autogradeSubmission` (dispatches to per-module adapters), `assignPeerReviews` (random non-self pairing), `recordTeacherGrade`.
- `gradingAdapters.js` — server-side autograder table: `asm.final-register`, `asm.final-memory`, `bits.kmap-min`, `bits.truth-table`, `writeup.contains`, `writeup.length`. Same signature mirrored client-side at `util/grading/adapters.js` for live score preview.

### Calendar features

Per-class week-view calendar where **every member** (teacher or student) authors their own events. Built vanilla — CSS Grid for the 7-day skeleton, absolutely-positioned event blocks, click-and-drag to create.

- **Visibility per event**: `public` (title + time visible to everyone in the class) or `anonymous` (others see a striped "Blocked" placeholder; author still sees their own title, with a small `anon` chip).
- **Author colors**: hash-based palette so each person's events sit in a stable color.
- **Bookable events**: toggle on, set capacity. Others see a "Book (N/cap)" button; on click `claimEventSlot` runs a Firestore transaction so capacity is honored under concurrent claims. Booking owner = `${eventId}_${studentUid}` so a user can't double-book.
- **Recurring events**: Daily / Weekly with N occurrences. Each occurrence is its own doc linked by `recurringSeriesId`; edits and deletes prompt "this event only" vs "all in series."
- **Calendar sync** (header → "📅 Connect calendar"): provider chooser modal
  - **Google Calendar** — two-way OAuth (real flow once you set up the GCal OAuth client). `onEventWrite` mirrors author events out; `gcalWebhook` mirrors external edits back.
  - **Outlook / Apple** — UI ready, OAuth not wired yet; routes through the `.ics` fallback with platform-specific export instructions.
  - **Generic .ics upload** — vanilla parser in `util/icsParser.js` extracts VEVENT blocks; deduplicated against existing imports by UID. Imports default to `visibility:anonymous` so nothing leaks until the author promotes individual events to Public.

### Assignment authoring CMS

Teachers can only author assignments against modules that are in their class's `moduleIds` (enforced both client-side in the picker and server-side in `firestore.rules` via `moduleIdsContains()`).

- **Vanilla split-pane editor**: title, module dropdown (scoped to allowed modules), due date, points, markdown prompt with MathJax + live preview, peer-review toggle (sliding switch).
- **Rubric editor**: criteria as rows (label, points, kind ∈ {auto, manual, peer}). For `auto` kind, pick an adapter from the per-module manifest at `modules/practice/rubric-manifest.json`.
- **Versioning**: every "Save rubric" call hits `bumpRubricVersion` (transactional, monotonic). Submissions store `rubricVersionUsed` at autograde time so a teacher can regrade against newer rubrics deliberately.
- **Submission flow**: student opens the runner → loads the assignment + current rubric → state-snapshot textarea + writeup field → live score preview → submit → `autogradeSubmission` dispatches to per-module adapters → teacher reviews + records final grade.
- **Per-module adapters** (today): assembler ISA test (final register / memory), bits-and-gates (K-map minimization, truth-table match), writeup (length, contains-phrases). Adding a new module = one entry in `rubric-manifest.json` + one function in `gradingAdapters.js`.

### Teaching dashboard

At `/app#/c/progress` (registry id `progress`, audience teacher). Magazine-style editorial layout — eyebrow `— Fall 2026 · Teaching dashboard`, 48px Instrument Serif headline, lede strip with oversized stat numbers (classes / students enrolled / assignments / submissions in). Then a section per class with an assignment table (Assignment / Module / Due / Submitted / Mean / Grade). Submitted column has a tiny inline progress bar. Past-due dates render in acid red. Click any row → straight to the grader for that assignment.

### Live broadcast (cost-controlled)

Lecture-hall use case (one professor → 200+ students in the room with poor sightlines). **Hard-locked to 300 kbps screen-only, no camera, no audio** (the screen-only fork of the original LiveKit decision — see `docs/ARCHITECTURE.md` for the cost analysis that led here).

- Teacher's browser composites `getDisplayMedia` → MediaRecorder → 2-second WebM chunks → Firebase Storage → Firestore manifest row per chunk.
- Students subscribe to `broadcasts/{sessionId}/chunks`, fetch each as it lands, append to a MediaSource buffer, skip-to-live when buffered >6s ahead.
- Sticky "🔴 LIVE" banner via `util/AnnouncementBanner.js` for any class the student is enrolled in that has an active session.

### Course catalog (instructor adoption)

Pre-seeded course list at `data/course-catalog.json` (ECE 224, 332, 351, 432, 444, 451, 470, 491 + MAT 250 + AE 312). Teacher clicks "Adopt as {name}" → `createClass` callable spins up a class with their name attached, the catalog's `defaultModuleIds` pre-wired, and a fresh 6-character join code. Future plan: scrape WebReg into this same JSON shape.

### Class picker (empty-state UX)

Every page that needs a `?c=<classId>` (class hub, broadcast, assignment author/runner/grader) shows a `ClassPicker` when no class id is in the URL. Cards listing every class the user is in (teaching + enrolled), with role chips and a primary CTA for the empty case: teachers see a giant "Create your first class" button → catalog; students see "Join your first class" → join page.

## Local development with the Firebase emulator

For end-to-end testing without touching real Firebase. One command does everything:

```sh
npm run dev:emu     # Terminal 1 — boots emulator, force-pushes rules, seeds users, persists state
npm run dev:web     # Terminal 2 — Vite dev server with VITE_USE_EMULATORS=1
```

What `dev:emu` does (`infra/scripts/dev.sh`):

1. Creates `./emulator-seed/` if missing and boots with `--import` + `--export-on-exit` so Ctrl-C dumps state and the next run restores it.
2. Waits up to 90s for the auth emulator to come up.
3. Force-pushes the latest `firestore.rules` via the emulator's REST admin API. Firestore's auto-reload occasionally misses changes; this is belt-and-suspenders.
4. Counts users via the identitytoolkit `accounts:query` endpoint. If zero (or `--reseed`), runs `infra/functions/seed-test-users.mjs`.
5. Prints the URLs + login table + class join codes.
6. Traps SIGINT/SIGTERM and forwards to the emulator child so its export-on-exit handler runs.

Flags:
- `npm run dev:emu:reseed` — force re-run the seed (refreshes passwords, recreates seed classes).
- `npm run dev:emu:clean` — `pkill` any zombie emulator processes + wipe `./emulator-seed/` + start fresh.

### Seed test users (`infra/functions/seed-test-users.mjs`)

Idempotent. Creates two users and two starter classes (project `demo-knowsy`):

| Role    | Email           | Password    | Belongs to                           |
|---------|-----------------|-------------|--------------------------------------|
| Teacher | `dov@test.com`  | `knowsy2026`| ECE 224, ECE 332 (as teacher)        |
| Student | `ava@test.com`  | `knowsy2026`| ECE 224, ECE 332 (as student)        |

Join codes: **CPP224** (ECE 224 — Programming Methodology II), **LOG332** (ECE 332 — Theory and Design of Logic Circuits).

The seed also populates `users/{uid}` with role mirrors and sets the `classes:[…]` custom claim. When Ava signs in, `src/login.js` notices her email matches an entry in `data/demo-users.json` and seeds a rich starter profile (5,480 XP, 45-day streak, 12 past submissions, six pinned post-it notes, enrolled-class list, leaderboard rank #6) into localStorage on first sign-in.

### Firestore rules notes

A few patterns that bit us hard enough to write down:

- **`is list` on null throws "Null value error"** in Firebase rules — even with `&&` short-circuit guards. We removed every `is list` check from `firestore.rules`; the equivalent membership check now goes through `exists(/classes/{c}/members/{uid})`.
- **Collection queries (`list` ops) require static analysis**: any read rule that touches `resource.data.X` will fail with "false for 'list' @ L<n>" the moment a client does `getDocs(query(...))`. The fix everywhere is to split `allow read` into `allow get` (per-doc — can use `resource.data`) and `allow list` (collection query — must be evaluable from the query alone, usually `if isClassMember()` or `if isClassTeacher()`).
- **`||` does NOT catch errors**. If the left side throws, the whole expression throws. Order branches so the cheap, never-throws check comes first.

## Deploy paths

**Day-to-day:** push to `main` and GitHub Actions auto-deploys to production. Push to `dev` for staging. No local `firebase` install needed.

**Manual / emergency:** `npm run deploy` from your laptop. Runs `vite build`, then `firebase deploy --only hosting` against whatever project `.firebaserc` says is `default`.

## Roles (student vs. teacher)

Every signed-in user has a role: `student`, `teacher`, or `admin`. Students never see assignment-creation tools (Author, Progress dashboard) — those widgets are filtered out of the catalog client-side, and the underlying APIs are blocked by Firestore rules so a student can't bypass the filter.

**How a role is assigned (automatic, server-side):**

1. **Default** — every brand-new account is `student`.
2. **Email allowlist** — if the user's email is listed in the Firestore `teacherEmails/{email}` collection, the `assignRoleOnCreate` Cloud Function flips them to `teacher`. Works for every auth method (Google, Apple, Rutgers SAML, email/password).
3. **Rutgers SAML affiliation** — once Identity Platform is enabled, a `beforeSignIn` blocking function reads `eduPersonAffiliation` from the SAML claims and auto-promotes `faculty`/`staff`. Plumbing for this is in `infra/functions/role.js`; it activates as soon as you upgrade the Auth tier and configure the SAML provider.

**Promote a teacher manually:**
```sh
bash infra/scripts/add-teacher.sh someone@rutgers.edu
```
The user's role flips on their next sign-in (or within ~10 seconds of a token refresh if they're already signed in — the catalog re-renders to show teacher tools without a manual reload).

**Demote:**
```sh
firebase firestore:delete teacherEmails/someone@rutgers.edu
```
The `refreshRoleOnAllowlistChange` function picks up the deletion and resets that user's role to `student`.

**Admins** are set manually:
```sh
firebase functions:shell
> getAuth().setCustomUserClaims('<uid>', { role: 'admin' })
```

## Auth setup

In the Firebase Console (https://console.firebase.google.com):
1. **Authentication → Sign-in method**: enable Google. Optionally enable Apple (requires Apple Developer membership).
2. **Authentication → Settings → Authorized domains**: add `localhost` and your production domain.
3. **Rutgers SSO** is wired as a SAML provider with ID `saml.rutgers`. This requires the Firebase Identity Platform tier (paid) and a SAML registration with Rutgers OIT (Shibboleth IdP at `https://shib.rutgers.edu/idp/shibboleth`). Until that's set up, the Rutgers button shows a clean error and won't crash.

## Goals

This project is designed to achieve three major goals 

1. to test the limits of AI-Assisted programming. We rapidly create many modules at high speed. We can see where the AI helps a lot, accelerating 
the development process dramatically, and where it cannot.
    - This is a testbed for a number of research questions:
        1. How much does the experience of the programmer prompting the AI matter? If we have a good procedure, can inexperienced programmers achieve the same results?
        2. Do different programming areas have different degrees of improvement?
        3. Are there techniques to improve the results from AI?
        4. Does AI drop the cost of software development so much that we can achieve results that would have previously been impossible?
        5. What impact could a potential drop in cost have on society?

2. To give professors a chance to do rapid application development to collectively build a large set of educational objects useful in specific courses.
   Specifically we have a team of professors focused on generating visual objects for:
   - Dov Kruger:    Digital Logic Design, computer architecture, assembler programming, parallel and distributed computing, algorithms, graphics
   - Maria Striki:  Computer architecture
   - Yulia Kumar:   Quantum, Machine Language

3. Teach undergraduate students how to develop with AI, and give them tasks that they can readily achieve, while giving them strategies to debug problems
as well as give them a concrete project.

## Repository layout

```
modules/                        Widgets + future modules, by category
├── bits-and-gates/             Bit interpreter, Boolean algebra, K-maps, ECC, Verilog
├── assembler/                  x86, ARM64, RISC-V, LC-3 simulators
├── programming/                C++ exec & optimization visualizer
├── electronics/                Circuit diagram builder
├── chemistry/                  Periodic table
├── materials/                  Semiconductor structure
├── rf/                         Antennas, Smith chart
├── data-structures/            Rope, trees
├── mechanics/                  2D static equilibrium
├── geography/                  Map projections
├── graphics/                   GLSL shader playground
├── reference/                  Memory layouts, command refs
├── tools/                      Git/GitHub visualizer
├── practice/                   Teaching dashboard (ProgressApp), assignment CMS (Author/Runner/Grader)
├── screening-tests/            Color vision, trebuchet, graph/tree labs
├── classes/                    ClassRoster · ClassJoin · ClassHub · ClassPicker
├── calendar/                   CalendarView (week view, events, bookable, recurring, GCal sync)
├── announcements/              Per-class announcements board (markdown + pinned banner)
├── chat/                       Per-class text chat (Firestore live listener, monogram avatars)
├── broadcast/                  BroadcastPublisher (300 kbps screen) + BroadcastViewer (MSE)
├── quantum-c/                  Placeholder for future quantum-computing widgets
├── skill-graph/                Future skill-graph + curriculum mapping module
├── docs/                       Per-widget instructions/<id>.md and help/<id>.md
└── legacy/                     Superseded code, kept for reference

infra/                          Deployment + admin
├── functions/                  Firebase Cloud Functions (deployed via firebase.json)
│   ├── class.js                createClass/joinClassByCode/setClassModules/removeMember
│   ├── broadcasts.js           endBroadcast + cleanupBroadcastArtifacts (scheduler)
│   ├── gcal.js                 GCal OAuth + booking/event mirrors + import callable
│   ├── assignments.js          publish/unpublish/bumpRubricVersion/autograde/peerReviews/grade
│   ├── gradingAdapters.js      Server-side autograder dispatch table
│   ├── seed-test-users.mjs     Idempotent emulator seed (Dov + Ava + ECE 224/332)
│   └── role.js, backup.js, index.js
├── canvas-tool/                Canvas LTI integration
├── scripts/                    dev.sh (one-command emulator), add-teacher.sh, branch protection
└── asm-reference/              Reference x86 .s file (not executed)

assets/                         Static assets served at /assets/*
├── knowsy.css                  Editorial Academia design system + components
├── textbook.css                Legacy launcher styles
└── user-avatar.svg             Default avatar

docs/                           Project documentation
├── ARCHITECTURE.md             System design, scalability, free-tier breakdown
├── CONTRIBUTING.md             Branch workflow, PR rules, testing conventions
└── styles.md                   CSS class-naming conventions

src/                            Bundled application code (Vite-processed)
├── auth.js, firebase.js, observability.js
├── app-shell.js, registry.js
└── landing.js / login.js / app.js / calibrate.js / health.js  (one per page)

util/                           Shared runtime utilities (used by widgets)
├── html.js                     escapeHtml + escapeAttr (must be on every interpolation)
├── ErrorOverlay.js             window.onerror toast
├── Assembler.js, CodeView.js, Graph.js, BTree.js, RedBlackTree.js
├── Permalink.js, Persist.js, InteractiveComponent.js
└── learn/                      Assessment/XP/badge engine

data/                           Static assets served at /data/* (e.g. colorblind plates)
vendor/                         Pinned third-party libs (marked, DOMPurify, d3, three)
*.html                          Entry pages — Vite multi-page setup expects them at root
*.css, *.js                     Top-level stylesheets + the legacy launcher
```

## All npm scripts

| Command | When you'd use it |
|---|---|
| `npm run dev` | Daily local development. Hot reload, Vite dev server (talks to whatever Firebase project `.env` points at). |
| `npm run dev:web` | Vite dev server with `VITE_USE_EMULATORS=1` baked in — for emulator-based testing. |
| `npm run dev:emu` | Boot the Firebase emulator suite with persistence + force-push latest rules + seed if empty. |
| `npm run dev:emu:reseed` | Same as above, force re-run the seed (refreshes test users + classes). |
| `npm run dev:emu:clean` | Kill zombie emulator processes, wipe `./emulator-seed/`, start completely fresh. |
| `npm run seed` | Just run the seed script against an already-running emulator. |
| `npm run deploy` | Manual production deploy. Builds + pushes to Firebase Hosting. |
| `npm run build` | Produce `dist/` without deploying (CI uses this). |
| `npm run preview` | Serve the prod build locally to sanity-check before deploy. |
| `npm test` | Run unit tests once. |
| `npm run test:watch` | Tests, rerun on save. |
| `npm run lint` | ESLint check. |
| `npm run format` | Prettier — write formatting fixes. |
| `npm run ci` | What CI runs: lint + test + build. Run before pushing. |

