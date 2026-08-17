import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BLOG_TABS,
  blogHandoverStatus,
  countByStatus,
  extractBlogImages,
  hostFromWebsite,
  summariseQueue,
  type BlogArticleRow,
} from './handover.ts'

function row(over: Partial<BlogArticleRow> = {}): BlogArticleRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'What a weight loss consultation actually involves',
    content: 'A'.repeat(800),
    is_approved: false,
    created_at: '2026-08-04T00:00:00.000Z',
    metadata: {},
    ...over,
  }
}

test('a full article the Director already wrote is ready to copy across', () => {
  assert.equal(blogHandoverStatus(row({ metadata: { word_count: 1180 } })), 'ready')
})

test('marking it on her site moves it out of the copy-paste queue', () => {
  assert.equal(
    blogHandoverStatus(
      row({ metadata: { word_count: 1180, published_on_site_at: '2026-08-10T00:00:00.000Z' } }),
    ),
    'on_site',
  )
})

test('a short outline is an idea, not a finished post', () => {
  assert.equal(
    blogHandoverStatus(row({ content: 'Outline: intro, three tips, CTA.', metadata: { word_count: 8 } })),
    'idea',
  )
})

test('an explicit writing marker stays in Being written', () => {
  assert.equal(
    blogHandoverStatus(row({ metadata: { blog_handover: 'writing', word_count: 400 } })),
    'writing',
  )
})

test('needs a change is only an explicit hold — failed copy is not stored', () => {
  // save-gate refuses violating copy, so this tab is a hold the Director left,
  // never a library of AHPRA failures to imitate.
  assert.equal(
    blogHandoverStatus(row({ metadata: { blog_handover: 'needs_change', word_count: 900 } })),
    'needs_change',
  )
})

test('tab counts are real numbers, and Everything is the sum', () => {
  const posts = [
    row({ id: '1', metadata: { word_count: 1200 } }),
    row({ id: '2', metadata: { word_count: 1200, published_on_site_at: '2026-08-01T00:00:00.000Z' } }),
    row({ id: '3', content: 'idea', metadata: { blog_handover: 'idea' } }),
  ]
  const counts = countByStatus(posts)
  assert.equal(counts.everything, 3)
  assert.equal(counts.ready, 1)
  assert.equal(counts.on_site, 1)
  assert.equal(counts.idea, 1)
  assert.equal(BLOG_TABS.length, 6)
})

test('queue summary uses the owner\'s language, not department jargon', () => {
  const text = summariseQueue({ everything: 14, ready: 3, needs_change: 1, writing: 2, idea: 4, on_site: 4 })
  assert.match(text, /fourteen posts/i)
  assert.match(text, /three ready to copy/i)
  assert.doesNotMatch(text, /output_type|blog_article|Mixpost|Zernio/i)
})

test('the website host is named without claiming NRS hosts the blog', () => {
  assert.equal(hostFromWebsite('https://www.downscale.com.au/blog'), 'downscale.com.au')
  assert.equal(hostFromWebsite(null), null)
})

test('images come from metadata the Director attached, never invented', () => {
  const images = extractBlogImages(
    row({
      metadata: {
        images: [
          { url: 'https://example.com/a.jpg', alt: 'Clinic' },
          { url: 'https://example.com/b.jpg' },
        ],
      },
    }),
  )
  assert.equal(images.length, 2)
  assert.equal(images[0].alt, 'Clinic')
  assert.equal(extractBlogImages(row()).length, 0)
})
