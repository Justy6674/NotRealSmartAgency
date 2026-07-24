import { FlatCompat } from '@eslint/eslintrc'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import typescriptEslint from '@typescript-eslint/eslint-plugin'

const baseDirectory = dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory })

const config = [
  ...compat.extends('next/core-web-vitals'),
  {
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**'],
  },
]

export default config
