import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAbeRegulatoryContext, getAbeAiConfig, searchAbeRegulatoryCorpus } from './regulatory-corpus.ts'

test('Abe AI connector is fail-closed when no key is configured', () => {
  assert.equal(getAbeAiConfig({}), null)
})

test('Abe AI connector returns bounded chunks and citations', async () => {
  const result = await searchAbeRegulatoryCorpus('AHPRA advertising rules', {
    env: { ABEAI_API_KEY: 'abe_test', ABEAI_API_BASE: 'https://abe.test' },
    fetchImpl: async (_input, init) => {
      assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer abe_test')
      return new Response(JSON.stringify({
        corpus_version: '2026-07',
        chunks: [{ chunk_id: 1, source: 'AHPRA code', source_category: 'ahpra', jurisdiction: 'federal', corpus_version: '2026-07', section: '4', content: 'Use accurate advertising.', similarity: 0.91 }],
        citations: [{ chunk_id: 1, source: 'AHPRA code', source_category: 'ahpra', jurisdiction: 'federal', corpus_version: '2026-07', section: '4', similarity: 0.91 }],
      }), { status: 200 })
    },
  })
  assert.equal(result.status, 'connected')
  assert.equal(result.citations.length, 1)
  assert.match(buildAbeRegulatoryContext(result), /AHPRA code/)
})
