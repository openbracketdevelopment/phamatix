import * as migration_20261019_071355_initial from './20261019_071355_initial'
import * as migration_20261019_072220_storage_fields from './20261019_072220_storage_fields'
import * as migration_20261020_034149 from './20261020_034149'

export const migrations = [
  {
    up: migration_20261019_071355_initial.up,
    down: migration_20261019_071355_initial.down,
    name: '20261019_071355_initial',
  },
  {
    up: migration_20261019_072220_storage_fields.up,
    down: migration_20261019_072220_storage_fields.down,
    name: '20261019_072220_storage_fields',
  },
  {
    up: migration_20261020_034149.up,
    down: migration_20261020_034149.down,
    name: '20261020_034149',
  },
]
