# CSS audit — factoring plan (May 2026)

For review with Satrajit. **No modules migrated yet.**

## Scale today

| Bucket | Lines (approx.) | Files |
|--------|-----------------|-------|
| Core | 9,700 | `textbook.css` (6,762), `knowsy.css` (2,796) |
| Module overlays | ~28,400 | 35 × `assets/*.css` |
| Modules dir | ~2,400 | ProgressApp, ShaderToy, GitLab, AuthorApp |
| **Proposed shared UI** | **~680** | `assets/ui/*.css` (4 files + import) |

Most module files repeat the same bench, banner, button, and label patterns with different prefixes (`pde-`, `lte-`, `iov-`, `seg-`, `aa-`).

## Duplication found (representative)

| Pattern | Copies seen in | Should become |
|---------|----------------|---------------|
| 3-column bench grid + 1100px stack | `probability-explorer`, `linear-transformation-explorer` | `ui-layout-bench` |
| Hero + stats strip | `aarch64`, `integer-overflow`, `trebuchet`, … | `ui-layout-lesson` / `text-stat-*` |
| Chapter banner + picker | `aa-*`, `iov-*`, `fpx-*` | `ui-layout-lesson__banner*` |
| Mono uppercase labels | almost every lab CSS | `text-label` |
| Primary/ghost buttons | PDE, LTE, DE, … | `ui-btn`, `ui-btn--primary` |
| `.changed` register highlight | `textbook.css`, `aarch64.css` | `state-just-changed` + token |
| `max-width: none` page hacks | PDE, LTE per `data-screen-label` | `ui-page[data-ui-width=full]` |
| Hamburger menu panel | LTE (new), should be shared | `ui-menu-*` |

## What stays in `textbook.css` (for now)

- Launcher shell (`app-*`)
- Assembler internals (`asm-*`, memory grid, AVX layout) until a dedicated pass
- Legacy module blocks already merged into textbook (ecc, kmap, balab, …)

Shrinking `textbook.css` is a **later** phase; first win is **stop growing** per-module files.

## Proposed bundle (`assets/ui/`)

| File | Lines | Contents |
|------|-------|----------|
| `tokens.css` | ~95 | Theme bridge, semantic colors, color-vision, viz vars |
| `type.css` | ~130 | `text-*`, `state-*`, `.changed` bridge |
| `controls.css` | ~230 | Buttons, fields, menu, overlays |
| `layouts.css` | ~230 | 5 layouts + panel primitive |
| **Total** | **~685** | Under 1k target |

## Layout map (5, not 500)

| Layout | Current examples |
|--------|------------------|
| `bench` | Probability explorer, Linear Transformation Explorer |
| `assembler` | x86, AArch64, LC-3, RISC-V |
| `scene` | Trebuchet, solar system, structural systems, antenna pattern |
| `editorial` | Differential equations, parts of health/reference |
| `lesson` | Integer overflow, floating point, AArch64 chapter flow |

## Per-file migration notes

| File | Lines | Likely layout | Notes |
|------|-------|---------------|-------|
| `linear-transformation-explorer.css` | 379 | bench | Delete after LTE migrates |
| `probability-explorer.css` | 269 | bench | Near drop-in |
| `aarch64.css` | 2,901 | lesson + assembler | Split: banner → lesson; sim → assembler |
| `integer-overflow.css` | 1,301 | lesson | Heavy overlap with aa-* |
| `floating-point.css` | 1,611 | lesson | Same |
| `trebuchet.css` | 595 | scene | |
| `solar-system.css` | 669 | scene | |
| `differential-equations.css` | 511 | editorial | |
| `diagram-builder.css` | 747 | bench or custom | May need 6th “diagram” later — still shared |
| `textbook.css` | 6,762 | — | Do not merge wholesale; peel duplicates as modules move |

Files under ~200 lines often mix a few overrides — fold into `ui` + delete.

## Review checklist for Satrajit

1. Agree on 5 layout names and `data-ui-width` full vs content.
2. Agree on `text-*` / `state-*` vocabulary (especially `state-just-changed` vs `.changed`).
3. Color-vision: `data-color-vision` values OK? (Okabe–Ito–style remaps in tokens.)
4. Keep `knowsy.css` + `textbook.css` during transition?
5. First pilot module after approval: **LTE** or **PDE**?

## Deliverables in this PR (documentation + CSS only)

- `assets/ui/tokens.css`, `type.css`, `controls.css`, `layouts.css`, `ui.css`
- `docs/ui-markup.md` — author/agent markup guide
- `docs/ui-css-audit.md` — this file

No HTML/JS changes until you approve.
