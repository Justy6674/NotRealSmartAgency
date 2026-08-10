import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMixpostEditUrl } from './sync-draft'

test('a synced Mixpost draft opens its existing post route', () => {
  const original = process.env.MIXPOST_WEB_URL
  process.env.MIXPOST_WEB_URL = 'https://mixpost.notrealsmart.com.au/mixpost'
  try {
    const url = buildMixpostEditUrl({
      mixpost: {
        workspace_uuid: 'workspace-uuid',
        post_uuid: 'post-uuid',
      },
    })

    assert.equal(
      url,
      'https://mixpost.notrealsmart.com.au/mixpost/workspace-uuid/posts/post-uuid',
    )
  } finally {
    if (original === undefined) delete process.env.MIXPOST_WEB_URL
    else process.env.MIXPOST_WEB_URL = original
  }
})
