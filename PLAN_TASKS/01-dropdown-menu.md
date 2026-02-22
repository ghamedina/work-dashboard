# Task 01 — DropdownMenu component

## Goal
Create a reusable `DropdownMenu.svelte` component that renders a positioned overlay list below an anchor element.

## Acceptance criteria
- [x] Renders a `<ul>` absolutely positioned directly below the anchor element
- [x] Accepts `items: { label: string; value: string }[]` prop
- [x] Accepts `open: boolean` bindable prop
- [x] Accepts `onSelect: (value: string) => void` callback
- [x] Accepts optional `maxItems?: number` (default 10); list scrolls if items exceed this
- [x] Closes on outside click (click outside the list)
- [x] Closes on Escape key press
- [x] Highlighted item on hover
- [x] Uses existing CSS design tokens (border, border-radius, shadow, background)
- [x] Positioned via CSS (`position: absolute`) relative to the nearest positioned parent — caller must ensure wrapper has `position: relative`

## Architecture notes
- Anchor positioning: the component itself does not accept an anchor element ref — instead, it expects to be placed in a wrapper with `position: relative` and will position itself via `top: 100%; left: 0`
- Outside click detection: use a Svelte action or `on:click` on `window` with `capture: true`
- File: `src/lib/components/DropdownMenu.svelte`

## Related tasks
- Used by Task 04 (combo-box) and Task 08 (Jira status picker)
