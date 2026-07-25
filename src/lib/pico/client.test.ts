import assert from 'node:assert/strict'
import test from 'node:test'
import { getPicoSearchResult, submitPicoSearch } from './client.ts'

test('submits a PICO evidence search with server-side bearer authentication', async () => {
  const result = await submitPicoSearch({
    question: 'What evidence exists for obesity stigma in primary care?',
    mode: 'clinician',
    department_hint: ['primary_care'],
    client_name: 'notrealsmart',
  }, {
    env: { PICO_SEARCH_API_KEY: 'pks_test', PICO_SEARCH_API_BASE: 'https://pico.test/' },
    fetchImpl: async (input, init) => {
      assert.equal(input, 'https://pico.test/api/v1/search')
      assert.equal(init?.method, 'POST')
      assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer pks_test')
      assert.deepEqual(JSON.parse(String(init?.body)), {
        question: 'What evidence exists for obesity stigma in primary care?',
        mode: 'clinician',
        department_hint: ['primary_care'],
        client_name: 'notrealsmart',
      })
      return new Response(JSON.stringify({
        job_id: 'job_123',
        poll_url: 'https://pico.test/api/v1/search?job_id=job_123',
        poll_interval_ms: 2000,
        estimated_seconds: 30,
      }), { status: 200 })
    },
  })

  assert.equal(result.job_id, 'job_123')
})

test('polls the canonical PICO result envelope and fails closed without a valid key', async () => {
  await assert.rejects(getPicoSearchResult('job_123', { env: {} }), /not configured/i)
  await assert.rejects(getPicoSearchResult('job_123', { env: { PICO_SEARCH_API_KEY: 'wrong' } }), /not configured/i)

  const result = await getPicoSearchResult('job with slash/1', {
    env: { PICO_SEARCH_API_KEY: 'pks_test', PICO_SEARCH_API_BASE: 'https://pico.test' },
    fetchImpl: async (input, init) => {
      assert.equal(input, 'https://pico.test/api/v1/search?job_id=job%20with%20slash%2F1')
      assert.equal(init?.method, 'GET')
      return new Response(JSON.stringify({ id: 'job_123', status: 'completed', envelope: { version: 'pico.v1' } }), { status: 200 })
    },
  })

  assert.equal(result.status, 'completed')
  assert.deepEqual(result.envelope, { version: 'pico.v1' })
})
