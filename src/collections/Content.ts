import type { CollectionConfig } from 'payload'
import {
  adminOnly,
  enforceOwnership,
  isAdmin,
  siteAccess,
  siteFields,
  siteRecordRead,
  siteIDs,
  siteWrite,
  siteCreate,
} from '../access'

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
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      filterOptions: ({ data }) =>
        data?.site
          ? {
              site: {
                equals:
                  typeof data.site === 'object' && data.site !== null ? data.site.id : data.site,
              },
            }
          : true,
    },
    {
      name: 'body',
      type: 'textarea',
      admin: { description: 'Optional plain-text content for pages without layout blocks.' },
    },
    { name: 'hero', type: 'upload', relationTo: 'media' },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [
        {
          slug: 'hero',
          labels: { singular: 'Hero', plural: 'Hero sections' },
          fields: [
            { name: 'heading', type: 'text', required: true },
            { name: 'subheading', type: 'text' },
            { name: 'image', type: 'upload', relationTo: 'media' },
          ],
        },
        {
          slug: 'text',
          labels: { singular: 'Text section', plural: 'Text sections' },
          fields: [
            { name: 'text', type: 'textarea', required: true },
            { name: 'subText', type: 'textarea' },
          ],
        },
        {
          slug: 'gallery',
          labels: { singular: 'Gallery', plural: 'Galleries' },
          fields: [
            { name: 'heading', type: 'text' },
            {
              name: 'images',
              type: 'array',
              fields: [{ name: 'image', type: 'upload', relationTo: 'media', required: true }],
            },
          ],
        },
      ],
    },
    { name: 'seoTitle', type: 'text' },
    { name: 'seoDescription', type: 'textarea' },
  ],
}

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: { group: 'Site content', useAsTitle: 'name' },
  access: {
    create: siteCreate,
    read: siteRecordRead,
    update: siteWrite,
    delete: siteWrite,
  },
  hooks: { beforeChange: [enforceOwnership] },
  indexes: [{ fields: ['site', 'slug'], unique: true }],
  fields: [
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
      filterOptions: ({ user }) => (isAdmin(user) ? true : { id: { in: siteIDs(user) } }),
    },
    { name: 'name', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      validate: (value: string | null | undefined) =>
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? '') || 'Use a lowercase URL-safe slug.',
    },
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
