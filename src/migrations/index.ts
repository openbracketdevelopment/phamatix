import * as migration_20261019_071355_initial from './20261019_071355_initial'

export const migrations = [
  {
    up: migration_20261019_071355_initial.up,
    down: migration_20261019_071355_initial.down,
    name: '20261019_071355_initial',
  },
]
