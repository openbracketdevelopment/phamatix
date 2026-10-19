import * as migration_20261019_071355_initial from './20261019_071355_initial'
import * as migration_20261019_072220_storage_fields from './20261019_072220_storage_fields'

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
]
