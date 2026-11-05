# cocochef

## Tech

- **TanStack Start** — full-stack meta-framework for React (competitor to
  Next.js)
- **React, TailwindCSS, shadcn** — UI
- **Vite+ (`vp`)** — unified toolchain bundling vitest, oxlint, oxfmt, and
  TypeScript; use `vp` instead of `npm`/`vite`
- **Drizzle, Postgres** — database
- **Varlock** — environment variable management, loaded via
  `varlock run -- <command>`; secrets resolve from OpenBao
- **mise** — runtime and tool version manager (`mise.toml`)

## Local Development

Prerequisites:

- [mise](https://mise.jdx.dev/getting-started.html)
- [Docker](https://www.docker.com/)

```sh
# https://mise.jdx.dev/getting-started.html
curl https://mise.run | sh

# activate mise (pick bash or zsh):
#
# bash
echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc
source ~/.bashrc
#
# zsh
echo 'eval "$(~/.local/bin/mise activate zsh)"' >> ~/.zshrc
source ~/.zshrc

git clone <repo-url>
cd cocochef
mise run bootstrap

# dev server
vp dev
```

## Environment Variables

Managed by [varlock](https://varlock.dev); `.env.schema` defines what is
required per environment. Deployed environments (`.env.preview`,
`.env.production`) read secrets from OpenBao at build time (`vaultSecret()`) and
freeze them with `varlock freeze`. Railway needs `OPENBAO_ADDR`, `VAULT_ROLE_ID`
and `VAULT_SECRET_ID` (from `mise run onboard cocochef` in
[aria-amini/infra](https://github.com/aria-amini/infra)) plus
`_VARLOCK_ENV_KEY`. Local development reads the shared development Google client
from OpenBao: run `mise run dev-token` in infra to write
`~/.config/openbao/.env.dev`; bootstrap stops if it is missing. Everything else
points at the docker services via `.env.development.local`, regenerated per jj
workspace by `mise-tasks/setup.ts`.

## Services

- **GitHub** — source control
- **Railway** — hosting and Postgres
- **Cloudflare** — DNS/CDN
- **PostHog** — product analytics
- **Sentry** — error monitoring
- **OpenBao** — secrets manager (self-hosted, see aria-amini/infra)
