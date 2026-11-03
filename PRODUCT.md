# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Home cooks — weeknight cooking, saving recipes, family meals. Food is care and
pleasure, not data entry.

## Product Purpose

dutch-oven is a recipe and food-tracking app. The primary job is finding and
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
link or pasted text (with a home relay for sites that refuse datacenters), books
(collections) for organizing a shelf, public profiles and share links, recipe
export and import between kitchens, and an ingredients pantry (per-user
ingredients, whole-item quantities, pixel icons).

Confirmed, not built yet: meal logging as a one-tap byproduct of cooking (the
data model and server functions exist, and cook counts already rank the shelf,
but there is no logging UI), creating and renaming books from the shelf, a home
"what's tonight" decision surface (`/home` redirects to the shelf for now),
groceries (a list from picked recipes; the tab opens a work-in-progress page),
and books as an AI scope. Decision-first, not calendar-first: week planning
deferred. Undecided: nutrition/macro detail depth. Four pantry storage locations
are planned; the data model has none yet.

## Brand Commitments

Name: dutch-oven. User-pinned visual direction (2026-10-27, third revision): the
soft kitchen — butcher-paper cream ground, ink drawn as 1px hairlines (18% for
surfaces, 46% for fields), soft 8px/14px corners, lowercase semibold type, no
resting shadows, and ingredient colors (tomato #ff4b26, yolk #ffc21c, basil
#2fa84f, eggplant #5b3df5) used as tints with one solid primary action. The left
sidebar is the reference for the whole system. Earlier directions the user moved
past: neobrutalist kitchen (2px ink borders, hard offset shadows, uppercase
stickers — rejected as too harsh), metro tiles (cyan/magenta/lime), and homey
pantry-shelf with mustard/ketchup accents. Explicitly rejected: restaurant/diner
ticket-rail world — too commercial, not homey.

## Evidence on Hand

Recipes come from real recipe sites through import and discovery, plus what
cooks write themselves. No user research or brand imagery yet; pantry icons are
licensed pixel sprites (`public/sprites/pantry/ATTRIBUTION.txt`).

## Product Principles

- Cooking first: every surface serves getting dinner made.
- Logging is a byproduct of cooking, never a separate data-entry task.
- Warmth and personality over clinical precision.
