import {
  APIError,
  type Access,
  type AccessResult,
  type CollectionBeforeChangeHook,
  type Field,
} from 'payload'
import type { User } from './payload-types'

type Relationship = number | { id: number }
export const relationshipID = (value: Relationship) =>
  typeof value === 'object' ? value.id : value

export const isAdmin = (user: Partial<User> | null | undefined) => user?.role === 'admin'
export const siteIDs = (user: Partial<User> | null | undefined) =>
  (user?.sites ?? []).map(relationshipID)

export const adminOnly: Access = ({ req }) => isAdmin(req.user)
export const siteRecordRead: Access = async ({ req }) => {
  const { user } = req
  if (isAdmin(user)) return true
  if (!user) return false
  const ids = siteIDs(user)
  if (user.role === 'editor') return { site: { in: ids } }
  if (user.role !== 'website' || !ids.length) return false
  const sites = await req.payload.find({
    collection: 'sites',
    where: { and: [{ id: { in: ids } }, { active: { equals: true } }] },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  return { site: { in: sites.docs.map((site) => site.id) } }
}

export const siteRead: Access = async ({ req }): Promise<AccessResult> => {
  const { user } = req
  if (isAdmin(user)) return true
  if (!user) return false
  const ids = siteIDs(user)
  if (user.role === 'editor') return { site: { in: ids } }
  if (user.role !== 'website' || !ids.length) return false
  const sites = await req.payload.find({
    collection: 'sites',
    where: { and: [{ id: { in: ids } }, { active: { equals: true } }] },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  return {
    and: [
      { site: { in: sites.docs.map((site) => site.id) } },
      { _status: { equals: 'published' } },
      { visibility: { equals: 'public' } },
    ],
  }
}

export const siteWrite: Access = ({ req }) => {
  if (isAdmin(req.user)) return true
  if (req.user?.role !== 'editor') return false
  return { site: { in: siteIDs(req.user) } }
}

export const siteCreate: Access = ({ req, data }) =>
  isAdmin(req.user) ||
  (req.user?.role === 'editor' &&
    Boolean(data?.site) &&
    siteIDs(req.user).includes(relationshipID(data.site)))

const siteVersions: Access = ({ req }) => {
  if (isAdmin(req.user)) return true
  if (req.user?.role !== 'editor') return false
  return { 'version.site': { in: siteIDs(req.user) } }
}

export const siteFields: Field[] = [
  {
    name: 'site',
    type: 'relationship',
    relationTo: 'sites',
    required: true,
    index: true,
    admin: { position: 'sidebar', description: 'Owner. Cannot be changed after creation.' },
    filterOptions: ({ user }) => (isAdmin(user) ? true : { id: { in: siteIDs(user) } }),
  },
  {
    name: 'visibility',
    type: 'select',
    required: true,
    defaultValue: 'public',
    options: ['public', 'restricted'],
    admin: {
      position: 'sidebar',
      description: 'Restricted content is never served to website keys.',
    },
  },
]

export const siteAccess = {
  create: siteCreate,
  read: siteRead,
  update: siteWrite,
  delete: siteWrite,
  readVersions: siteVersions,
}

// Run on drafts too: field validation alone is skipped when saving a draft.
export const enforceOwnership: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
  collection,
}) => {
  const doc = { ...originalDoc, ...data }
  const site = doc.site && relationshipID(doc.site)
  if (!site) throw new APIError('A site is required, including for drafts.', 400)
  if (originalDoc?.site && relationshipID(originalDoc.site) !== site) {
    throw new APIError('Content cannot be moved between sites.', 400)
  }
  if (!isAdmin(req.user) && !siteIDs(req.user).includes(site)) {
    throw new APIError('You are not assigned to this site.', 403)
  }
  const references: { collection: 'pages' | 'media' | 'categories'; id: number }[] = []
  const addReferences = (collection: 'pages' | 'media' | 'categories', values: unknown) => {
    const items = Array.isArray(values) ? values : [values]
    for (const value of items) {
      const id =
        typeof value === 'number'
          ? value
          : typeof value === 'object' &&
              value !== null &&
              'id' in value &&
              typeof value.id === 'number'
            ? value.id
            : undefined
      if (id !== undefined) references.push({ collection, id })
    }
  }
  if (collection.slug === 'pages' && doc.hero) {
    addReferences('media', doc.hero)
  }
  if (collection.slug === 'pages') {
    addReferences('categories', doc.categories)
    for (const block of doc.layout ?? []) {
      if (block.blockType === 'hero') addReferences('media', block.image)
      if (block.blockType === 'gallery') {
        for (const item of block.images ?? []) addReferences('media', item.image)
      }
    }
  }
  if (collection.slug === 'seo-settings' && doc.image) {
    addReferences('media', doc.image)
  }
  if (collection.slug === 'navigation') {
    for (const link of doc.links ?? []) {
      if (link.page) addReferences('pages', link.page)
    }
  }
  for (const reference of references) {
    const related = await req.payload.findByID({
      collection: reference.collection,
      id: reference.id,
      depth: 0,
      overrideAccess: false,
      req,
    })
    if (relationshipID(related.site) !== site) {
      throw new APIError('Related content must belong to the same site.', 400)
    }
  }
  return data
}
