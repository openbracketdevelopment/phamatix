import path from 'node:path'
import type { CollectionConfig } from 'payload'
import { enforceOwnership, siteAccess, siteFields } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'Site content' },
  access: siteAccess,
  hooks: { beforeChange: [enforceOwnership] },
  versions: { drafts: true, maxPerDoc: 25 },
  fields: [...siteFields, { name: 'alt', type: 'text', required: true }],
  upload: {
    staticDir: path.resolve(process.env.MEDIA_DIR || path.join(process.cwd(), 'media')),
    mimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
      'application/pdf',
    ],
  },
}
