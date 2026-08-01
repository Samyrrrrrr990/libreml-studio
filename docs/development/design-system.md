# Design system

Status: implemented for the Research Preview workbench in `apps/web`.

This describes the interface layer: the token vocabulary, the rules component
styles must follow, and the measured accessibility evidence behind the palette.
It exists so that visual decisions are made once and reused, rather than being
re-invented per component.

## Why a token layer

The first workbench stylesheet was a single 2,554-line file. It accumulated:

- 20 distinct font sizes between 7px and 27px,
- 12 font weights (450, 530, 560, 580, 600, 630, 650, 660, 670, 680, 700, 720),
- roughly 30 colour literals declared outside the token block.

Each individual value was defensible; together they meant no two components
agreed on what "small muted label" or "card background" was, and any change
required finding every place a value had been retyped. A scale that admits
every value is not a scale.

## Files

`apps/web/src/styles/` is ordered by dependency. `index.css` imports them in
this sequence and adds nothing itself.

| File | Contains |
| --- | --- |
| `tokens.css` | Every colour, size, duration, and easing. Both themes. |
| `base.css` | Reset, document defaults, focus, scrollbars, reduced motion. |
| `primitives.css` | Buttons, fields, switches, segmented controls, badges, keycaps, empty states. |
| `layout.css` | Application shell, top bar, docked panel geometry. |
| `canvas.css` | React Flow surface, node cards, edges, zoom level of detail. |
| `library.css` | Node catalogue. |
| `inspector.css` | Node inspector. |
| `panels.css` | Bottom artifact panels. |
| `overlays.css` | Dialogs, command palette, toasts. |
| `responsive.css` | Breakpoint overrides and print. |

## Scales

**Type.** Eight sizes, `--text-2xs` (10px) through `--text-2xl` (28px), with a
13px base. The workbench is dense, so the base is smaller than a
document-oriented layout would use.

**Weight.** Four steps: 400, 500, 600, 700. Variable fonts permit 673; the
absence of a reason to use it is why the scale stops at four.

**Space.** A 4px grid, `--space-1` through `--space-10`.

**Shape.** `--radius-sm` (5px), `--radius` (8px), `--radius-lg` (12px),
`--radius-full`. One system, applied consistently.

**Elevation.** Five surfaces, deepest to highest: `--bg-canvas`, `--bg-sunken`,
`--bg-base`, `--bg-surface`, `--bg-raised`. The canvas deliberately sits below
the panels so the workflow reads as the surface being worked on. Shadows are
tinted toward the background hue; a neutral black shadow over warm paper reads
as dirt rather than depth.

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Anything entering or responding to input |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | Movement across the screen |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Drawer and sheet travel |
| `--dur-instant` | 100ms | Press feedback |
| `--dur-fast` | 140ms | Hover, colour, small state changes |
| `--dur-base` | 180ms | Popovers, progress |
| `--dur-slow` | 240ms | Dialogs, drawers, toasts |

Rules that follow from this:

- There is no `ease-in` token. It delays the first frame, which is the frame
  the user is watching most closely, and makes the interface feel slower at an
  identical duration.
- Transitions name their properties. `transition: all` animates layout
  properties nobody intended to animate.
- Only `transform` and `opacity` are animated. Notably, the docked panels
  resize the grid instantly rather than transitioning `grid-template-columns`,
  which would force a layout pass on the React Flow canvas every frame.
- Pressed states scale (`0.97` for buttons, `0.94` for icon buttons) rather
  than translating.
- Hover styling is gated behind `@media (hover: hover) and (pointer: fine)`.
  Touch devices fire hover on tap and leave elements stuck in a hovered state.
- Reduced motion shortens transitions and stops loops. It does not remove
  colour and opacity feedback, which still carries state.

## Themes

`data-theme` on `<html>` selects the palette; `light` and `dark` are complete
and independent. The attribute is set before first paint by an inline script in
`index.html` reading the same persisted key as the workspace store, because
applying it in React happens at least one frame after the browser has painted
the body and produces a visible flash.

`system` is the default preference and stays subscribed to
`prefers-color-scheme`, since the operating system can change appearance while
a long session is open.

Dark mode uses warm-tinted neutrals rather than a neutral-cool grey. A cool
grey would sever the connection to the paper identity and leave the amber
accent looking borrowed.

## Port type colours

The typed graph has 16 port types. Encoding 16 hues would exceed what anyone
can hold in working memory and would imply similarity between adjacent hues
that the type system does not guarantee. `lib/portFamily.ts` collapses them
into four families (data, model, results, artifacts), which are the colours
used by handles, edges, the canvas legend, and the inspector's port list. The
exact type remains available on hover and in the inspector.

Colour is never the only carrier: handles have text labels, the legend names
each family, and node status is conveyed by icon and text as well as hue.

## Accessibility evidence

Every text token is measured against the surfaces it is actually used on, in
both themes, using relative luminance per WCAG 2.1. All text pairs meet AA
(4.5:1). Representative measured ratios:

| Pair | Light | Dark |
| --- | --- | --- |
| `ink` / `bg-surface` | 13.56 | 12.60 |
| `ink-soft` / `bg-raised` | 7.47 | 6.69 |
| `muted` / `bg-sunken` | 4.80 | 6.96 |
| `faint` / `bg-raised` | 4.74 | 4.80 |
| `accent` / `accent-surface` | 4.95 | 6.25 |

Port handle swatches measure 4.08 to 4.79 against the canvas in light mode and
6.84 to 8.36 in dark. These are 9px non-text indicators, which WCAG 1.4.11
holds to 3:1, and they reinforce text labels rather than carrying meaning
alone.

This is enforced, not just recorded. `src/styles/tokens.contrast.test.ts`
parses `tokens.css`, resolves each theme through the cascade, and fails the
suite if any pair drops below its threshold. A palette change that reduces
contrast breaks `npm run test`.

## Adding a component style

1. Use tokens. A literal colour, size, or duration in a component stylesheet is
   a defect unless it is documented on the line above.
2. Put it in the module that owns the surface. Add a new module rather than
   growing one past a few hundred lines.
3. Give hover states a fine-pointer media query and pressed states a scale.
4. Provide the empty, loading, and error appearance, not only the success one.
5. Check both themes before finishing.
