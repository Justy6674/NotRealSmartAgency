import assert from 'node:assert/strict'
import test from 'node:test'
import { requestAbeAi } from './full-client.ts'

test('Abe full client sends authenticated JSON to the requested endpoint', async () => {
  const result = await requestAbeAi<{ answer: string }>({
    path: '/api/agents/oracle',
    method: 'POST',
    body: { question: 'What AHPRA advertising rules apply?' },
  }, {
    env: { ABEAI_API_KEY: 'abe_test', ABEAI_API_BASE: 'https://abe.test/' },
    fetchImpl: async (input, init) => {
      assert.equal(input, 'https://abe.test/api/agents/oracle')
      assert.equal(init?.method, 'POST')
      assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer abe_test')
      assert.deepEqual(JSON.parse(String(init?.body)), { question: 'What AHPRA advertising rules apply?' })
      return new Response(JSON.stringify({ answer: 'Grounded answer' }), { status: 200 })
    },
  })

  assert.deepEqual(result, { answer: 'Grounded answer' })
})

test('Abe full client encodes bounded query parameters and fails closed without a key', async () => {
  await assert.rejects(
    requestAbeAi({ path: '/api/memory/list', method: 'GET' }, { env: {} }),
    /not configured/i,
  )

  await requestAbeAi({
    path: '/api/tasks/list',
    method: 'GET',
    query: { status: 'ready,in_progress', limit: '25', missing: undefined },
  }, {
    env: { ABEAI_API_KEY: 'abe_test', ABEAI_API_BASE: 'https://abe.test' },
    fetchImpl: async (input, init) => {
      assert.equal(input, 'https://abe.test/api/tasks/list?status=ready%2Cin_progress&limit=25')
      assert.equal(init?.method, 'GET')
      return new Response(JSON.stringify({ tasks: [] }), { status: 200 })
    },
  })
})
