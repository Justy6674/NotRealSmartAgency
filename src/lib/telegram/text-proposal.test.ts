import assert from 'node:assert/strict'
import test from 'node:test'
import { splitTelegramSocialCopy, telegramCaptionPlatform } from './text-proposal'

test('splits the trailing hashtag line from a Telegram caption without changing its copy', () => {
  assert.deepEqual(
    splitTelegramSocialCopy('Build your own fragrance lists for free.\n\n#scentsell #fragrancetok'),
    { caption: 'Build your own fragrance lists for free.', hashtags: ['scentsell', 'fragrancetok'] },
  )
})

test('keeps a caption intact when it has no trailing hashtag line', () => {
  assert.deepEqual(
    splitTelegramSocialCopy('Build your own fragrance lists for free.'),
    { caption: 'Build your own fragrance lists for free.', hashtags: [] },
  )
})

test('uses the platform explicitly named in the owner request before the Instagram fallback', () => {
  assert.equal(telegramCaptionPlatform('Write a TikTok description for this image.'), 'tiktok')
  assert.equal(telegramCaptionPlatform('Write social copy for this image.'), 'instagram')
})
