import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PRODUCT_CONTEXT_PATHS,
  appendRepositoryContext,
  repositoryContentUnavailableMessage,
} from './repository-context'

test('includes recognised product documentation paths', () => {
  assert.ok(PRODUCT_CONTEXT_PATHS.includes('docs/CAPABILITY-MAP.md'))
})

test('labels and appends repository product context', () => {
  assert.equal(
    appendRepositoryContext('GitHub Repository: owner/repo', 'docs/PRODUCT.md', 'Real product facts'),
    'GitHub Repository: owner/repo\n\nProduct context (docs/PRODUCT.md):\nReal product facts',
  )
})

test('explains when a repository sync returned no readable source files', () => {
  assert.equal(
    repositoryContentUnavailableMessage([false, false, false]),
    'GitHub did not return any readable repository context. For a private repository, configure a read-only GITHUB_TOKEN for this deployment.',
  )
  assert.equal(repositoryContentUnavailableMessage([true, false]), null)
})
