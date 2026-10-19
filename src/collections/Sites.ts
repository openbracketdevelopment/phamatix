import type { CollectionConfig } from 'payload'
import { adminOnly, isAdmin, siteIDs } from '../access'

export const Sites: CollectionConfig = {
  slug: 'sites',
  admin: { useAsTitle: 'name', group: 'Configuration' },
  access: {
    create: adminOnly,
    read: ({ req }) => isAdmin(req.user) || { id: { in: siteIDs(req.user) } },
    update: adminOnly,
    delete: () => false,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'identifier',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      validate: (value: string | null | undefined) =>
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? '') || 'Use a lowercase URL-safe identifier.',
    },
    {
      name: 'domains',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          name: 'origin',
          type: 'text',
          required: true,
          validate: (value: string | null | undefined) => {
            try {
              const url = new URL(value ?? '')
              return (
                (['http:', 'https:'].includes(url.protocol) && url.origin === value) ||
                'Enter an exact HTTP(S) origin, without a path or trailing slash.'
              )
            } catch {
              return 'Enter a valid HTTP(S) origin.'
            }
          },
        },
      ],
    },
    { name: 'active', type: 'checkbox', defaultValue: true, required: true },
    { name: 'locale', type: 'text', required: true, defaultValue: 'en' },
    { name: 'timezone', type: 'text', required: true, defaultValue: 'UTC' },
    {
      name: 'previewURL',
      type: 'text',
      admin: {
        description:
          'Frontend preview entrypoint; configure its secret separately on the frontend.',
      },
    },
  ],
}
