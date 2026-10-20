import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import type { Payload } from 'payload'
import type { User, Site, Page } from '../../src/payload-types'

let payload: Payload
let directory: string
let admin: User
let editor: User
let website: User
let alpha: Site
let bravo: Site
let home: Page
let foreign: Page

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'payload-isolation-'))
  process.env.DATABASE_URL = `file:${directory}/test.db`
  process.env.CMS_URL = 'http://localhost:3000'
  process.env.PAYLOAD_SECRET = randomBytes(32).toString('hex')
  process.env.S3_ENABLED = 'false'
  process.env.MEDIA_DIR = path.join(directory, 'media')
  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config')
  payload = await getPayload({ config })
  admin = await payload.create({
    collection: 'users',
    data: {
      email: 'admin@example.test',
      password: randomBytes(24).toString('hex'),
      role: 'editor',
    },
  })
  for (const identifier of ['alpha', 'bravo']) {
    const site = await payload.create({
      collection: 'sites',
      data: {
        name: identifier,
        identifier,
        active: true,
        locale: 'en',
        timezone: 'UTC',
        domains: [{ origin: `https://${identifier}.example.test` }],
      },
    })
    if (identifier === 'alpha') alpha = site
    else bravo = site
  }
  editor = await payload.create({
    collection: 'users',
    data: {
      email: 'editor@example.test',
      password: randomBytes(24).toString('hex'),
      role: 'editor',
      sites: [alpha.id],
    },
  })
  website = await payload.create({
    collection: 'users',
    data: {
      email: 'website@example.test',
      password: randomBytes(24).toString('hex'),
      role: 'website',
      sites: [alpha.id],
    },
  })
  for (const site of [alpha, bravo]) {
    const page = await payload.create({
      collection: 'pages',
      user: admin,
      overrideAccess: false,
      data: {
        site: site.id,
        visibility: 'public',
        title: site.name,
        slug: 'home',
        body: 'Published body',
        _status: 'published',
      },
    })
    if (site.id === alpha.id) home = page
    else foreign = page
    await payload.create({
      collection: 'pages',
      user: admin,
      overrideAccess: false,
      draft: true,
      data: {
        site: site.id,
        title: 'Draft',
        slug: 'draft',
        body: 'Draft secret',
        _status: 'draft',
      },
    })
    await payload.create({
      collection: 'pages',
      user: admin,
      overrideAccess: false,
      data: {
        site: site.id,
        title: 'Private',
        slug: 'private',
        body: 'Restricted secret',
        visibility: 'restricted',
        _status: 'published',
      },
    })
  }
})

afterAll(async () => {
  await payload?.destroy()
  if (directory) await rm(directory, { recursive: true, force: true })
})

describe('server-side site boundaries', () => {
  it('bootstraps the first user as an administrator', () => {
    expect(admin.role).toBe('admin')
  })

  it('limits editor list and direct ID reads, including drafts and versions', async () => {
    const pages = await payload.find({
      collection: 'pages',
      user: editor,
      overrideAccess: false,
      draft: true,
    })
    expect(pages.docs).toHaveLength(3)
    expect(
      pages.docs.every((page) =>
        typeof page.site === 'object' ? page.site.id === alpha.id : page.site === alpha.id,
      ),
    ).toBe(true)
    await expect(
      payload.findByID({
        collection: 'pages',
        id: foreign.id,
        user: editor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    const versions = await payload.findVersions({
      collection: 'pages',
      user: editor,
      overrideAccess: false,
    })
    expect(versions.docs.length).toBeGreaterThan(0)
    expect(
      versions.docs.every(
        (version) =>
          version.version.site === alpha.id ||
          (typeof version.version.site === 'object' && version.version.site?.id === alpha.id),
      ),
    ).toBe(true)
    const otherVersions = await payload.findVersions({
      collection: 'pages',
      where: { parent: { equals: foreign.id } },
    })
    const otherVersion = otherVersions.docs[0]
    await expect(
      payload.findVersionByID({
        collection: 'pages',
        id: otherVersion.id,
        user: editor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.restoreVersion({
        collection: 'pages',
        id: otherVersion.id,
        user: editor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  describe('all starter collections', () => {
    it('protects navigation, SEO and uploaded media with the same site boundaries', async () => {
      const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'blue' } })
        .png()
        .toBuffer()
      const image = await payload.create({
        collection: 'media',
        user: admin,
        overrideAccess: false,
        data: { site: bravo.id, visibility: 'public', alt: 'Bravo image', _status: 'published' },
        file: {
          data: png,
          name: `${randomBytes(8).toString('hex')}.png`,
          mimetype: 'image/png',
          size: png.length,
        },
      })
      const navigation = await payload.create({
        collection: 'navigation',
        user: admin,
        overrideAccess: false,
        data: {
          site: bravo.id,
          visibility: 'public',
          key: 'main',
          title: 'Bravo navigation',
          links: [{ label: 'Home', page: foreign.id }],
          _status: 'published',
        },
      })
      const seo = await payload.create({
        collection: 'seo-settings',
        user: admin,
        overrideAccess: false,
        data: {
          site: bravo.id,
          visibility: 'public',
          title: 'Bravo SEO',
          description: 'Bravo only',
          image: image.id,
          _status: 'published',
        },
      })
      for (const [collection, id] of [
        ['media', image.id],
        ['navigation', navigation.id],
        ['seo-settings', seo.id],
      ] as const) {
        await expect(
          payload.findByID({ collection, id, user: editor, overrideAccess: false }),
        ).rejects.toThrow()
        await expect(
          payload.findByID({ collection, id, user: website, overrideAccess: false }),
        ).rejects.toThrow()
        await expect(
          payload.update({
            collection,
            id,
            user: editor,
            overrideAccess: false,
            data: { visibility: 'restricted' },
          }),
        ).rejects.toThrow()
        await expect(
          payload.delete({ collection, id, user: editor, overrideAccess: false }),
        ).rejects.toThrow()
        await expect(payload.find({ collection, overrideAccess: false })).rejects.toThrow()
      }
      await expect(
        payload.update({
          collection: 'pages',
          id: home.id,
          user: admin,
          overrideAccess: false,
          draft: true,
          data: { hero: image.id },
        }),
      ).rejects.toThrow('Related content must belong to the same site.')
      await expect(
        payload.update({
          collection: 'pages',
          id: home.id,
          user: admin,
          overrideAccess: false,
          draft: true,
          data: {
            layout: [{ blockType: 'gallery', images: [{ image: image.id }] }],
          },
        }),
      ).rejects.toThrow('Related content must belong to the same site.')
      await payload.delete({ collection: 'media', id: image.id })
    })
  })

  it('rejects cross-site create, update, delete and bulk updates', async () => {
    await expect(
      payload.create({
        collection: 'pages',
        user: editor,
        overrideAccess: false,
        data: {
          site: bravo.id,
          visibility: 'public',
          title: 'Attack',
          slug: 'attack',
          body: 'Attack',
        },
      }),
    ).rejects.toThrow()
    await expect(
      payload.update({
        collection: 'pages',
        id: foreign.id,
        user: editor,
        overrideAccess: false,
        data: { title: 'Attack' },
      }),
    ).rejects.toThrow()
    await expect(
      payload.delete({ collection: 'pages', id: foreign.id, user: editor, overrideAccess: false }),
    ).rejects.toThrow()
    const bulk = await payload.update({
      collection: 'pages',
      where: { site: { equals: bravo.id } },
      user: editor,
      overrideAccess: false,
      data: { title: 'Attack' },
    })
    expect(bulk.docs).toHaveLength(0)
    await expect(
      payload.update({
        collection: 'pages',
        id: home.id,
        user: editor,
        overrideAccess: false,
        draft: true,
        data: { site: bravo.id },
      }),
    ).rejects.toThrow()
  })

  it('prevents privilege escalation and cross-site relationships even on drafts', async () => {
    await expect(
      payload.update({
        collection: 'users',
        id: editor.id,
        user: editor,
        overrideAccess: false,
        data: { role: 'admin', sites: [bravo.id] },
      }),
    ).rejects.toThrow()
    await expect(
      payload.create({
        collection: 'sites',
        user: editor,
        overrideAccess: false,
        data: {
          name: 'Attack',
          identifier: 'attack',
          active: true,
          locale: 'en',
          timezone: 'UTC',
          domains: [{ origin: 'https://attack.example.test' }],
        },
      }),
    ).rejects.toThrow()
    await expect(
      payload.create({
        collection: 'navigation',
        user: admin,
        overrideAccess: false,
        draft: true,
        data: {
          site: alpha.id,
          title: 'Bad reference',
          key: 'bad',
          links: [{ label: 'Cross site', page: foreign.id }],
        },
      }),
    ).rejects.toThrow('Related content must belong to the same site.')

    const category = await payload.create({
      collection: 'categories',
      user: admin,
      overrideAccess: false,
      data: { site: bravo.id, name: 'Bravo category', slug: 'bravo-category' },
    })
    await expect(
      payload.create({
        collection: 'pages',
        user: admin,
        overrideAccess: false,
        draft: true,
        data: {
          site: alpha.id,
          title: 'Bad category reference',
          slug: 'bad-category-reference',
          body: 'Cross-site category',
          categories: [category.id],
        },
      }),
    ).rejects.toThrow('Related content must belong to the same site.')
    await expect(
      payload.findByID({
        collection: 'categories',
        id: category.id,
        user: editor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('allows assigned editors to create, publish and edit their own content', async () => {
    const page = await payload.create({
      collection: 'pages',
      user: editor,
      overrideAccess: false,
      draft: true,
      data: { site: alpha.id, title: 'Editor page', slug: 'editor-page', body: 'Editor body' },
    })
    const updated = await payload.update({
      collection: 'pages',
      id: page.id,
      user: editor,
      overrideAccess: false,
      data: { title: 'Published by editor', _status: 'published' },
    })
    expect(updated._status).toBe('published')
    await payload.delete({ collection: 'pages', id: page.id, user: editor, overrideAccess: false })
  })

  it('allows editors to create site categories and reorderable page-builder blocks', async () => {
    const category = await payload.create({
      collection: 'categories',
      user: editor,
      overrideAccess: false,
      data: { site: alpha.id, name: 'News', slug: 'news' },
    })
    const page = await payload.create({
      collection: 'pages',
      user: editor,
      overrideAccess: false,
      draft: true,
      data: {
        site: alpha.id,
        title: 'Flexible page',
        slug: 'flexible-page',
        categories: [category.id],
        layout: [
          { blockType: 'hero', heading: 'Welcome', subheading: 'A subtitle' },
          { blockType: 'text', text: 'Main text', subText: 'Supporting text' },
          { blockType: 'gallery', heading: 'Photos', images: [] },
        ],
      },
    })

    expect(page.categories?.map((item) => (typeof item === 'number' ? item : item.id))).toEqual([
      category.id,
    ])
    expect(page.layout?.map((block) => block.blockType)).toEqual(['hero', 'text', 'gallery'])
  })
})

describe('published website and public reads', () => {
  it('requires authentication for site content', async () => {
    await expect(payload.find({ collection: 'pages', overrideAccess: false })).rejects.toThrow()
    await expect(
      payload.findByID({ collection: 'pages', id: home.id, overrideAccess: false, draft: true }),
    ).rejects.toThrow()
    await expect(
      payload.create({
        collection: 'users',
        overrideAccess: false,
        data: {
          email: 'attack@example.test',
          password: randomBytes(24).toString('hex'),
          role: 'admin',
        },
      }),
    ).rejects.toThrow()
  })

  it('only serves assigned, published, non-restricted content regardless of query filters', async () => {
    for (const draft of [false, true]) {
      const pages = await payload.find({
        collection: 'pages',
        user: website,
        overrideAccess: false,
        draft,
      })
      expect(pages.docs.map((page) => page.id)).toEqual([home.id])
    }
    await expect(
      payload.findByID({
        collection: 'pages',
        id: foreign.id,
        user: website,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.findVersions({ collection: 'pages', user: website, overrideAccess: false }),
    ).rejects.toThrow()
    await expect(
      payload.update({
        collection: 'pages',
        id: home.id,
        user: website,
        overrideAccess: false,
        data: { title: 'Attack' },
      }),
    ).rejects.toThrow()
  })

  it('does not leak a draft revision of a published document', async () => {
    await payload.update({
      collection: 'pages',
      id: home.id,
      user: editor,
      overrideAccess: false,
      draft: true,
      data: { body: 'UNPUBLISHED REVISION', _status: 'draft' },
    })
    for (const draft of [false, true]) {
      const result = await payload.find({
        collection: 'pages',
        user: website,
        overrideAccess: false,
        draft,
      })
      expect(JSON.stringify(result)).not.toContain('UNPUBLISHED REVISION')
    }
  })

  it('blocks website reads when its site is inactive', async () => {
    await payload.update({ collection: 'sites', id: alpha.id, data: { active: false } })
    const result = await payload.find({ collection: 'pages', user: website, overrideAccess: false })
    expect(result.docs).toHaveLength(0)
    await payload.update({ collection: 'sites', id: alpha.id, data: { active: true } })
  })

  it('exposes shared published content but not shared drafts', async () => {
    const shared = await payload.create({
      collection: 'shared-content',
      data: { key: 'public', title: 'Shared', body: 'Public', _status: 'published' },
    })
    await payload.create({
      collection: 'shared-content',
      draft: true,
      data: { key: 'draft', title: 'Draft shared', body: 'Hidden', _status: 'draft' },
    })
    const result = await payload.find({
      collection: 'shared-content',
      overrideAccess: false,
      draft: true,
    })
    expect(result.docs.map((doc) => doc.id)).toEqual([shared.id])
    await expect(
      payload.update({
        collection: 'shared-content',
        id: shared.id,
        user: editor,
        overrideAccess: false,
        data: { body: 'Attack' },
      }),
    ).rejects.toThrow()
  })
})
