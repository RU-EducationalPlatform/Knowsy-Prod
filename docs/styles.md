# Style System

> **Proposed shared UI (review):** `assets/ui/ui.css`, `docs/ui-markup.md`, `docs/ui-css-audit.md`.  
> Not yet adopted by live modules. Until migration, rules below still apply.

This project uses one shared stylesheet: `textbook.css`.

## Theme Support

Theme selection is client-side and does not require a server.

- Theme state uses `body[data-theme='<theme>']`
- Current themes:
  - `light`
  - `dark`
- Launcher stores selected theme in `localStorage` key `textbook-theme`

## Standard Class Names

Use these names across all plugins/modules.

### App shell / launcher

- `app-body`
- `app-shell`
- `app-toolbar`
- `app-component-target`

### Assembler module

- `assembler-layout`
- `asm-outer-box`
- `asm-app-toolbar`
- `asm-main-column`
- `asm-code-vec-row` / `asm-code-vec-row--split` / `asm-right-half` / `asm-vector-panel`
- `asm-code-input`
- `controls`
- `asm-program-select`
- `asm-reg-panel`
- `asm-toolbar-flags` / `asm-toolbar-extra` / `asm-toolbar-halt`
- `asm-registers`
- `asm-reg-grid`
- `asm-reg-item`
- `asm-reg-hex`
- `asm-memory`

State/variant classes:

- `two-col` (for `asm-reg-grid`)
- `changed` (for `asm-reg-hex`)

### Antenna module

- `antenna-lab`
- `antenna-controls`
- `antenna-control`
- `antenna-value`
- `antenna-panes`
- `antenna-svg`
- `antenna-summary`

### Diagram tool module

- `diagram-tool`
- `diagram-left`
- `diagram-center`
- `diagram-right`
- `diagram-toolbar`
- `diagram-challenge`
- `diagram-tool-item`
- `diagram-canvas-wrap`
- `diagram-canvas`
- `diagram-wires`
- `diagram-wire`
- `diagram-part`
- `diagram-part-title`
- `diagram-hot-point`
- `diagram-properties`
- `diagram-param-grid`

### Bits interpreter module

- `bits-tool`
- `bits-header`
- `bits-unsupported`
- `bits-table`
- `bits-row`
- `bits-type`
- `bits-input`
- `bits-bits-host`
- `bits-bits-wrap`
- `bits-bit-table`
- `bits-bit-cell` (state: `.on`)

## Conventions

- Keep module-specific styles namespaced (`asm-*`, `antenna-*`, `app-*`).
- Prefer theme variables (`--app-bg`, `--border`, etc.) over hardcoded colors.
- Do not inject `<style>` blocks from JS modules.
- New plugin CSS should reuse existing base classes where practical, then add a namespaced class family.
