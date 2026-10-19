import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`media\` ADD \`prefix\` text DEFAULT '';`)
  await db.run(sql`ALTER TABLE \`media\` ADD \`_objectkey\` text;`)
  await db.run(sql`ALTER TABLE \`_media_v\` ADD \`version_prefix\` text DEFAULT '';`)
  await db.run(sql`ALTER TABLE \`_media_v\` ADD \`version__objectkey\` text;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`prefix\`;`)
  await db.run(sql`ALTER TABLE \`media\` DROP COLUMN \`_objectkey\`;`)
  await db.run(sql`ALTER TABLE \`_media_v\` DROP COLUMN \`version_prefix\`;`)
  await db.run(sql`ALTER TABLE \`_media_v\` DROP COLUMN \`version__objectkey\`;`)
}
