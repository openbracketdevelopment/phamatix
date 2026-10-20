# Payload CMS

A standalone, multi-site Payload CMS. It hosts the admin and content API; your
websites run separately. Local development uses SQLite and does not need a
separate database server.

## Run locally

Requirements: Node.js 20.18.1 or newer and npm.

```sh
npm ci
cp .env.example .env
openssl rand -hex 32
```

Copy the random value into `.env` as `PAYLOAD_SECRET`, then start the app:

```sh
npm run dev
```

Open <http://localhost:3000/admin> and create the first administrator. The
database (`cms.db`) and private uploads (`media/`) are created locally. Keep
`.env` private and do not commit it.

To add example sites and content, run this after creating the administrator:

```sh
npm run seed
```

The seed creates `alpha` and `bravo` sample sites. Create editor accounts and
site-specific website accounts/API keys from the admin.

## Pages and content

Manage site-specific categories in **Site content → Categories**, then select
one or more categories in a page. In the page editor, use **Layout** to add and
reorder Hero (heading, subheading, image), Text (text and supporting text), and
Gallery (heading and multiple images) blocks. The existing plain-text body is
optional. Upload images to Media first and assign them to the same site as the
page.

## Useful commands

| Command                       | Purpose                         |
| ----------------------------- | ------------------------------- |
| `npm run dev`                 | Start the development server    |
| `npm run seed`                | Create sample sites and content |
| `npm run test:int`            | Run integration tests           |
| `npm run typecheck`           | Check TypeScript                |
| `npm run lint`                | Run ESLint                      |
| `npm run build` / `npm start` | Build and run production        |

## Notes

- Required settings are `CMS_URL`, `PAYLOAD_SECRET` (at least 32 characters),
  and `DATABASE_URL`; the example `.env` provides local defaults for all but
  the secret.
- Optional S3-compatible storage settings are documented in `.env.example`.
- Website API keys are private server-side credentials. Do not put them in
  browser code. Website accounts can only read published, public content for
  their assigned site.
- Production requires HTTPS, persistent database/media storage, and running
  database migrations before startup. SQLite is intended for a single CMS
  instance; see `.env.example` and the migration scripts for configuration.
- Schema changes are defined in code. Generate types and a migration after
  changing collections; run migrations before deploying the change.
