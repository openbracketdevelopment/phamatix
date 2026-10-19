import type { CollectionConfig } from 'payload'
import { adminOnly, enforceOwnership, siteAccess, siteFields } from '../access'

const siteContent = {
  admin: { group: 'Site content', useAsTitle: 'title' },
  access: siteAccess,
  hooks: { beforeChange: [enforceOwnership] },
  versions: { drafts: true, maxPerDoc: 25 },
} satisfies Partial<CollectionConfig>

export const Pages: CollectionConfig = {
  ...siteContent,
  slug: 'pages',
  indexes: [{ fields: ['site', 'slug'], unique: true }],
  fields: [
    ...siteFields,
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      validate: (value: string | null | undefined) =>
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? '') || 'Use a lowercase URL-safe slug.',
    },
    { name: 'body', type: 'textarea', required: true },
    { name: 'hero', type: 'upload', relationTo: 'media' },
    { name: 'seoTitle', type: 'text' },
    { name: 'seoDescription', type: 'textarea' },
  ],
}

export const Navigation: CollectionConfig = {
  ...siteContent,
  slug: 'navigation',
  indexes: [{ fields: ['site', 'key'], unique: true }],
  fields: [
    ...siteFields,
    { name: 'title', type: 'text', required: true },
    { name: 'key', type: 'text', required: true, defaultValue: 'main' },
    {
      name: 'links',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'page', type: 'relationship', relationTo: 'pages', required: true },
      ],
    },
  ],
}

export const SEOSettings: CollectionConfig = {
  ...siteContent,
  slug: 'seo-settings',
  indexes: [{ fields: ['site'], unique: true }],
  fields: [
    ...siteFields,
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea', required: true },
    { name: 'image', type: 'upload', relationTo: 'media' },
    {
      name: 'robots',
      type: 'select',
      options: ['index,follow', 'noindex,nofollow'],
      defaultValue: 'index,follow',
    },
  ],
}

export const SharedContent: CollectionConfig = {
  slug: 'shared-content',
  admin: { group: 'Shared — all websites', useAsTitle: 'title' },
  access: {
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
    readVersions: adminOnly,
    read: ({ req }) => req.user?.role === 'admin' || { _status: { equals: 'published' } },
  },
  versions: { drafts: true, maxPerDoc: 25 },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true },
  ],
}
