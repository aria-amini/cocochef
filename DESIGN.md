---
name: cocochef
description:
  A recipe shelf that feels like a warm kitchen wall — soft hairlines and
  ingredient tints on butcher paper.
---

# Design System: cocochef

## Overview

**Creative North Star: "The Soft Kitchen"**

cocochef looks like a well-used kitchen wall, not a dashboard and not a poster:
butcher-paper ground, ink drawn as hairlines, and the colors of ingredients —
tomato, yolk, basil, eggplant — used as gentle tints. Everything is flat and
softly rounded, but quiet. The left sidebar is the reference for the whole
system: a hairline border, a yolk-tinted active row, semibold lowercase type, no
shadow.

The world was re-pinned by the user (2026-10-27). The earlier neobrutalist
kitchen (2px ink borders, hard offset shadows, uppercase stickers) was rejected
as too harsh and is never to return. Metro tiles, the pantry-shelf world and the
diner ticket-rail stay rejected too.

**Key Characteristics:**

- Butcher-paper cream ground, never white, never dark
- One hairline weight (1px) on resting surfaces and non-primary controls: the
  hairline color for surfaces, the field line for fields and secondary controls.
  Floating elements and the primary action use their component-specific border
  rules.
- Soft corners: `rounded-md` on controls and chips, `rounded-xl` on cards,
  tiles, lists and photos, full circles for floating round buttons; zero
  gradients
- Shadows only on things that float (menus, listboxes, toasts, drag); never on
  resting surfaces, never a hard offset
- Ingredient colors appear as tints (15–40% over paper) for surfaces and as a
  solid fill only for the one primary action on a screen
- Lowercase type; weight and size carry hierarchy, not case

## Colors

A pantry shelf at low volume: four ingredient colors on quiet paper. Values live
in `src/styles.css` only; this section names each color's role and the CSS
variable that carries it.

### Primary

- **Tomato** (`--kitchen-tomato`, `--destructive`): destructive actions and
  error toasts; recipe tiles at 25% tint.

### Secondary

- **Yolk** (`--kitchen-yolk`): the active state — nav row, selected chip, menu
  highlight — at 30–40% tint. Solid only on a primary add/cook action.
- **Basil** (`--kitchen-basil`, `--primary`): the confirm/save action (solid)
  and success states.

### Tertiary

- **Eggplant** (`--kitchen-eggplant`, `--accent`, `--ring`): the only cool
  accent — focus rings, section underline, recipe tiles at 15% tint.

### Neutral

- **Butcher Paper** (`--background`): the page ground.
- **Card Cream** (`--card`): raised surfaces (lists, cards, filled fields).
- **Cast Iron** (`--foreground`): all text. Borders are this ink at reduced
  opacity.
- **Hairline** (`--border`): borders of lists, cards, tiles and dividers.
- **Field Line** (`--input`, 3:1 against card and paper): borders of inputs,
  selects, textareas and secondary buttons.
- **Muted Ink** (`--muted-foreground`): secondary text on paper.

### Named Rules

**The Ingredient Rule.** Color comes from the kitchen, not a brand book. A tint
is tomato, yolk, basil, or eggplant — never "blue" or "indigo". **The One-Solid
Rule.** At most one saturated solid fill per screen, on the primary action.
Everything else is a tint or paper.

## Typography

**Display & Body Font:** Open Sans Variable (system sans fallback) **Mono
Font:** JetBrains Mono Variable — code and data only, never decoration

**Character:** One family does everything; contrast comes from size and a
400/600/700 weight ladder, never from case.

### Hierarchy

- **Display** (700, clamp(4rem,9vw,7rem), 0.95): brand moments only (landing).
- **Page Title** (700, 1.75–2.5rem, tight): app page headers, plain lowercase.
- **Tile Title** (700, 1.25rem, tight): recipe names on tiles.
- **Label** (600, 13px, lowercase): section labels, buttons, nav items, chips.
- **Body** (400–600, 1rem, 1.5): forms and detail pages.

### Named Rules

**The Lowercase Rule.** All UI copy is lowercase, labels included. No Title
Case, no uppercase, no tracking, with one exception: display and title sizes
tighten by -0.02em (`tracking-tight`) so large lowercase words hold together.

## Layout

App pages sit behind a left rail; on phones the rail becomes a bottom tab bar in
thumb reach. Pages are top-aligned with a plain title leading. Forms are one
column, grouped into soft sections separated by space rather than boxes.

## Elevation & Depth

Resting surfaces are flat: depth comes from a hairline and a card-cream fill.
Floating panels (menus, listboxes, popovers, toasts, dialogs) use the `floating`
utility in `src/styles.css`: a border and the Float shadow together, because on
the cream ground a shadow alone let them melt into the page (user decision,
2026-11-01). A dragged row keeps the shadow alone.

### Named Rules

**The Declare-Once Rule.** A resting surface is elevated by a hairline or by a
shadow, never both. Two exceptions: floating panels, and a recipe tile's hover
lift, where the Float shadow fades in over its hairline to show it can be picked
up, and fades out again.

## Shapes

Corners are soft, in two sizes: `rounded-md` for controls, chips and nav rows;
`rounded-xl` for cards, tiles, lists, photo slots and popups. Floating round
actions are full circles. Full-width bars (the tab bar, pinned action bars) stay
square-edged to the screen. Unrealized things — the add tile, an empty photo
slot, empty states, the add row — are drawn dashed; once real, the border goes
solid.

## Components

Component styles live in the components themselves (`src/components/ui` and the
`cva` variants); this section records only the conventions code can't show.

- **Ingredient icons** may use familiar family stand-ins: leafy greens for
  herbs, meat for cuts, and fish for seafood. Match compound foods before the
  names inside them; leave unknown ingredients blank.
- **One solid action.** Basil is the confirm/save fill. Solid yolk is the one
  exception: an "add" action on the shelf or ingredients page may use it
  instead. Secondary is paper with a field line, quiet is muted ink, destructive
  is a tomato tint.
- **Active and selected** = yolk tint (about 40%) with a hairline border;
  unselected is transparent with a faint border that strengthens on hover.
- **Errors** are lowercase in one voice: "couldn't … — try again". Inline errors
  use `FieldError` (ink text, tomato mark), never tomato text.
- **Wordmark** is plain Open Sans bold, never mono, never on white.
- **Coco** is the mascot: a pixel-art black cat in a chef's hat. Coco greets
  visitors on the landing page and waves from `CocoWave`; reduced motion holds
  the first frame. Coco is art, not decoration: one per screen.
- **Loading** never leaves the old page frozen, and never flashes: quick loads
  show nothing. Reduced motion gets a still bar.
- **Avatar** is one component everywhere; a guest whose shelf isn't saved yet
  gets a dashed outline with a user glyph.

## Do's and Don'ts

### Do:

- **Do** keep every border one hairline weight; use the field line only for
  things the user types into or presses as a secondary action.
- **Do** tint ingredient colors; reserve a solid fill for the one primary
  action.
- **Do** use dashed borders for anything the user hasn't created yet.
- **Do** let weight and size make hierarchy.

### Don't:

- **Don't** put a border and a shadow on the same surface, except for the
  floating-panel and recipe-tile treatments above.
- **Don't** use gray-on-color secondary text; tint from the surface's ink.
- **Don't** resurrect rejected worlds: neobrutalist (hard offset shadows,
  uppercase labels, rotated stickers), metro-black, pantry-shelf, diner
  ticket-rail.
