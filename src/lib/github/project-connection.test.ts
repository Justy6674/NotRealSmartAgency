import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GITHUB_PRODUCT_CONTEXT_PATHS,
  hashGitHubConnectState,
  isAllowedGitHubProductPath,
  matchProjectsToInstalledRepositories,
  normaliseGitHubRepositoryUrl,
  redactRepositoryProductText,
  selectRepositoryForProject,
} from './project-connection.ts'

test('normalises GitHub URLs without accepting a path outside an owner/repository pair', () => {
  assert.equal(normaliseGitHubRepositoryUrl('https://github.com/Justy6674/DoToday.git/'), 'justy6674/dotoday')
  assert.equal(normaliseGitHubRepositoryUrl('github.com/Justy6674/DoToday'), 'justy6674/dotoday')
  assert.equal(normaliseGitHubRepositoryUrl('https://example.com/Justy6674/DoToday'), null)
  assert.equal(normaliseGitHubRepositoryUrl('https://github.com/Justy6674'), null)
})

test('stores only a hash of a Telegram-issued GitHub connection state', () => {
  const state = 'a'.repeat(43)
  assert.notEqual(hashGitHubConnectState(state), state)
  assert.equal(hashGitHubConnectState(state), hashGitHubConnectState(state))
})

test('allows only the explicit product-document read surface', () => {
  assert.ok(GITHUB_PRODUCT_CONTEXT_PATHS.includes('README.md'))
  assert.equal(isAllowedGitHubProductPath('docs/PRODUCT.md'), true)
  assert.equal(isAllowedGitHubProductPath('.env.production'), false)
  assert.equal(isAllowedGitHubProductPath('supabase/dumps/patients.sql'), false)
})

test('binds a project only to its exact configured repository', () => {
  const repositories = [
    { id: 1, fullName: 'Justy6674/DoToday' },
    { id: 2, fullName: 'Justy6674/ScentSell' },
  ]

  assert.deepEqual(selectRepositoryForProject('https://github.com/Justy6674/DoToday', repositories), repositories[0])
  assert.equal(selectRepositoryForProject('https://github.com/Justy6674/NotThere', repositories), null)
})

test('does not bind an installed repository when its project has no exact GitHub URL', () => {
  const repositories = [
    { id: 1, fullName: 'Justy6674/DoToday' },
    { id: 2, fullName: 'Justy6674/ScentSell' },
  ]
  assert.deepEqual(matchProjectsToInstalledRepositories([
    { brandId: 'do-today', repositoryUrl: 'https://github.com/Justy6674/DoToday' },
    { brandId: 'endorse-me', repositoryUrl: null },
  ], repositories), [{
    brandId: 'do-today',
    repository: repositories[0],
  }])
})

test('redacts accidental credentials before product context can be stored or sent to marketing', () => {
  const source = [
    'STRIPE_SECRET_KEY=sk_live_not_for_marketing',
    'api_key: abc123',
    '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----',
  ].join('\n')
  const redacted = redactRepositoryProductText(source)
  assert.doesNotMatch(redacted, /sk_live_not_for_marketing|abc123|\nsecret\n/)
  assert.match(redacted, /\[REDACTED\]/)
})
