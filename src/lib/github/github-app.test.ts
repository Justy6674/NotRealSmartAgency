import assert from 'node:assert/strict'
import test from 'node:test'
import { generateKeyPairSync } from 'node:crypto'
import { createGitHubAppJwt } from './github-app-client.ts'
import { getGitHubAppConfig, gitHubAppInstallUrl, gitHubAppInstallUrlWithState } from './github-app.ts'

test('requires every server-side GitHub App setting before enabling a connection', () => {
  assert.equal(getGitHubAppConfig({}), null)
  assert.equal(getGitHubAppConfig({
    GITHUB_APP_ID: '123',
    GITHUB_APP_SLUG: 'nrs',
  }), null)
})

test('normalises a Vercel GitHub App private key and builds the installation URL', () => {
  const config = getGitHubAppConfig({
    GITHUB_APP_ID: '123',
    GITHUB_APP_SLUG: 'nrs-agency',
    GITHUB_APP_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----',
  })

  assert.deepEqual(config, {
    appId: '123',
    appSlug: 'nrs-agency',
    privateKey: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
  })
  assert.equal(gitHubAppInstallUrl(config!), 'https://github.com/apps/nrs-agency/installations/new')
  assert.equal(gitHubAppInstallUrlWithState(config!, 'state-123'), 'https://github.com/apps/nrs-agency/installations/new?state=state-123')
})

test('signs a short-lived GitHub App JWT without persisting any installation token', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwt = createGitHubAppJwt({
    appId: '123',
    appSlug: 'nrs-agency',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }, Date.UTC(2026, 6, 25, 0, 0, 0))
  const [, payload] = jwt.split('.')
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url').toString()), {
    iat: 1784937570,
    exp: 1784938110,
    iss: '123',
  })
  assert.equal(jwt.split('.').length, 3)
})
