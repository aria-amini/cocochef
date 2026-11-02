# dutch-oven

Full-stack TanStack Start app: React 19, Vite+, Drizzle, Postgres, Better Auth,
Tailwind v4, shadcn, Varlock. Docker Compose runs Postgres and MinIO.

Secrets come from OpenBao, set up by
[aria-amini/infra](https://github.com/aria-amini/infra). Deployed builds read
`secret/dutch-oven/<env>` and `secret/shared/<env>` with an AppRole that
`mise run onboard dutch-oven` in infra sets in Railway, then freeze the resolved
env (`varlock freeze`), so running apps, restarts, and rollbacks never contact
OpenBao. The frozen env is encrypted with `_VARLOCK_ENV_KEY`, which must be set
on each Railway environment with a different value, and must not change between
a build and its deploy. Keep Railway's Skipped Builds off for this service: a
reused image holds another tier's frozen env, and the key mismatch makes it fail
to start. `OAUTH_PROXY_SECRET` must hold the same value at
`secret/dutch-oven/preview` and `secret/dutch-oven/production`, or Google
sign-in from a preview fails when production handles the callback;
`createAuth()` can only check that it is set. Local dev reads
`secret/shared/development` with the per-machine token in
`~/.config/openbao/.env.dev`, from `mise run dev-token` in infra; bootstrap
stops if it is missing. Tests and CI never load the development env, so they
never use OpenBao.

`railway.toml` freezes the env in the build, before devDependencies are pruned,
and runs the deploy and migrations with `varlock run --frozen`, not `vp run`:
`vp run` loads the Vite config, which would resolve the env live again.

Error monitoring is wired through Sentry (`@sentry/tanstackstart-react`).

Product analytics run through PostHog behind a `/api/ingest` proxy.

Some recipe sites refuse datacenter addresses, so link imports fall back to a
relay on a home connection (`src/lib/import/relay.ts`). Deploys reach it through
`IMPORT_RELAY_URL` and `IMPORT_RELAY_TOKEN`; with them unset, imports skip the
relay. On the VM, `pitchfork start relay` runs it on `127.0.0.1:8790` from one
checkout, and `tailscale funnel --bg --https=10000 http://127.0.0.1:8790`
exposes it. The token lives in `~/.config/dutch-oven/import-relay-token`. Never
route the discovery crawler through it.

## Environment

Varlock resolves the env from `.env.schema` and detects `APP_ENV`. Secrets are
checked where the code uses them; deploys also require `BETTER_AUTH_SECRET` and
`DATABASE_URL`. Railway's PR previews run the real build, so CI doesn't build.
`vp i` regenerates `env.d.ts`.

## Local development

Run `mise run bootstrap` for each checkout or workspace. It installs
dependencies, registers the Pitchfork proxy URL, starts the dev daemon, and
verifies the page. It also configures workspace ports, starts Docker services,
and applies database migrations. Repeat the command after a checkout moves to
repair its proxy mapping.

The dev server is a Pitchfork daemon (`pitchfork.toml`). Interactive shells
auto-start it on `cd`. Pitchfork passes its assigned `PORT` to Vite as
`APP_PORT` and probes that same port. Start the daemon through bootstrap first;
daemon auto-start alone does not register the proxy URL.

## Local URLs

Caddy terminates TLS on the Tailscale IP at 443 and proxies to the pitchfork
proxy on loopback 9443. URLs are portless: `https://<slug>.dev.ariaamini.com`.
Caddy only holds a certificate for `*.dev.ariaamini.com`, so other domains fail
TLS. Worktree slugs flatten to `<app>-<worktree>`, for example
`dutch-oven-my-task`. Nested hostnames (`worktree.app.dev…`) and direct `:9443`
access do not work: the wildcard cert covers one level, and the proxy binds
loopback only.

`mise run bootstrap` registers the workspace slug and writes `BASE_URL`. Never
run `pitchfork proxy setup` here — it would grab port 443 from the global Caddy
TLS edge.

## Commands

- `pitchfork list` / `pitchfork logs dev` / `pitchfork tui` — inspect the dev
  daemon
- `mise run bootstrap` — configure the workspace, remove orphaned Docker
  resources, and start the app
- `vp check` — format, lint, and type-check
- `vp test run` — run Vitest projects
- `vp run test:ui` — Vitest UI in the browser. Clients can write snapshots and
  baselines, but cannot execute commands (`allowWrite` on, `allowExec` off).
- `vp run e2e` — run Playwright smoke tests against the workspace proxy
- `vp run compose:up` — start local services
- `vp run db:push` — apply the current schema
- `vp run db:migrate` — run migrations
- `vp run dead-code` — find unused exports with fallow

Use `pnpm` through Vite+ (`vp i`, `vp run <script>`). Secrets resolve through
Varlock; never commit generated or local secret files.

Nitro bundles app code into `.output`, and Railway prunes devDependencies after
the build. Add packages as devDependencies. Keep `dependencies` to what runs
outside the bundle: Varlock for `start`, and `drizzle-orm` and `pg` for
migrations.

## PR review follow-through

“Full send” includes publishing, triggering CodeRabbit when automatic reviews
are disabled, addressing findings, and monitoring checks and reviews on the
latest head. Green CI and resolved threads alone do not mean the latest head has
been reviewed. Keep monitoring while a requested review or retry remains
outstanding; report that state without calling the work complete. Do not dismiss
an outstanding review or bypass branch protections just to finish.

When CodeRabbit is rate-limited:

- Post `@coderabbitai rate limit` as a top-level PR comment. This checks review
  availability without spending a review. Prefer its reported retry time over a
  guess. Review allowances refill on a rolling basis and can vary with usage; do
  not assume the top of the hour or hardcode a plan's allowance.
- If no exact retry time is available and the bot reports one review per hour,
  estimate the last successful review's completion time plus 60 minutes, with a
  2-minute buffer. Label this an estimate: other reviews by the same developer
  may affect availability. Record UTC and the user's local time.
- Use T3's persistent scheduler to wake this thread at the retry time. PR
  watching reports changes but does not wake on quota expiration. For a one-time
  retry implemented with a recurring timer, disable that timer as soon as it
  fires. Keep one pending retry per PR; reschedule it if newer quota information
  arrives. At wake-up, check that the PR still needs review and that no review
  is already running before posting `@coderabbitai review`.
- Do not use a long shell sleep, a polling loop, or a larger tool timeout as a
  substitute for a scheduled retry. A tool's wait timeout is not CodeRabbit's
  quota cooldown. If still limited, use the new retry time and keep monitoring.
- Batch fixes into one push before requesting another incremental review. Stop
  monitoring only after the current head's checks/review are settled and the
  work is handed back, or when the user asks to stop. A skipped/rate-limited
  review is not approval.

Reference: https://docs.coderabbit.ai/management/rate-limits and
https://docs.coderabbit.ai/reference/review-commands.

## Tests

Use the smallest test scope that covers the behavior. Test regressions and
meaningful behavior changes; skip trivial edits.

- **Unit** (`src/**/*.unit.test.ts`): pure logic, edge cases, and
  transformations.
- **Server** (`src/**/*.server.test.ts`): server logic and database
  integrations.
- **Browser** (`src/**/*.test.tsx`, `tests/**/*.test.tsx`): component
  interactions and visual states in real Chromium, on desktop and mobile.
- **E2E** (`e2e/`): smoke checks against a local or deployed app URL.

Install full Chromium with `vp exec playwright install chromium --no-shell`.
Screenshot assertions belong in Vitest Browser Mode.

## Style rules

### Always build `className` with `cn()`

Compose conditional or combined classes with `cn()`. Never interpolate classes
with template literals or string concatenation — an oxlint
`no-restricted-syntax` rule rejects template literals in `className`.

Bad:

```tsx
const className = `flex border-2 ${active ? 'bg-kitchen-yolk' : 'bg-card'} ${
	disabled ? 'opacity-35' : ''
}`
return <Link className={`${className} focus-visible:outline-2`} />
```

Good:

```tsx
const className = cn(
	'flex border-2',
	active ? 'bg-kitchen-yolk' : 'bg-card',
	disabled && 'opacity-35',
)
return <Link className={cn(className, 'focus-visible:outline-2')} />
```
