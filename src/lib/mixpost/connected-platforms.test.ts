import { test } from 'node:test'
import assert from 'node:assert/strict'
import { platformNames, type ConnectedAccount } from './connected-platforms'

const acct = (accountId: number, provider: string, label: string, handle: string): ConnectedAccount =>
  ({ accountId, provider, label, handle })

test('Facebook pages read as "Facebook", not "facebook_page"', () => {
  // The provider name is Mixpost's word, not a word anyone says out loud.
  assert.deepEqual(
    platformNames([acct(6, 'facebook_page', 'Facebook', 'Scent Sell')]),
    ['Facebook'],
  )
})

test('two accounts on one platform are offered once', () => {
  assert.deepEqual(
    platformNames([
      acct(6, 'facebook_page', 'Facebook', 'Scent Sell'),
      acct(9, 'facebook_page', 'Facebook', 'Scent Sell AU'),
      acct(11, 'instagram', 'Instagram', 'scentsellsocials'),
    ]),
    ['Facebook', 'Instagram'],
  )
})

test('a project with nothing connected offers nothing', () => {
  // Not "all of them", and not a default list. Offering a platform that is not
  // there is how a draft fails on the one account that does not exist.
  assert.deepEqual(platformNames([]), [])
})
