const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const serverURL = required('CMS_URL')
export const secret = required('PAYLOAD_SECRET')
if (secret.length < 32) throw new Error('PAYLOAD_SECRET must have at least 32 characters.')

export const origins = (process.env.FRONTEND_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
for (const origin of [serverURL, ...origins]) {
  const url = new URL(origin)
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
    throw new Error(
      'CMS_URL and FRONTEND_ORIGINS must be exact HTTP(S) origins without trailing slashes.',
    )
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('Production origins must use HTTPS.')
  }
}

export const databaseURL = required('DATABASE_URL')
export const s3Enabled = process.env.S3_ENABLED === 'true'
export const s3 = s3Enabled
  ? {
      bucket: required('S3_BUCKET'),
      config: {
        region: required('S3_REGION'),
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        credentials: {
          accessKeyId: required('S3_ACCESS_KEY_ID'),
          secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
        },
      },
    }
  : undefined
