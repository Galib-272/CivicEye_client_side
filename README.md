# CivicEye — client

Web app for **CivicEye**, a civic issue reporting, tracking and resolution platform. Citizens
report problems such as potholes or broken streetlights, the responsible organization reviews and
repairs them, and an authorized person verifies the work.

The API lives in a separate repository: [CivicEye_server_side](https://github.com/Galib-272/CivicEye_server_side).

> **Status: Phase 3 (organizations).** Accounts, two-factor and account settings, plus
> organization administration, organization workspaces and invitations, in English and Bangla.
> Reporting and maps come in later phases.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · next-intl (English and Bangla) ·
TanStack Query · a typed API client generated from the server's OpenAPI document.

## Prerequisites

- **Node.js 24 LTS** (see [`.nvmrc`](.nvmrc)) and npm
- A running CivicEye API for anything that talks to the server (see the server repository)

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

- App: <http://localhost:3000> (redirects to `/en` or `/bn`)
- Diagnostics: <http://localhost:3000/en/system-status> shows whether the app can reach the API,
  and whether the API can reach its databases. Available in development only, unless enabled.

## Commands

| Task                                                                 | Command                                                           |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Develop                                                              | `npm run dev`                                                     |
| Lint / format check                                                  | `npm run lint` / `npm run format:check`                           |
| Type check                                                           | `npm run typecheck`                                               |
| Unit tests                                                           | `npm test`                                                        |
| End-to-end + accessibility tests                                     | `npm run test:e2e` (first run: `npx playwright install chromium`) |
| Build / start                                                        | `npm run build` / `npm start`                                     |
| Regenerate API types from `openapi/openapi.json`                     | `npm run api:types`                                               |
| Copy the latest spec from a sibling server checkout, then regenerate | `npm run api:sync`                                                |

## API types

[`openapi/openapi.json`](openapi/openapi.json) is a copy of the server's OpenAPI document, and
[`src/types/api.generated.ts`](src/types/api.generated.ts) is generated from it. When the API
changes, check out both repositories side by side (`civiceye_client_side/` next to
`civiceye_server_side/`), run `npm run api:sync`, and commit both files. CI fails if the generated
types do not match the committed spec.

## Environment variables (`.env.local`)

`NEXT_PUBLIC_*` values are embedded in the browser bundle at build time and must never be secret.

| Variable                           | Required | Default | Purpose                                                                  |
| ---------------------------------- | -------- | ------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL`              | yes      | —       | Base URL of the API                                                      |
| `NEXT_PUBLIC_ENABLE_SYSTEM_STATUS` | no       | `false` | Show `/system-status` in production builds (always shown in development) |

## Pages

| Path                                          | Purpose                                                                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sign-in`, `/register`                       | Sign in; create an account                                                                                                                    |
| `/verify-email#token=…`                       | Opened from the verification email                                                                                                            |
| `/forgot-password`, `/reset-password#token=…` | Request and complete a password reset                                                                                                         |
| `/two-factor`, `/two-factor/setup`            | Two-factor code at sign-in; set up an authenticator app                                                                                       |
| `/account`                                    | Profile, password, two-factor status and signed-in devices                                                                                    |
| `/reports`, `/reports/[id]`                   | Public reports (no reporter, location rounded to about 100 m) and one report; the reporter sees the exact location, photos, edit and withdraw |
| `/reports/new`                                | Report an issue: category, photos (uploaded straight to storage), map pin / device location / coordinates, visibility                         |
| `/reports/mine`                               | The signed-in citizen's reports with a count per status                                                                                       |
| `/admin/reports/triage`                       | Super Admins assign reports no single organization covers                                                                                     |
| `/organizations/[id]/reports`                 | Review queue for Org Admins and Reviewers, by status tab                                                                                      |
| `/organizations/[id]/reports/[reportId]`      | Review workspace: decisions, information requests, transfer, internal notes, public updates                                                   |
| `/admin/reports/[reportId]`                   | Super Admin read-only view of any report (audited), with moderation of public updates                                                         |

All paths are prefixed with the language (`/en/…`, `/bn/…`). Email links carry their token in
the URL fragment; pages read it, then remove it from the address bar and history.

The session cookie is `HttpOnly`, so the app never sees it. The CSRF token from `/auth/me` is kept
in memory and sent as `x-csrf-token` on state-changing requests. Pages hide what a user cannot
do, but every rule is enforced by the API.

## Maps

The location picker uses [MapLibre GL](https://maplibre.org/) with free
[OpenFreeMap](https://openfreemap.org/) tiles (OpenStreetMap data, no API key, no service
guarantee). The provider must be confirmed before launch. Without WebGL the map is replaced by a
message, and device location or typed coordinates still work.

MapLibre draws the map in a background worker that it looks for next to its own code, which
does not exist once Next.js bundles it. `scripts/copy-map-worker.mjs` copies the installed
worker to `public/vendor/` before `dev` and `build`, and the map points MapLibre at it.

## Localization and accessibility

- UI text lives in [`src/messages/en.json`](src/messages/en.json) and
  [`src/messages/bn.json`](src/messages/bn.json). A unit test checks both have the same keys and
  placeholders. The Bangla text still needs review by a native speaker.
- Dates use the `Asia/Dhaka` timezone by default.
- The target is WCAG 2.2 AA. End-to-end tests run axe checks in both languages.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs formatting, lint, the API-types check,
type checks, unit tests, end-to-end and accessibility tests (desktop and mobile), and a
production dependency audit.
