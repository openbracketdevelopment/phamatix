# Standalone multi-site Payload CMS

A headless CMS for independently deployed websites. The only frontend hosted here
is Payload's administration interface (`/admin`); websites fetch content over REST.
Built from Payload's official blank template with Payload **3.91.0**, compatible
Next.js **16.4.2**, React **19.2.6**, and patched Sharp. Commit `package-lock.json`
and use `npm ci` to reproduce the dependency tree.

## Model and security assumptions

| Collection     | Scope                                                                 | Editing                             |
| -------------- | --------------------------------------------------------------------- | ----------------------------------- |
| Sites          | Website identity, domains, active flag, locale, timezone, preview URL | Administrators                      |
| Pages          | Required owning site; unique `(site, slug)`                           | Administrators and assigned editors |
| Navigation     | Required site; unique `(site, key)`; links to same-site pages         | Administrators and assigned editors |
| Media          | Required site; private files, draft/published status                  | Administrators and assigned editors |
| SEO settings   | One document per site, versioned like content                         | Administrators and assigned editors |
| Shared content | **Intentionally public across every website** when published          | Administrators only                 |
| Users          | Administrator, editor, or website account; explicit site assignments  | Administrators only                 |

- Every site-owned collection has server-side read/create/update/delete/version
  access rules. Site ownership cannot be changed after creation. Relationships
  cannot cross sites, even on draft saves. Unassigned editors see no site content.
- Administrators manage all sites. Editors can publish their assigned content;
  this starter does not implement a separate reviewer/approval workflow.
- Each website uses a **read-only website account assigned to exactly one site**.
  Its API key can retrieve only that site's active, **published**, `public`
  documents. It cannot edit, read versions, or obtain drafts by changing queries.
  Set `visibility=restricted` to exclude a document from website access entirely.
- Anonymous requests cannot read site-owned content or media. They can read
  published Shared content. Never put confidential information in Shared content.
  GraphQL is disabled to reduce exposed surface area; REST is the supported API.
- The same rules protect REST, admin, and Local API calls **when
  `overrideAccess: false` is set**. Payload's Local API defaults to bypassing access:
  never use that default in a website request handler. Seed/migration code is
  trusted operator code and can bypass access deliberately.
- Domains are metadata, **not credentials**. CORS and client-side filters are not
  isolation mechanisms. User accounts and site assignments are the trust boundary.
  Frontends may publish everything their website key can read; use a separate
  authenticated application backend for end-user restricted content.
- Site deletion is disabled to avoid orphaning content. Deactivate a site to stop
  website-key reads; archive/export content before implementing a deletion policy.
  Deactivation does not retract content already copied into frontend caches.

## 1. Prerequisites and installation

- Node.js **22 LTS** (22.13+ recommended), npm 10+, Git.
- A writable local filesystem. No separate database server is needed.
- For production: HTTPS hostname, persistent storage, and optionally a private
  S3-compatible bucket with credentials (provision these externally).

From this repository's root:

```sh
npm ci
cp .env.example .env
openssl rand -hex 32
```

Put the generated random value in `.env` as `PAYLOAD_SECRET`. Never commit `.env`,
API keys, passwords, database files, or uploads.

## 2. Database and environment

All variables and their requirements are described in `.env.example`.

- `CMS_URL`: exact CMS origin, e.g. `http://localhost:3000`; no trailing slash.
- `PAYLOAD_SECRET`: private random value of at least 32 characters. Keep it stable.
- `DATABASE_URL`: default `file:./cms.db`, created automatically in development.
- `FRONTEND_ORIGINS`: optional comma-separated exact browser origins. Local example
  allows `http://localhost:3001,http://localhost:3002`.
- `S3_*`: optional storage configuration, required only when `S3_ENABLED=true`;
  `MEDIA_DIR` sets the private local uploads directory when S3 is off.
- `SEED_ADMIN_*`: optional one-time initial administrator for unattended seeding.

**SQLite is intentional:** it makes the standalone service easy to run and back
up, with no external database credentials. Production must run **one CMS instance**
on a durable writable local volume (not ephemeral serverless storage, network
filesystems, or independently replicated SQLite files). For high write concurrency,
multiple instances, or serverless deployment, first replace the adapter with
Payload's PostgreSQL adapter, provision Postgres, and generate/test new migrations;
SQLite migrations are not portable to Postgres. Postgres is not configured here.

Development synchronizes the schema automatically. Production disables schema
push and requires migrations; see deployment below.

### CORS, cookies and authentication

The admin lives on the CMS origin and uses secure, HTTP-only, SameSite=Lax auth
cookies (secure in production), a two-hour token lifetime, and login lockouts.
Only the CMS origin is trusted for cookie-based CSRF mutations. Do not add
frontend origins to `csrf` just to bypass a browser error.

Browser CORS allows only the CMS origin plus `FRONTEND_ORIGINS`; origins cannot
contain wildcards, paths, or trailing slashes. **Updating a Site domain does not
update CORS**: change the environment and restart/redeploy as well. Ordinary
website requests should originate on the frontend's server, where CORS is not
relevant and credentials remain private. No website key belongs in browser
JavaScript, a `NEXT_PUBLIC_*` variable, or a public image URL.

## 3. Local operation and first administrator

```sh
npm run dev
```

Open <http://localhost:3000/admin>. On an empty database Payload shows its
first-user form. The first user is made an **administrator** by a server hook.
Subsequent registration is administrator-only; editors cannot change their role
or assigned sites, or provision users. Claim the first administrator **before**
exposing a new deployment publicly. Use a strong password and HTTPS in production.

Password-reset delivery needs an email adapter/provider, which is **not included**.
Provision and configure one before relying on email recovery or invitations.
Administrators can create users and set initial passwords in the meantime.

## 4. Seed two demonstration sites

After creating the first administrator:

```sh
npm run seed
```

Alternatively set `SEED_ADMIN_EMAIL` and a random `SEED_ADMIN_PASSWORD` (16+
characters) in `.env` before the first seed, then remove them afterwards.
The command is a trusted local operator action, not an HTTP endpoint.

Creates `alpha` and `bravo` with domains on ports 3001/3002, each with a published
home page, unpublished draft, restricted page, navigation, generated PNG, and SEO
defaults, plus a published shared footer. Both sites can have a `home` slug.
Re-running skips sites that already have pages and does not overwrite edits.
This is a demonstration seed, not a recovery tool: after a partially failed run,
inspect existing records before retrying. No demo passwords or API keys are
committed, and seed does not automatically create website accounts or editors.

## 5. Add a website, editors and website keys

1. As an administrator, create a Site with a unique URL-safe `identifier`, display
   name, exact origins in Domains, locale/timezone, and optionally a preview URL.
2. Create Users with role **editor**, assigning one or more Sites. Give each person
   their own account. They can only see/edit content in those sites.
3. Create another User with role **website**, assigned **exactly one** Site. Use a
   strong random password, enable API Key, save, and copy the generated key into
   that website's server-side secret store. Website accounts cannot use the admin.
4. Add browser origins to `FRONTEND_ORIGINS` if necessary, restart the CMS, then
   create content for the site and explicitly **Publish** it.
5. Rotate keys periodically and immediately on disclosure. Keys do not expire
   automatically. Disable/regenerate the key or delete the website account to
   revoke it; changing the password alone does not revoke an API key.

## 6. Fetch published content from a Next.js website

On the **frontend**, not this CMS, configure:

```dotenv
CMS_URL=http://localhost:3000
CMS_SITE_ID=1
CMS_API_KEY=replace-with-this-sites-website-account-key
```

Obtain the numeric Site ID from the admin (do not assume `alpha` is always ID 1).
For a Next.js App Router frontend, this is a complete `app/page.tsx` example:

```tsx
import 'server-only'
import { notFound } from 'next/navigation'

type Page = { id: number; title: string; body: string }

export default async function Home() {
  const query = new URLSearchParams({
    'where[site][equals]': process.env.CMS_SITE_ID!,
    'where[slug][equals]': 'home',
    'where[_status][equals]': 'published',
    depth: '0',
    limit: '1',
    draft: 'false',
  })
  const response = await fetch(`${process.env.CMS_URL}/api/pages?${query}`, {
    headers: { Authorization: `users API-Key ${process.env.CMS_API_KEY}` },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`CMS returned ${response.status}`)
  const { docs }: { docs: Page[] } = await response.json()
  const page = docs[0]
  if (!page) notFound()
  return (
    <main>
      <h1>{page.title}</h1>
      <p>{page.body}</p>
    </main>
  )
}
```

`body` is deliberately plain text; React escapes it. This starter does not render
untrusted HTML. Fetch `/api/navigation` and `/api/seo-settings` using the same
headers and site query. Fetch `/api/shared-content?where[key][equals]=footer`
without a key if desired. Extra site/status filters express intent; removing or
tampering with them **does not bypass server access rules**.

Protected media URLs require the same authorization. Do not expose keys in URLs
or make the storage bucket public to make `<img>` work. Implement a frontend
server-side proxy with a **fixed CMS origin**, allowed `/api/media/file/` paths,
its own site's key, no user-controlled upstream URLs/credentials, and appropriate
content-type handling. For private content use `Cache-Control: private, no-store`;
for published assets define a deliberate cache invalidation policy. The image
proxy itself is frontend-specific and is **not supplied** by this CMS.

### Drafts, publishing and preview

Pages, navigation, media, SEO defaults and Shared content have draft/publish
controls and up to 25 stored revisions per document. Save Draft keeps unpublished
work private; Publish makes a public-visibility record available to its website.
Publishing a draft revision does not require an application redeploy. Published
documents retain their published version while a new draft is being edited.
Publish linked media/pages too: inaccessible relationships are not populated for
website readers. Unpublish to withdraw a document; purge frontend/CDN caches too.

**Preview approach:** a frontend should implement an authenticated preview entry
route. Store its URL in Site `previewURL` as a reference for editors (there is no
automatic preview button/token exchange in this starter).

1. Require a real editor login, authenticate to `/api/users/login` server-side,
   and keep the returned short-lived editor JWT in the frontend's secure,
   HTTP-only session. Never hardcode an administrator JWT or put JWTs in URLs.
2. Validate the preview request's site/slug, use fixed redirect targets, protect
   session mutations against CSRF, and enable Next.js `draftMode()` only after
   authenticating the editor. An unguessable link alone is not editor identity.
3. In preview rendering, request `/api/pages?draft=true&...` using
   `Authorization: JWT <editor-token>`, `cache: 'no-store'`, and no published-only
   query filter. Payload still restricts the editor to assigned sites.
4. Disable preview and clear its session on exit/logout. Do not cache preview
   responses, log tokens, or reuse that token in the public fetching path.

This requires an authenticated preview integration in each frontend; **website
API keys intentionally cannot preview drafts**. Editors can also inspect drafts
directly in the CMS before that integration exists.

## 7. Migrations and production deployment

The committed initial migration creates the complete SQLite schema. After any
collection changes:

```sh
npm run generate:types
npm run generate:importmap
npm run payload -- migrate:create
npm run test:int
npm run typecheck
npm run lint
```

Review and commit the generated migration and `src/migrations/index.ts`. Test
migrations against a copy of production data. Do not mix development schema-push
databases with migration-managed production databases: test on a **fresh** SQLite
file, or restore a production backup.

Deploy on a Node 22 VM/container with one running instance and persistent volumes:

1. Provision HTTPS/reverse proxy, a durable `/var/lib/payload` volume, backup
   destination, and optionally a private S3 bucket. Restrict file permissions to
   the CMS process. Production requires external hosting/TLS/storage setup.
2. Set `NODE_ENV=production`, `CMS_URL=https://cms.example.com`, a stable
   `PAYLOAD_SECRET`, `DATABASE_URL=file:/var/lib/payload/cms.db`, explicit HTTPS
   `FRONTEND_ORIGINS`, and storage secrets through the platform's secret manager.
   These configuration values must also be available during build.
3. Run `npm ci`, then `npm run build`. Do not use a secret baked into a public
   image layer. Build and runtime environments must use compatible configuration.
4. Back up the database; before starting traffic run
   `npm run payload -- migrate` with the same environment and persistent volume.
   For a first deployment start from an empty database file. Run migrations once,
   not concurrently from multiple processes. Check `npm run payload -- migrate:status`.
5. Start with `npm start` (default port 3000) behind HTTPS using a process
   supervisor. Forward the original host/protocol headers correctly, set request
   body/time limits, and restrict the public port to the reverse proxy.
6. Claim the initial administrator before opening traffic. Seed only when wanted.
   Verify `/`, `/admin`, authenticated website reads, and anonymous denial.

For local production-build verification use an HTTPS-shaped `CMS_URL` environment
value; the production origin validator rejects HTTP by design. Development
(`npm run dev`) supports HTTP localhost.

Rollback means restoring the matching application version **and** database/media
snapshot. `migrate:down` can destroy data; review the generated SQL before using it.
No hosting account, bucket, email provider, domain/TLS credentials, or frontend
deployment is included.

## 8. Production media, backups and troubleshooting

**Local uploads** go to private `./media`, served only through Payload's
access-controlled file route, not a public Next.js directory. Persist this directory
alongside the SQLite volume if S3 is off (`MEDIA_DIR=/var/lib/payload/media`).
Avoid release-folder deployments that
discard `media`. Allowed types are PNG/JPEG/WebP/GIF/AVIF/PDF; maximum size 10 MiB.
Treat uploaded PDFs as untrusted downloads.

**S3 (recommended for durable production assets):** set `S3_ENABLED=true`,
bucket/region/access credentials, and optional endpoint/path-style values from
`.env.example`. Use least-privilege credentials limited to that bucket and enable
Block Public Access, encryption, and object versioning. The adapter retains
Payload access checks; do not set `disablePayloadAccessControl=true`, expose
public bucket URLs, or bypass file routes through a CDN. Existing local objects
are not automatically migrated to S3: copy them and test before switching.
S3 functionality needs real provider credentials and has not been verified here.
The storage plugin always registers its media schema fields, even with S3 off,
so the committed migrations support both modes without production schema push.

**Backups:** schedule SQLite online backups (SQLite CLI `.backup`) or stop the
CMS before copying the database; a live raw copy can omit journal/WAL changes.
Back up private media/S3 versions and record the application/migration version
with each snapshot. Encrypt backups, restrict access, define retention, monitor
success, and regularly restore into an isolated environment. Retain secrets
separately in your secret manager, not in database exports or repository files.
Use a quiesced snapshot when database/media consistency is required.

| Symptom                                  | Check                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Missing env / invalid origin at startup  | All required variables; no trailing slash; HTTPS in production                                                            |
| SQLite missing tables in production      | Run committed migrations on the runtime database; check volume path and permissions                                       |
| Migration conflicts in local development | Use a fresh migration-test database, not a schema-pushed development database                                             |
| 401/403 or empty website results         | Exact `users API-Key` header, enabled key, website role, correct site assignment, active site, published + public records |
| Editor cannot save a relationship        | Related page/image belongs to another site, or required data is missing                                                   |
| Browser CORS / cookie failure            | Exact frontend allowlist, same-origin admin, TLS/proxy headers; do not weaken CSRF or expose API keys                     |
| Image 403/404                            | Publish the image, use an authorized same-site server proxy; check persisted media or S3 permissions                      |
| First admin form is absent               | The database already has users; use an existing administrator or your recovery procedure                                  |
| Password reset emails never arrive       | Configure an email adapter/provider; none is installed by default                                                         |
| Changes are not visible                  | Publish the new revision and related records; invalidate frontend caches                                                  |

## Verification

```sh
npm run test:int
npm run typecheck
npm run lint
npm run build
```

Integration tests use an isolated temporary SQLite database and real Payload
operations with access enforcement enabled. They cover editor isolation on lists,
IDs, create/update/delete/bulk/version operations; role/membership escalation;
cross-site draft relationships; assigned editor publishing; website read-only,
published/non-restricted access; anonymous denial; inactive sites; and shared
content. Test credentials are generated at runtime, not committed.
An additional schema test checks that local and S3 modes register identical
media fields without contacting a storage provider.

### Dependency audit status

Transitive DOMPurify and esbuild versions are pinned to patched releases via npm
overrides; recheck these when upgrading Payload. `npm audit` still reports the
upstream **Braces stack-exhaustion denial-of-service advisory**
(GHSA-vfj7-8cjw-p6xm) through Payload/Next tooling and storage-plugin dependencies.
There is currently no published patched Braces version. This application does
not accept user-supplied glob patterns; keep build/configuration inputs trusted,
do not expose tooling servers, and monitor upstream fixes. Do not apply audit's
suggested incompatible Payload/Next downgrades.
