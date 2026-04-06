/**
 * Test script: publish a test post to TeleScribe Instagram via Mixpost API.
 *
 * Usage: node scripts/test-mixpost-publish.mjs
 *
 * Reads .env.local for MIXPOST_API_URL, MIXPOST_API_TOKEN, MIXPOST_WORKSPACE_UUID.
 * Uploads the NRS logo (public/Favicon.png) and publishes to account ID 12 (telescribeaustralia_).
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load env
const envPath = resolve(import.meta.dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.+)$/)
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
}

const API_URL = env.MIXPOST_API_URL
const TOKEN = env.MIXPOST_API_TOKEN
const WORKSPACE = env.MIXPOST_WORKSPACE_UUID
const TELESCRIBE_INSTAGRAM_ID = 12

if (!API_URL || !TOKEN || !WORKSPACE) {
  console.error('Missing MIXPOST_API_URL, MIXPOST_API_TOKEN, or MIXPOST_WORKSPACE_UUID in .env.local')
  process.exit(1)
}

const base = `${API_URL}/api/${WORKSPACE}`
const headers = { Authorization: `Bearer ${TOKEN}` }

async function run() {
  console.log('=== NRS Mixpost Test Publisher ===\n')
  console.log(`API: ${API_URL}`)
  console.log(`Workspace: ${WORKSPACE}`)
  console.log(`Target: telescribeaustralia_ (account ID ${TELESCRIBE_INSTAGRAM_ID})\n`)

  // Step 1: Upload the NRS logo as media
  console.log('1. Uploading NRS logo...')
  const logoPath = resolve(import.meta.dirname, '..', 'public', 'Favicon.png')
  const logoBuffer = readFileSync(logoPath)
  const blob = new Blob([logoBuffer], { type: 'image/png' })

  const formData = new FormData()
  formData.append('file', blob, 'NRS-Logo.png')

  const uploadRes = await fetch(`${base}/media/upload`, {
    method: 'POST',
    headers: { ...headers },
    body: formData,
  })

  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    console.error(`Upload failed (${uploadRes.status}):`, text.slice(0, 300))

    // Try alternative: create post without media upload (text-only test)
    console.log('\nFalling back to text-only test post...\n')
    return await publishTextOnly()
  }

  const media = await uploadRes.json()
  console.log('   Uploaded:', JSON.stringify(media).slice(0, 200))

  // Step 2: Create and publish the post
  console.log('\n2. Publishing test post to TeleScribe Instagram...')
  await publishPost(media.id || media.data?.id)
}

async function publishTextOnly() {
  console.log('2. Publishing text-only test post...')

  const caption = 'Not Real = Artificial. Smart = Intelligence. Your own AI marketing agency — testing the pipeline. #NotRealSmart #AIMarketing #TeleScribe'

  const postBody = {
    accounts: [TELESCRIBE_INSTAGRAM_ID],
    versions: [
      {
        account_id: TELESCRIBE_INSTAGRAM_ID,
        is_original: true,
        content: [{ body: caption, media: [] }],
      },
    ],
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].slice(0, 5),
    schedule_now: true,
  }

  const res = await fetch(`${base}/posts`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(postBody),
  })

  const text = await res.text()
  console.log(`   Status: ${res.status}`)
  try {
    const json = JSON.parse(text)
    console.log('   Response:', JSON.stringify(json, null, 2).slice(0, 500))
    if (res.ok) {
      console.log('\n=== SUCCESS: Test post created ===')
      console.log('Check telescribeaustralia_ on Instagram or Mixpost admin panel.')
    }
  } catch {
    console.log('   Response:', text.slice(0, 300))
  }
}

async function publishPost(mediaId) {
  const postBody = {
    body: [
      {
        body: 'Not Real = Artificial. Smart = Intelligence. Your own AI marketing agency — testing the pipeline. #NotRealSmart #AIMarketing #TeleScribe',
      },
    ],
    accounts: [TELESCRIBE_INSTAGRAM_ID],
    media: mediaId ? [{ id: mediaId }] : [],
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].slice(0, 5),
    schedule_now: true,
  }

  const res = await fetch(`${base}/posts`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(postBody),
  })

  const text = await res.text()
  console.log(`   Status: ${res.status}`)
  try {
    const json = JSON.parse(text)
    console.log('   Response:', JSON.stringify(json, null, 2).slice(0, 500))
    if (res.ok) {
      console.log('\n=== SUCCESS: Test post with NRS logo published ===')
      console.log('Check telescribeaustralia_ on Instagram or Mixpost admin panel.')
    }
  } catch {
    console.log('   Response:', text.slice(0, 300))
  }
}

run().catch((err) => {
  console.error('Script failed:', err.message)
  process.exit(1)
})
