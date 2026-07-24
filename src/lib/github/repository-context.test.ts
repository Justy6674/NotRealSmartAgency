import assert from 'node:assert/strict'
import test from 'node:test'
import { PRODUCT_CONTEXT_PATHS, appendRepositoryContext } from './repository-context'

test('includes recognised product documentation paths', () => {
  assert.ok(PRODUCT_CONTEXT_PATHS.includes('docs/CAPABILITY-MAP.md'))
})

test('labels and appends repository product context', () => {
  assert.equal(
    appendRepositoryContext('GitHub Repository: owner/repo', 'docs/PRODUCT.md', 'Real product facts'),
    'GitHub Repository: owner/repo\n\nProduct context (docs/PRODUCT.md):\nReal product facts',
  )
})
