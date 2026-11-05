# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Home cooks — weeknight cooking, saving recipes, family meals. Food is care and
pleasure, not data entry.

## Product Purpose

cocochef is a recipe and food-tracking app. The primary job is finding and
cooking recipes; meal logging and planning support that loop. Success means
cooking from the app feels effortless and the act of logging a cooked meal is a
satisfying byproduct, not a chore.

## Positioning

One loop: find it, cook it, log it. Planning, cooking, and tracking are the same
motion, not three features bolted together.

## Operating Context

Used in the kitchen, often mid-cooking with wet hands; also at a desk when
planning the week. Responsive web app on the TanStack Start stack (React 19,
Vite+, Drizzle/Postgres, Better Auth, Tailwind v4, shadcn).

## Capabilities and Constraints

Shipped: recipe browsing, saving and temporary on-page checklists, import from a
link or pasted text (with a home relay for sites that refuse datacenters),
public profiles and share links, recipe export and import between kitchens, and
an ingredients pantry (per-user ingredients, whole-item quantities, pixel
icons).

Confirmed, not built yet: meal logging as a one-tap byproduct of cooking (the
data model and server functions exist, and cook counts already rank the shelf,
but there is no logging UI), a home "what's tonight" decision surface (`/home`
redirects to the shelf for now), groceries (a list from picked recipes; the tab
opens a work-in-progress page), and nothing like books or folders for the shelf
(removed on purpose). Decision-first, not calendar-first: week planning
deferred. Undecided: nutrition/macro detail depth. Four pantry storage locations
are planned; the data model has none yet.

## Product Behavior

- A recipe from the web exists once for everyone; saving it to a shelf does not
  copy it. Editing a shared recipe makes your own copy on the first real change.
  Removing a shared recipe only takes it off your shelf. Notes stay personal.
- A recipe can say where it came from with its original link: a web page, or a
  video such as a YouTube link. It is just a link; it can be added, changed or
  cleared in the editor. A copy of someone's public recipe credits the original
  author by their public profile name (never the account name) and otherwise
  stands on its own; removing a link never changes that credit.
- A recipe is written on its own page and saved on purpose: the editor lists
  what changed, "save" keeps it, and "cancel" leaves the recipe as it was.
- Ingredient and step checkboxes are temporary: leaving the recipe clears them.
- Cook logging is not part of the current MVP.

## Brand Commitments

Name: cocochef. User-pinned visual direction (2026-10-27, third revision): the
soft kitchen — see DESIGN.md for the system. The left sidebar is the reference
for the whole system. Earlier directions the user moved past: neobrutalist
kitchen (rejected as too harsh), metro tiles, and homey pantry-shelf with
mustard/ketchup accents. Explicitly rejected: restaurant/diner ticket-rail world
— too commercial, not homey.

## Evidence on Hand

Recipes come from real recipe sites through import and discovery, plus what
cooks write themselves. No user research or brand imagery yet; pantry icons are
licensed pixel sprites (`public/sprites/pantry/ATTRIBUTION.txt`).

## Product Principles

- Cooking first: every surface serves getting dinner made.
- Logging is a byproduct of cooking, never a separate data-entry task.
- Warmth and personality over clinical precision.
