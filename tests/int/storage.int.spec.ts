import { randomBytes } from 'node:crypto'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { s3Storage } from '@payloadcms/storage-s3'
import { buildConfig } from 'payload'
import { describe, expect, it } from 'vitest'
import { Media } from '../../src/collections/Media'
import { Sites } from '../../src/collections/Sites'
import { Users } from '../../src/collections/Users'

describe('storage schema stability', () => {
  it('retains identical media columns when switching between local and S3 storage', async () => {
    const configs = await Promise.all(
      [false, true].map((enabled) =>
        buildConfig({
          secret: randomBytes(32).toString('hex'),
          db: sqliteAdapter({ client: { url: 'file::memory:' } }),
          collections: [Users, Sites, Media],
          plugins: [
            s3Storage({
              enabled,
              alwaysInsertFields: true,
              bucket: 'schema-test-only',
              config: { region: 'us-east-1' },
              collections: { media: true },
            }),
          ],
        }),
      ),
    )
    const columns = configs.map((config) =>
      config.collections
        .find((collection) => collection.slug === 'media')!
        .fields.flatMap((field) => ('name' in field ? [field.name] : []))
        .sort(),
    )
    expect(columns[0]).toContain('_objectKey')
    expect(columns[0]).toEqual(columns[1])
  })
})
