import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDesktopInboxStoragePath,
  canWriteDesktopInboxBrand,
  desktopInboxDisplayName,
  DESKTOP_INBOX_BRAND_SLUGS,
  desktopInboxStoragePrefix,
  isDesktopInboxBrandSlug,
} from './desktop-inbox.ts'

test('the generic desktop inbox is deliberately limited to the four approved brands', () => {
  assert.deepEqual(DESKTOP_INBOX_BRAND_SLUGS, ['scent-sell', 'downscale', 'do-today', 'endorseme'])
  assert.equal(isDesktopInboxBrandSlug('scent-sell'), true)
  assert.equal(isDesktopInboxBrandSlug('telecheck'), false)
  assert.equal(desktopInboxDisplayName({ name: 'EndorseMe', slug: 'endorseme' }), 'Pathway to NP')
})

test('only an accepted owner or admin assigned to the brand can use the shared desktop uploader', () => {
  assert.equal(canWriteDesktopInboxBrand({ role: 'admin', status: 'accepted', brand_ids: null }, 'brand-1'), true)
  assert.equal(canWriteDesktopInboxBrand({ role: 'admin', status: 'accepted', brand_ids: ['brand-1'] }, 'brand-1'), true)
  assert.equal(canWriteDesktopInboxBrand({ role: 'admin', status: 'accepted', brand_ids: ['other-brand'] }, 'brand-1'), false)
  assert.equal(canWriteDesktopInboxBrand({ role: 'viewer', status: 'accepted', brand_ids: null }, 'brand-1'), false)
  assert.equal(canWriteDesktopInboxBrand({ role: 'admin', status: 'pending', brand_ids: null }, 'brand-1'), false)
})

test('desktop paths bind the upload to its brand owner, brand and signed-in uploader', () => {
  const prefix = desktopInboxStoragePrefix({ ownerUserId: 'owner-1', brandId: 'brand-1', uploaderUserId: 'bec-1' })
  const path = buildDesktopInboxStoragePath({
    ownerUserId: 'owner-1',
    brandId: 'brand-1',
    uploaderUserId: 'bec-1',
    uploadId: 'upload-1',
    fileName: 'Bec’s final reel.mov',
    sanitizeFileName: (name) => name.replace(/[^a-zA-Z0-9._-]/g, '_'),
  })

  assert.equal(prefix, 'owner-1/brand-1/desktop/bec-1/')
  assert.ok(path.startsWith(prefix))
  assert.match(path, /upload-1_/)
  assert.match(path, /Bec_s_final_reel\.mov$/)
})
