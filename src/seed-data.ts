import type { Payload } from 'payload'
import type { User } from './payload-types'
import sharp from 'sharp'

export async function seedExamples(payload: Payload, admin: User) {
  const file = await sharp({
    create: { width: 32, height: 32, channels: 3, background: '#245b78' },
  })
    .png()
    .toBuffer()

  for (const identifier of ['alpha', 'bravo']) {
    const existing = await payload.find({
      collection: 'sites',
      where: { identifier: { equals: identifier } },
      limit: 1,
    })
    const site =
      existing.docs[0] ??
      (await payload.create({
        collection: 'sites',
        user: admin,
        overrideAccess: false,
        data: {
          name: `${identifier.toUpperCase()} website`,
          identifier,
          domains: [
            { origin: identifier === 'alpha' ? 'http://localhost:3001' : 'http://localhost:3002' },
          ],
          active: true,
          locale: 'en',
          timezone: 'UTC',
        },
      }))
    const existingPages = await payload.count({
      collection: 'pages',
      where: { site: { equals: site.id } },
    })
    // Never overwrite content that has already been edited.
    if (existingPages.totalDocs) continue

    const media = await payload.create({
      collection: 'media',
      user: admin,
      overrideAccess: false,
      data: {
        site: site.id,
        visibility: 'public',
        alt: `${identifier} sample image`,
        _status: 'published',
      },
      file: {
        data: file,
        mimetype: 'image/png',
        name: `${identifier}-sample.png`,
        size: file.length,
      },
    })
    const page = await payload.create({
      collection: 'pages',
      user: admin,
      overrideAccess: false,
      data: {
        site: site.id,
        visibility: 'public',
        title: `Welcome to ${identifier}`,
        slug: 'home',
        body: `Published content owned by ${identifier}.`,
        hero: media.id,
        _status: 'published',
      },
    })
    await payload.create({
      collection: 'pages',
      user: admin,
      overrideAccess: false,
      draft: true,
      data: {
        site: site.id,
        title: 'Work in progress',
        slug: 'draft',
        body: 'Not for websites.',
        _status: 'draft',
      },
    })
    await payload.create({
      collection: 'pages',
      user: admin,
      overrideAccess: false,
      data: {
        site: site.id,
        title: 'Internal only',
        slug: 'internal',
        body: 'Restricted content.',
        visibility: 'restricted',
        _status: 'published',
      },
    })
    await payload.create({
      collection: 'navigation',
      user: admin,
      overrideAccess: false,
      data: {
        site: site.id,
        visibility: 'public',
        title: 'Main navigation',
        key: 'main',
        links: [{ label: 'Home', page: page.id }],
        _status: 'published',
      },
    })
    await payload.create({
      collection: 'seo-settings',
      user: admin,
      overrideAccess: false,
      data: {
        site: site.id,
        visibility: 'public',
        title: `${identifier} website`,
        description: `Default SEO for ${identifier}.`,
        image: media.id,
        _status: 'published',
      },
    })
  }
  const shared = await payload.count({
    collection: 'shared-content',
    where: { key: { equals: 'footer' } },
  })
  if (!shared.totalDocs) {
    await payload.create({
      collection: 'shared-content',
      data: {
        key: 'footer',
        title: 'Shared footer',
        body: 'Available to every website.',
        _status: 'published',
      },
    })
  }
}
