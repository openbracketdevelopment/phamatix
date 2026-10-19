import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: ['.next/**', 'src/payload-types.ts', 'src/app/(payload)/admin/importMap.js'],
  },
]

export default config
