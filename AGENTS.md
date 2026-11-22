# cocochef

Full-stack TanStack Start app: React 19, Vite+, Drizzle, Postgres, Better Auth,
Tailwind v4, shadcn, Varlock. Docker Compose runs Postgres and MinIO. Errors go
to Sentry.

## Environment

Varlock resolves the env from `.env.schema`, whose comments say where each
secret comes from: OpenBao, set up by
[aria-amini/infra](https://github.com/aria-amini/infra). Deploys freeze the
resolved env at build time; `railway.toml` says how, and why Railway's Skipped
Builds stays off. Railway's PR previews run the real build, so CI doesn't build.
Tests and CI never load the development env.

Some recipe sites refuse datacenter addresses, so link imports fall back to a
relay on a home connection (`src/lib/import/relay.ts`, reached through
`IMPORT_RELAY_URL` and `IMPORT_RELAY_TOKEN`). `pitchfork start relay` runs it
from one checkout, and
`tailscale funnel --bg --https=10000 http://127.0.0.1:8790` exposes it. Never
route `recipes:seed` through it.

## Local development

Rerun `mise run bootstrap` after a checkout moves, to repair its proxy URL.
Never run `pitchfork proxy setup`: it would take port 443 from the Caddy TLS
edge. `pitchfork logs dev` shows the dev server's output.

Use pnpm through Vite+ (`vp i`, `vp run <script>`). Add packages as
devDependencies: Nitro bundles the app into `.output`, and Railway prunes
devDependencies after the build. `dependencies` holds only what runs outside the
bundle: Varlock, `drizzle-orm` and `pg` for migrations, and `sharp`.

Pushes run `vp check` through `.vite-hooks/pre-push`; no hook runs tests. `vp i`
installs the hook only when it installs packages, so in a worktree that already
had them, run `vp config`, or git skips the hook silently.

## Tests

Use the smallest scope that covers the behavior. Test regressions and meaningful
behavior changes; skip trivial edits.

- **Unit** (`*.unit.test.ts`): pure logic.
- **Server** (`*.server.test.ts`, `*.db.test.ts`): server logic and the
  database.
- **Browser** (`*.test.tsx`): components and screenshots in real Chromium, on
  desktop and mobile. Screenshot assertions go here, not in E2E.
- **E2E** (`e2e/`, `vp run e2e`): smoke checks against a running app.

Browser tests need full Chromium:
`vp exec playwright install chromium --no-shell`. `vp run test:ui` can write
snapshots and baselines but not run commands.

## Performance

`vp run bench` measures the app on an emulated phone on 4G. Use it to show that
a performance change helps, as `scripts/bench.ts` describes. Nothing runs it in
CI, so fix it when the app's tabs or pages move under it.

## Design

shadcn is the single source of truth: build UI from `src/components/ui` and the
theme tokens in `src/styles.css`. Never restyle a component at the call site;
layout classes (width, margin, alignment) are fine. When a second place needs a
new look, add a variant named for what it means. Lint enforces the mechanical
rules. `DESIGN.md` says what the app should feel like; read it before designing
a screen.
