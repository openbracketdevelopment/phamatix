import { getPayload } from 'payload'
import config from './payload.config'
import { seedExamples } from './seed-data'

const payload = await getPayload({ config })
try {
  const admins = await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    limit: 1,
  })
  let admin = admins.docs[0]
  if (!admin) {
    const email = process.env.SEED_ADMIN_EMAIL
    const password = process.env.SEED_ADMIN_PASSWORD
    if (!email || !password || password.length < 16) {
      throw new Error(
        'Create an administrator in /admin first, or set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (16+ characters).',
      )
    }
    admin = await payload.create({ collection: 'users', data: { email, password, role: 'admin' } })
  }
  await seedExamples(payload, admin)
  payload.logger.info(
    'Example sites ready. Create assigned editors and website API keys in /admin.',
  )
} finally {
  await payload.destroy()
}
