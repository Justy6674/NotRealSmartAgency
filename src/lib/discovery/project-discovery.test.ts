import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSitemapLocations, sitemapCandidatesForWebsite } from './project-discovery.ts'

test('uses a bounded same-origin sitemap discovery surface', () => {
  assert.deepEqual(
    sitemapCandidatesForWebsite('https://www.dotoday.com.au/guide', 'Sitemap: https://www.dotoday.com.au/custom-sitemap.xml'),
    [
      'https://www.dotoday.com.au/custom-sitemap.xml',
      'https://www.dotoday.com.au/sitemap.xml',
      'https://www.dotoday.com.au/sitemap_index.xml',
    ],
  )
})

test('extracts a capped set of same-origin sitemap locations only', () => {
  const sitemap = [
    '<urlset>',
    '<url><loc>https://www.dotoday.com.au/</loc></url>',
    '<url><loc>https://www.dotoday.com.au/about</loc></url>',
    '<url><loc>https://elsewhere.example/ignore</loc></url>',
    '</urlset>',
  ].join('')

  assert.deepEqual(parseSitemapLocations(sitemap, 'https://www.dotoday.com.au', 10), [
    'https://www.dotoday.com.au/',
    'https://www.dotoday.com.au/about',
  ])
})
