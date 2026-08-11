import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createMediaIntakeToken,
  hashMediaIntakeToken,
  intakeStoragePrefix,
  isAllowedIntakeMime,
  isValidMediaIntakeToken,
  MAX_MEDIA_INTAKE_BYTES,
  sanitizeIntakeFileName,
  validateIntakeFile,
} from './intake-link.ts'

test('an intake token is high-entropy, web-safe, and only its hash is durable', () => {
  const token = createMediaIntakeToken()

  assert.match(token, /^nrs_drop_[A-Za-z0-9_-]{43}$/)
  assert.equal(isValidMediaIntakeToken(token), true)
  assert.equal(hashMediaIntakeToken(token), hashMediaIntakeToken(token))
  assert.notEqual(hashMediaIntakeToken(token), token)
})

test('the public intake accepts only the same broad media families as NRS upload', () => {
  assert.equal(isAllowedIntakeMime('image/heic'), true)
  assert.equal(isAllowedIntakeMime('video/quicktime'), true)
  assert.equal(isAllowedIntakeMime('audio/m4a'), true)
  assert.equal(isAllowedIntakeMime('application/pdf'), false)
  assert.equal(isAllowedIntakeMime('text/html'), false)
})

test('intake validation enforces a non-empty 500 MB maximum file', () => {
  assert.equal(validateIntakeFile({ fileName: 'clip.mov', fileType: 'video/quicktime', fileSize: MAX_MEDIA_INTAKE_BYTES }), null)
  assert.match(validateIntakeFile({ fileName: 'clip.mov', fileType: 'video/quicktime', fileSize: MAX_MEDIA_INTAKE_BYTES + 1 }) ?? '', /500 MB/)
  assert.match(validateIntakeFile({ fileName: 'clip.mov', fileType: 'video/quicktime', fileSize: 0 }) ?? '', /empty/)
})

test('intake paths are locked to one owner, brand, and capability link', () => {
  const prefix = intakeStoragePrefix({
    ownerUserId: 'owner-1',
    brandId: 'brand-1',
    linkId: 'link-1',
  })

  assert.equal(prefix, 'owner-1/brand-1/drop/link-1/')
  assert.equal(sanitizeIntakeFileName('Bec’s reel / final?.MOV'), 'Bec_s_reel___final_.MOV')
})
