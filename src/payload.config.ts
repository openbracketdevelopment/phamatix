import { sqliteAdapter } from '@payloadcms/db-sqlite'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { s3Storage } from '@payloadcms/storage-s3'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Sites } from './collections/Sites'
import { Navigation, Pages, SEOSettings, SharedContent } from './collections/Content'
import { databaseURL, origins, s3, secret, serverURL } from './environment'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  serverURL,
  cors: [serverURL, ...origins],
  csrf: [serverURL],
  graphQL: { disable: true },
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Sites, Pages, Navigation, Media, SEOSettings, SharedContent],
  secret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: sqliteAdapter({
    client: {
      url: databaseURL,
    },
    push: process.env.NODE_ENV !== 'production',
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
  upload: { limits: { fileSize: 10 * 1024 * 1024 } },
  plugins: [
    s3Storage({
      bucket: s3?.bucket ?? '',
      config: s3?.config ?? {},
      enabled: Boolean(s3),
      alwaysInsertFields: true,
      collections: { media: true },
    }),
  ],
})
