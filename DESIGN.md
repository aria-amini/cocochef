---
name: cocochef
description:
  A recipe shelf that feels like a warm kitchen wall — soft hairlines and
  ingredient tints on butcher paper.
---

# Design System: cocochef

**The Soft Kitchen.** A well-used kitchen wall, not a dashboard and not a
poster: butcher-paper ground, ink drawn as hairlines, and the colors of
ingredients (tomato, yolk, basil, eggplant) used as gentle tints. Flat, softly
rounded, quiet. The left sidebar is the reference for the whole system.

Rejected, and never to return: the neobrutalist kitchen (2px ink borders, hard
offset shadows, uppercase stickers, rotated stickers), metro tiles, the
pantry-shelf world, the diner ticket-rail.

## Where the rules live

This file holds only judgment that code can't show. Everything else has one
home:

- **Tokens** (colors, corners, weights, shadow, tracking, fonts, focus ring, the
  `floating` surface): `src/styles.css`. The theme is an allowlist, so a class
  for a token it doesn't declare (`rounded-lg`, `font-medium`, `shadow-lg`)
  fails `shadcn/no-unknown-classes`.
- **Components** (buttons, badges, fields, dialogs, avatar, `FieldError`):
  `src/components/ui` and the variants in `src/components`. Use them; don't
  restyle (`shadcn/no-restyle`, `no-raw-colors`, `no-arbitrary-values`).
- **Lint** (`vite.config.ts`): no template-literal `className` (use `cn()`), no
  `uppercase`/`capitalize`, no gradients.

## Rules

- **Ingredient colors only.** A tint is tomato, yolk, basil or eggplant, never
  "blue" or "indigo". Yolk marks active and selected; basil confirms (a tick,
  progress, "have it"); tomato is destructive; eggplant is the only cool accent
  (focus, underline).
- **Effort is the one scale.** A recipe's effort reads basil, yolk, tomato for
  low, medium, high, as a light tint with a line of its own color, so it can be
  told at a glance and stays apart from a selected row's yolk. No other measure
  borrows the three as a traffic light.
- **One solid.** At most one solid fill per screen: the primary action, in ink
  with paper text. Everything else is a tint or paper. Colour stays with the
  food.
- **Paper, never white or dark.** Ink is the only text color, save the paper
  label on that one ink button; borders are ink at reduced opacity. Don't put
  gray text on a colored surface; tint from the surface's ink.
- **One hairline weight.** Use the field line (`--input`) only for things the
  user types into or presses as a secondary action.
- **Declare once.** A resting surface is lifted by a hairline or a shadow, never
  both. Floating panels use `floating` (border and shadow together); a recipe
  tile's hover lift and a dragged row are the other exceptions.
- **Corners.** `md` on controls, chips and rows; `xl` on cards, tiles, lists,
  photos and popups; full circles on round floating buttons. Full-width bars
  stay square.
- **Lowercase copy.** Labels included. Weight and size make hierarchy, not case.
  Mono only for code and data.
- **Dashed means not yet real.** The add tile, an empty photo slot, empty
  states, the add row. Once real, the border goes solid.

## Conventions

- **Errors** are lowercase in one voice: "couldn't … — try again". Inline errors
  use `FieldError` (ink text, tomato mark), never tomato text.
- **Loading** never leaves the old page frozen and never flashes: quick loads
  show nothing. Reduced motion gets a still bar.
- **Layout.** A left rail on desktop, a bottom tab bar on phones. Pages are
  top-aligned under a plain title. Forms are one column, grouped by space rather
  than boxes.
- **Ingredient icons** may use family stand-ins (leafy greens for herbs, meat
  for cuts, fish for seafood). Match compound foods before the names inside
  them; leave unknown ingredients blank.
- **Wordmark** is plain Open Sans bold, never mono.
