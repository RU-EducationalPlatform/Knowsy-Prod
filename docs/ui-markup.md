# UI markup guide (proposed)

For review with Satrajit. **Not yet wired into production pages.** Existing modules keep their CSS until migrated one by one.

## Goals

- One vocabulary for text, state, controls, and ~5 layouts — not hundreds of module prefixes (`pde-*`, `lte-*`, `iov-*`).
- Light / dark via `body[data-theme]`, color-vision variants via `body[data-color-vision]`.
- Full-window labs by default (`data-ui-width="full"`).
- Projector-friendly controls (`--control-font-size` / `--ui-size-control`).

## Stylesheet bundle

| File | Role |
|------|------|
| `assets/knowsy.css` | Editorial palette (`--paper`, `--ink`, …) — keep for now |
| `assets/textbook.css` | Launcher + assembler rules — shrink over time |
| `assets/ui/ui.css` | Imports `tokens`, `type`, `controls`, `layouts` |

```html
<link rel="stylesheet" href="./assets/knowsy.css" />
<link rel="stylesheet" href="./assets/textbook.css" />
<link rel="stylesheet" href="./assets/ui/ui.css" />
```

```html
<body data-theme="light" data-color-vision="default">
```

## Layout families (pick one)

Set on the page root:

```html
<div class="ui-page" data-ui-layout="bench" data-ui-width="full">
  <div id="module-root" class="ui-page__mount"></div>
</div>
```

| `data-ui-layout` | Use when | Examples |
|------------------|----------|------------|
| `bench` | Left controls, center canvas/SVG, right readout | Probability explorer, Linear Transformation Explorer |
| `assembler` | Toolbar + code + registers/memory | x86, AArch64, LC-3 |
| `scene` | Thin chrome, large 2D/3D viewport | Trebuchet, solar system, structural |
| `editorial` | Hero, prose, embedded widgets | Differential equations (parts) |
| `lesson` | Chapter banner + stepped lesson + bench/rail | Integer overflow, floating point, AArch64 chapters |

### Bench layout skeleton

```html
<div class="ui-page" data-ui-layout="bench" data-ui-width="full">
  <div class="ui-layout-bench">
    <aside class="ui-layout-bench__left">
      <div class="ui-layout-bench__left-top">
        <div class="ui-menu-anchor"><!-- hamburger --></div>
        <span class="ui-pill text-label">Mode name</span>
      </div>
      <p class="ui-section-title">Animation</p>
      <div class="ui-btn-row">
        <button type="button" class="ui-btn ui-btn--primary">Play</button>
        <button type="button" class="ui-btn">Pause</button>
      </div>
      <label class="ui-field">
        <span class="text-label">Matrix size</span>
        <select class="ui-select">…</select>
      </label>
    </aside>
    <main class="ui-layout-bench__center">
      <div class="ui-layout-bench__stage">
        <canvas class="ui-layout-bench__canvas"></canvas>
        <div class="ui-overlay-readout"></div>
        <div class="ui-overlay-caption"></div>
      </div>
    </main>
    <aside class="ui-layout-bench__right">
      <p class="ui-section-title">Readout</p>
      <pre class="ui-panel__readout text-readout"></pre>
      <div class="text-explain"></div>
    </aside>
  </div>
</div>
```


## Text semantics

Use **role classes**, not module names.

| Class | When |
|-------|------|
| `text-body` | Default UI prose in panels |
| `text-serif` / `text-lead` | Editorial hero, subtitles |
| `text-label` | Uppercase mono field labels |
| `text-caption` | Secondary hints |
| `text-code` | Inline `code`, register names, mnemonics |
| `text-code-block` | `pre` dumps |
| `text-readout` | Monospace columnar values (matrices, hex) |
| `text-explain` | Left-border explanation blurb |
| `text-stat-value` / `text-stat-label` | Toolbar stat strips |

### State (values that change)

| Class | When |
|-------|------|
| `state-normal` | Default |
| `state-muted` | De-emphasized |
| `state-just-changed` | Persistent highlight after update (register, matrix cell) |
| `state-flash-changed` | Short animation on discrete change |
| `state-selected` | List/menu selection |
| `state-error` / `state-success` | Validation, run status |

**Migration:** existing `.changed` on assembler registers maps to the same token surface as `state-just-changed`.

## Controls

| Class | Element |
|-------|---------|
| `ui-btn` | `<button>` |
| `ui-btn--primary` | Primary action |
| `ui-btn--ghost` | Low emphasis |
| `ui-btn-row` | Horizontal group |
| `ui-field` + `text-label` | Labelled control |
| `ui-input` / `ui-select` | Inputs |
| `ui-check` | Checkbox row |
| `ui-range` | Slider row |
| `ui-menu-*` | Hamburger menu (see `ModuleHamburgerMenu`) |
| `ui-stat-strip` + `ui-stat` | Header metrics |

Do **not** add `lte-btn`, `pde-btn`, etc. on new work.

## Canvas / WebGL colors

Read tokens from CSS in JS:

```js
const root = getComputedStyle(document.documentElement);
const grid = root.getPropertyValue('--ui-viz-grid').trim();
```

Do not hardcode `#c8102e` in drawing code.

## What not to do

- No new `assets/<module-name>.css` without team approval.
- No `innerHTML` `<style>` blocks.
- No layout rules keyed by `data-screen-label='Module Name'` — use `data-ui-layout` only.
- No duplicate bench grid in per-module files.

## Migration order (suggested, after approval)

1. **Linear Transformation Explorer** — already bench-shaped; delete `linear-transformation-explorer.css` when done.
2. **Probability explorer** — nearly identical to bench skeleton.
3. **Integer overflow / floating point** — map `iov-*` / `fpx-*` banner → `ui-layout-lesson`.
4. **Assembler pages** — wrap existing `assembler-layout` in `ui-layout-assembler`; move `.changed` to tokens only.
5. **Scene labs** — trebuchet, solar system → `ui-layout-scene`.

## Agent instruction (paste into Cursor rules)

> New interactive modules: link `knowsy.css` + `ui/ui.css` only. Use `ui-page`, one `data-ui-layout`, and shared `text-*` / `ui-*` classes per `docs/ui-markup.md`. Do not create module-specific CSS files.
