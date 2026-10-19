import type { CollectionConfig } from 'payload'
import type { User } from '../payload-types'
import { adminOnly, isAdmin } from '../access'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: { useAsTitle: 'email' },
  auth: {
    useAPIKey: true,
    tokenExpiration: 7200,
    maxLoginAttempts: 5,
    lockTime: 600000,
    cookies: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
    },
  },
  access: {
    admin: ({ req }) => isAdmin(req.user) || req.user?.role === 'editor',
    create: adminOnly,
    read: ({ req }) => isAdmin(req.user) || (req.user ? { id: { equals: req.user.id } } : false),
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation === 'create') {
          const { totalDocs } = await req.payload.count({ collection: 'users', req })
          if (totalDocs === 0) {
            data.role = 'admin'
            data.sites = []
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: ['admin', 'editor', 'website'],
      access: { update: ({ req }) => isAdmin(req.user) },
    },
    {
      name: 'sites',
      type: 'relationship',
      relationTo: 'sites',
      hasMany: true,
      access: { update: ({ req }) => isAdmin(req.user) },
      admin: { description: 'Editors: assigned sites. Website accounts: assign exactly one site.' },
      validate: (value, { data }) =>
        (data as Partial<User>)?.role !== 'website' || (Array.isArray(value) && value.length === 1)
          ? true
          : 'Website accounts must be assigned exactly one site.',
    },
  ],
}
