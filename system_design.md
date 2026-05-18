# Knowsy — System Design

A plan for turning Knowsy into a dynamic, production-shaped platform — built by
the team, tracked in Linear, deployed for free onto our Google Cloud server.

---

## Repo structure & contribution flow

Three repos, three review gates, and a **Linear issue tracking each job** end
to end.

```
   ┌──────────────────────────────────────────────────────────────────┐
   │  LINEAR  — every feature/fix is an issue (the "job")             │
   │  Backlog → Todo → In Progress → In Review → Integrating →        │
   │            Staging → Done                                        │
   └───────┬──────────────────────────────────────────────────────────┘
           │ issue assigned (e.g. KNO-42)
           ▼
   team member forks  knowsy-templates
           │   branch named after the issue (KNO-42) → Linear auto-links the PR
           │   builds with: module templates · prompting templates · system_design.md
           ▼
   Pull Request → knowsy-templates                  [ Linear: In Progress ]
           │
           ▼  ╔═══════════════════════╗
              ║ REVIEW 1 — code       ║              [ Linear: In Review ]
              ╚═══════════════════════╝
           │  merge (auto-merge on approval + green CI)
           ▼
       ╔═══════════════════════╗
       ║ REVIEW 2 — integration ║                   [ Linear: Integrating ]
       ╚═══════════════════════╝
           │  sync into
           ▼
   ┌─────────────────────────────┐
   │  knowsy                     │   dev = integration
   │  dev ──────────► main       │   main = staging  (main no longer deploys)
   └──────────────┬──────────────┘
           │
           ▼  ╔═══════════════════════╗
              ║ REVIEW 3 — UI / UX    ║              [ Linear: Staging ]
              ╚═══════════════════════╝
           │  promote  (passing Review 3 = "done")
           ▼
   ┌─────────────────────────────┐
   │  knowsy-prod                │   only released features + runtime
   │  (single deploy target)     │   CI builds containers → deploys
   └──────────────┬──────────────┘                   [ Linear: Done ]
                  │
                  ▼  deploys the live platform  ▼▼▼
```

| Repo | Contents | Gate it owns |
|---|---|---|
| **`knowsy-templates`** | Module templates (+ existing modules to build on), prompting templates, shared libs, build config, `system_design.md` | **Review 1 — code** |
| **`knowsy`** | Full integrated app; `dev` = integration, `main` = staging | **Review 2 — integration** |
| **`knowsy-prod`** | Released features + runtime; the only deploy target | **Review 3 — UI/UX** |

---

## Linear automation — how status moves by itself

The three review gates *are* three Linear state transitions. No one drags
cards; the pipeline moves them.

```
  branch created (kno-42-…)        ─► In Progress     │ native Linear↔GitHub
  PR opened in knowsy-templates    ─► In Review       │ native Linear↔GitHub
  merged into knowsy-templates     ─► Integrating     │ native (configured)
  synced → knowsy/dev → main       ─► Staging         │ custom GH Action
  promoted → knowsy-prod           ─► Done            │ custom GH Action
```

**Native Linear↔GitHub integration** handles everything inside the first repo:
connect Linear to the GitHub org once, name the branch after the issue, and
branch/PR/merge events move the issue automatically.

**The cross-repo hops are custom**, because native automation assumes "one
repo, one merge = done" — which would mark our issue Done at Gate 1. So the
sync and promote workflows each call **Linear's GraphQL API** to advance the
issue:

```yaml
# runs in the templates→dev sync, the dev→main, and the →prod workflows
- name: Advance Linear issue
  run: |
    curl -s https://api.linear.app/graphql \
      -H "Authorization: $LINEAR_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"query":"mutation { issueUpdate(id:\"'"$ISSUE_ID"'\",
            input:{ stateId:\"'"$NEXT_STATE_ID"'\" }) { success } }"}'
  env:
    LINEAR_API_KEY: ${{ secrets.LINEAR_API_KEY }}
```

Three things make it work:

1. **The issue ID travels with the code.** Set once at branch creation
   (`kno-42-…`), then carried through every hop as a commit trailer —
   `Linear-Issue: KNO-42` — which the sync workflows preserve and downstream
   workflows grep to know which issue to advance.
2. **`LINEAR_API_KEY`** as an org-level GitHub Actions secret.
3. **State UUIDs** — fetched once from Linear (`{ workflowStates { id name } }`)
   and referenced in the workflows for `Integrating` / `Staging` / `Done`.

---

## System architecture

The standard production stack — every layer a free, open-source component,
deployed onto our existing Google Cloud VM.

```
                       Web + mobile clients
                               │
                        Cloudflare  (free)
            CDN · DDoS · WAF · DNS · TLS · edge-caches broadcast chunks
                               │
 ┌─────────────── Google Cloud VM  (our existing server) ───────────────┐
 │                                                                      │
 │   Traefik   load balancer · reverse proxy · TLS · routing · WebSocket │
 │      │                                                               │
 │   ┌──┴─────────────── k3s  (lightweight Kubernetes) ──────────────┐   │
 │   │   scheduling · service discovery · self-healing · rollouts    │   │
 │   │                                                               │   │
 │   │   frontend-service     api-gateway   (catalog, classes,       │   │
 │   │                                       calendar, assignments)  │   │
 │   │   solver-service ◄── already built (server/)                  │   │
 │   │   ocr-service ◄── deferred (GPU)                              │   │
 │   │   realtime-service     WebSocket fan-out: chat, announcements, │   │
 │   │                        broadcast signaling + chunk manifest   │   │
 │   │   broadcast-cleanup ◄── k3s CronJob: purges expired chunks    │   │
 │   └───────────────────────────────────────────────────────────────┘   │
 │                                                                      │
 │   Valkey        NATS          PostgreSQL       MinIO                  │
 │   (cache,       (event bus,   (all relational  (broadcast chunks,     │
 │    presence)     new-chunk     state)           uploads, attachments) │
 │                  events)                                             │
 │                                                                      │
 │   Prometheus  +  Grafana  +  Loki    metrics · dashboards · logs      │
 │                                                                      │
 └──────────────────────────────────────────────────────────────────────┘
```

| Standard component | What we use | Free because |
|---|---|---|
| CDN / DDoS / WAF | **Cloudflare** free tier | Genuinely free, unlimited bandwidth |
| Load balancer + reverse proxy | **Traefik** | Open-source; LB + routing + TLS + WebSocket in one |
| Container orchestration | **k3s** | Full Kubernetes, runs on one VM |
| Service discovery | **k3s built-in DNS** | Comes with Kubernetes |
| Scheduled jobs | **k3s CronJob** | Built into Kubernetes |
| Caching / presence | **Valkey** | Open-source Redis fork |
| Message queue / event bus | **NATS** | Lightweight, free |
| Log aggregation / search | **Loki** (+ OpenSearch if needed) | Open-source |
| Metrics & monitoring | **Prometheus + Grafana + Alertmanager** | Canonical free stack |
| Inter-service calls | **gRPC / REST** | Protocols + libraries |
| Database | **PostgreSQL** | Open-source |
| Object storage (S3) | **MinIO** / Cloudflare R2 free | S3-compatible, free |
| Compute host | **Our existing Google Cloud VM** | Already provisioned |
| CI / CD | **GitHub Actions** | Free minutes |
| Project tracking | **Linear** | Free plan covers our team size |
| Auth | **Firebase Auth** (in use) | Free Spark tier |

---

## Real-time & broadcasting

The class platform's live features are the most demanding part of the system,
so they get their own data path.

**Chat & announcements** — `realtime-service` holds WebSocket connections;
messages persist to PostgreSQL and fan out to connected clients. Valkey tracks
presence. Traefik proxies the WebSocket upgrade.

**Lecture-hall broadcasting (300+ students)** — the teacher's browser records
the screen in short chunks; students play them back near-live:

```
  teacher browser ──MediaRecorder──► 2-second WebM chunks
        │                                    │
        │ manifest row                       │ upload
        ▼                                    ▼
  realtime-service ──► PostgreSQL        MinIO  (chunk storage)
        │                                    │
        │ "new chunk" event (NATS → WS)       │ chunk URL
        ▼                                    ▼
  student browsers ◄──── chunks served via Cloudflare edge cache
        (MediaSource Extensions playback, ~3–5s latency)

  broadcast-cleanup (k3s CronJob) ──► deletes chunks past retention
```

The thing that makes broadcasting viable for free: **Cloudflare edge-caches the
chunks.** 300 students pulling the same 2-second chunk = **1 origin fetch + 299
cache hits**, so MinIO and the VM see almost no fan-out load. The CronJob bounds
storage by deleting chunks once a session ends, so it never grows unbounded.

---

## Status

**Deferred:** OlmoOCR2 handwriting OCR needs a GPU — one feature, solved
separately, not a blocker for anything else.

**Already built:** `solver-service` (the `server/` FastAPI + SymPy backend),
the Firebase auth/data backplane, and the CI lint/test/build pipeline.

Everything else — the three-repo pipeline, Linear automation, k3s + Traefik on
the GCloud VM, Valkey/NATS/PostgreSQL/MinIO, the real-time and broadcast data
path, and the monitoring stack — is built together as one rollout.
