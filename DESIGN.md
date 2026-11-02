---
name: dutch-oven
description:
  A recipe shelf that feels like a warm kitchen wall — soft hairlines and
  ingredient tints on butcher paper.
colors:
  butcher-paper: '#fdf6ec'
  cast-iron: '#16130e'
  card-cream: '#fffdf8'
  tomato: '#ff4b26'
  tomato-tint: '#fecbba'
  yolk: '#ffc21c'
  basil: '#2fa84f'
  eggplant: '#5b3df5'
  muted-paper: '#f3e7d0'
  muted-ink: '#5c5546'
  hairline: 'rgb(22 19 14 / 0.18)'
  field-line: 'rgb(22 19 14 / 0.46)'
typography:
  display:
    fontFamily: "'Open Sans Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: 'clamp(4rem, 9vw, 7rem)'
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: '-0.02em'
  title:
    fontFamily: "'Open Sans Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '1.25rem'
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "'Open Sans Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Open Sans Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: '13px'
    fontWeight: 600
    letterSpacing: '0'
rounded:
  md: '8px'
  xl: '14px'
spacing:
  tile: 'clamp(8.5rem, 16vh, 10.5rem)'
  tile-gap: '16px'
components:
  tile:
    backgroundColor: '{colors.tomato-tint}'
    textColor: '{colors.cast-iron}'
    rounded: '{rounded.xl}'
    padding: '12px'
    width: '{spacing.tile}'
    height: '{spacing.tile}'
  button-primary:
    backgroundColor: '{colors.basil}'
    textColor: '{colors.cast-iron}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
  input-field:
    backgroundColor: '{colors.butcher-paper}'
    textColor: '{colors.cast-iron}'
    rounded: '{rounded.md}'
    padding: '8px 12px'
---

# Design System: dutch-oven

## Overview

**Creative North Star: "The Soft Kitchen"**

dutch-oven looks like a well-used kitchen wall, not a dashboard and not a
poster: butcher-paper ground, ink drawn as hairlines, and the colors of
ingredients — tomato, yolk, basil, eggplant — used as gentle tints. Everything
is flat and softly rounded, but quiet. The left sidebar is the reference for the
whole system: an 18% ink hairline, a yolk-tinted active row, semibold lowercase
type, no shadow.

The world was re-pinned by the user (2026-10-27). The earlier neobrutalist
kitchen (2px ink borders, hard offset shadows, uppercase stickers) was rejected
as too harsh and is never to return. Metro tiles, the pantry-shelf world and the
diner ticket-rail stay rejected too.

**Key Characteristics:**

- Butcher-paper cream ground, never white, never dark
- One hairline weight (1px) on resting surfaces and non-primary controls; ink at
  18% for surfaces and 46% for fields and secondary controls. Floating elements
  and the primary action use their component-specific border rules.
- Soft corners: 8px on controls and chips, 14px on cards, tiles, lists and
  photos, full circles for floating round buttons; zero gradients
- Shadows only on things that float (menus, listboxes, toasts, drag); never on
  resting surfaces, never a hard offset
- Ingredient colors appear as tints (15–40% over paper) for surfaces and as a
  solid fill only for the one primary action on a screen
- Lowercase type; weight and size carry hierarchy, not case

## Colors

A pantry shelf at low volume: four ingredient colors on quiet paper.

### Primary

- **Tomato** (#ff4b26): destructive actions and error toasts; recipe tiles at
  25% tint.

### Secondary

- **Yolk** (#ffc21c): the active state — nav row, selected chip, menu highlight
  — at 30–40% tint. Solid only on a primary add/cook action.
- **Basil** (#2fa84f): the confirm/save action (solid) and success states.

### Tertiary

- **Eggplant** (#5b3df5): the only cool accent — focus rings, section underline,
  recipe tiles at 15% tint.

### Neutral

- **Butcher Paper** (#fdf6ec): the page ground.
- **Card Cream** (#fffdf8): raised surfaces (lists, cards, filled fields).
- **Cast Iron** (#16130e): all text. Borders are this ink at reduced opacity.
- **Hairline** (ink at 18%): borders of lists, cards, tiles and dividers.
- **Field Line** (ink at 46%, 3:1 against card and paper): borders of inputs,
  selects, textareas and secondary buttons.
- **Muted Ink** (#5c5546): secondary text on paper.

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

App pages sit behind a fixed left rail (~12rem). On phones the rail becomes a
bottom tab bar in thumb reach: recipes, ingredients and groceries, with a round
add button on the shelf. Pages are top-aligned: a plain title leads, with
page-level tools beside it. The recipe grid is a single top-anchored flow of
rounded square tiles (`--spacing-tile`, 16px gaps), newest first. Forms are one
column, max ~42rem, grouped into soft sections separated by space rather than
boxes.

## Elevation & Depth

Resting surfaces are flat: depth comes from a hairline and a card-cream fill.
Floating panels (menus, listboxes, popovers, toasts, sheets) get the Float
shadow over a 1px border of ink at 30%: on the cream ground a shadow alone let
them melt into the page (user decision, 2026-11-01). A dragged row keeps the
shadow alone.

### Shadow Vocabulary

- **Float**
  (`0 6px 20px -4px rgb(22 19 14 / 0.14), 0 1px 3px rgb(22 19 14 / 0.06)`):
  popups, listboxes, toasts, a row being dragged.
- **Tile hover** (the same Float shadow, fades in on hover).

### Named Rules

**The Declare-Once Rule.** A resting surface is elevated by a hairline or by a
shadow, never both. No hard offset shadows anywhere. Two exceptions: floating
panels, which carry both so they hold their edge, and a recipe tile's hover
lift, where the Float shadow fades in over its hairline to show it can be picked
up, and fades out again.

## Shapes

Corners are soft, in two sizes. Controls, chips and nav rows use `--radius`
(8px); cards, tiles, lists, photo slots and popups use 14px. Floating round
actions are full circles. Full-width bars (the tab bar, pinned action bars) stay
square-edged to the screen. Unrealized things — the add tile, an empty photo
slot, empty states — are drawn dashed; once real, the border goes solid.

## Components

### Recipe Tile

- **Shape:** rounded square (`--spacing-tile`, 14px), hairline border.
- **Color:** ingredient tint (tomato 25%, yolk 35%, basil 25%, eggplant 15%,
  cream) or a full-bleed photo with its title on a cream strip.
- **Hover:** the Float shadow fades in over the hairline (the Declare-Once
  exception). Focus: eggplant 2px outline, offset 2px.
- **Draft:** a recipe still being written is dashed on cream with a small
  "draft" label, until it is finished.

### Primary Button

- Basil solid fill, no border, no shadow, lowercase 13px semibold. Hover dims
  slightly. Secondary buttons are paper with a field-line border.
- Open decision: the recipe screens' confirm actions are basil, but the shared
  `Button` default (sign-in, sign-up, error retry) still fills with `--primary`,
  which is tomato. Pick one before restyling those pages.

### Inputs

- Paper (or card-cream) fill, 1px field-line border, 8px corners, semibold text.
  Focus shows the eggplant outline.

### Search

- The shelf's search control opens the global finder dialog, also available
  through ⌘K and the round add button. It offers blank recipe, import link, and
  paste text, followed by drafts, shelf recipes, and popular suggestions.
- Typing matches names and ingredients, showing shelf results before more
  recipes. A pasted URL offers “import this recipe”; a whole recipe opens the
  editor already sorted with an Undo action.
- Arrow keys and pointer movement highlight results. Desktop hover previews show
  a thumbnail, ingredient sections, and recipe steps without actions. Selecting
  a result fills the dialog with that preview and a pinned bottom “open recipe”
  action; Back restores the results. Desktop dialogs leave 32px above and below;
  phones use the full screen. Previewing and opening results defer saving to the
  recipe page; explicit link imports save before navigation.

### Popular Recipes

- The empty shelf's first-recipe card opens the finder.
- Discovery follows the user's shelf, separated by space and a hairline. The
  “discover recipes” heading is small and muted, without a colored underline.
- One row of compact cards uses full-color photos, readable titles and muted
  source names. More cards fit at wider breakpoints; “browse more recipes” opens
  the finder. No tinted container, horizontal overflow, or dimming.
- Results combine shared recipes and indexed recipe sites. Picking one opens it
  without saving. Paper placeholders hold space while loading; errors or no
  results leave the section out.

### Shared Recipes

- A recipe from the web exists once for everyone. An outlined “save to shelf”
  action becomes “remove from shelf” once saved, inline with the compact Start
  cooking action. Saving does not copy the recipe. Saved recipes can be
  organized into books. Cook logging is not part of the current MVP.
- Editing a shared recipe makes your own copy on its first real change; an
  eggplant-tinted note in the editor explains this. Notes remain personal.
  Removing a shared recipe only takes it off your shelf.

### Recipe Form

- No form to fill and submit: a recipe is written on its own page. The name is
  the heading (same size as the recipe view, on a dashed line until focused),
  then ingredients, steps and notes. Writing your own opens this page blank;
  editing a recipe swaps the view for it in place.
- It saves itself a moment after each change. A quiet status by the one solid
  action says "saved", "saving…" or "draft · saved"; that action is "done",
  which finishes a draft and returns to the view. There is no save or cancel.
- A recipe exists once it has a name, as a draft, so leaving early loses
  nothing. Pasting a whole recipe into an empty one sorts it into name,
  ingredients and steps, with Undo. Links are imported through the finder or the
  explicit import dialog.
- Each ingredient is one free-form line with a reorder handle. Only section
  headings carry an ingredient icon; individual rows remain text. Suggestions
  complete the food name while preserving amounts and wording. Lines wrap, and
  the add row is dashed.

### Chips and Active States

- Selected = yolk tint (40%) with a hairline border; unselected = transparent
  with a faint border that strengthens on hover.

### Loading

- Switching pages never leaves the old page frozen. After 100ms a 4px eggplant
  bar slides across the top; after 150ms the content area shows quiet paper
  blocks that stay at least 400ms so they never flash. Quick loads show neither.
  Reduced motion gets a still bar.

### Avatar

- One component everywhere (menu, header, popup, profile). The photo when there
  is one; otherwise a yolk initial for an account and a dashed outline with a
  user glyph for a guest whose shelf is not saved yet. Radius scales with size
  (8px small, 10px, 14px on the profile page) and every size has a hairline
  border. While the session loads, a soft tile of the same footprint holds the
  spot (no label), so nothing shifts when the avatar arrives.

### Navigation

- Left rail of full-width rows: Phosphor icon (18px, filled when active) +
  lowercase 13px semibold label. Active row = yolk 30% tint with a hairline
  border; hover = card fill. Ingredients and groceries open dedicated
  work-in-progress pages with a route back to recipes until those features are
  ready.
- Phone tab bar: three equal tabs (recipes, ingredients, groceries; icon over
  label, 56px tall, safe-area padded) pinned to the bottom behind a hairline.
  The recipes shelf alone adds a round yolk button (56px, soft float shadow)
  floating at the bottom right above the bar to add a recipe. The bar leaves
  screens that pin their own actions (forms, the recipe view) and, with the
  round button, steps aside while a text field has focus.
- Phone header: a slim row with the wordmark left and the account as a small
  avatar button right (a count badge for guests with saved items). Account is a
  rare visit, so it never takes a tab; the desktop sidebar keeps it at the
  bottom.

## Do's and Don'ts

### Do:

- **Do** keep every border one hairline weight; use field-line only for things
  the user types into or presses as a secondary action.
- **Do** tint ingredient colors; reserve a solid fill for the one primary
  action.
- **Do** use dashed borders for anything the user hasn't created yet.
- **Do** let weight and size make hierarchy.

### Don't:

- **Don't** use hard offset shadows, 2px ink borders, uppercase labels or
  rotated stickers — the rejected neobrutalist world.
- **Don't** put a border and a shadow on the same surface, except for the
  floating-panel and recipe-tile treatments defined above.
- **Don't** use gray-on-color secondary text; tint from the surface's ink.
- **Don't** resurrect rejected worlds: neobrutalist, metro-black, pantry-shelf,
  diner ticket-rail.

### Ingredient overview and cooking

The recipe overview offers category and source-order views. Categories reuse
Ingredients' catalog assignments and food aliases; source sections appear only
in recipe order and cooking mode. Unknown foods stay under Other. Display
grouping never changes saved ingredient order. Ingredients and steps use
bordered, rounded lists with separated rows and naturally wrapping text.
Quantities stay verbatim, at the same weight as the ingredient. Category
headings use generic pantry sprites, including a bottle for oils and sauces;
source headings stay text-only.

Start cooking restores source order. Checkboxes are visible before cooking;
clicking one asks to start, and confirmation checks the selected item. Cancel
leaves the checklist unchanged. Progress is saved per user and recipe on the
server, including across devices. End cooking clears the session without
recording a meal. Changed ingredient or step content invalidates stale
checkoffs.

A warm yolk card at the bottom of the sidebar links to each active recipe, shows
step progress, and counts elapsed time since starting (including time away). On
phones it sits above the bottom navigation. Start cooking remains a compact
action beside Save.

Checklist changes appear immediately while serialized background requests save
them. Failed changes roll back with a retryable error; checks remain interactive
during saves.
