# Task 02 — ModalContainer component

## Goal
Create a reusable `ModalContainer.svelte` component that renders a centered modal dialog with a backdrop.

## Acceptance criteria
- [x] Renders a semi-transparent backdrop covering the full viewport
- [x] Centered card (max-width ~700px, scrollable body)
- [x] Accepts `open: boolean` bindable prop; renders nothing when false
- [x] Accepts `title` snippet for the header area
- [x] Accepts `children` snippet for the body area
- [x] Has an `×` close button in the top-right of the header
- [x] Closes on Escape key press
- [x] Closes on backdrop click (clicking outside the card)
- [x] Uses existing CSS design tokens (shadow, border-radius, background)
- [x] Body area has `overflow-y: auto` to handle long content

## Architecture notes
- Use Svelte's `{#if open}` to conditionally mount/unmount
- Keyboard listener: `on:keydown` on `window` when open
- Backdrop click: separate `<div class="backdrop">` element underneath the card
- File: `src/lib/components/ModalContainer.svelte`

## Related tasks
- Used by Task 06 (comments modal)
