import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAbeRegulatoryContext, getAbeAiConfig, searchAbeRegulatoryCorpus } from './regulatory-corpus.ts'

const ENV = { ABEAI_API_KEY: 'abe_test', ABEAI_API_BASE: 'https://abe.test' }

function chunk(overrides: Record<string, unknown> = {}) {
  return {
    chunk_id: 1,
    source: 'AHPRA advertising guidelines',
    source_category: 'ahpra',
    jurisdiction: 'federal',
    corpus_version: 'full-v2@2026-05-27',
    section: '4',
    content: 'Use accurate advertising.',
    similarity: 0.91,
    ...overrides,
  }
}

/** Abe AI's first-party response shape: current text, honestly labelled unverified. */
function firstPartyBody(overrides: Record<string, unknown> = {}) {
  return {
    corpus_version: 'full-v2@2026-05-27',
    chunks: [chunk()],
    citations: [chunk()],
    constraints: {
      generated_answer: false,
      current_corpus_only: true,
      citation_mode: 'first_party_grounding',
      citation_status: 'unverified_first_party',
      verified_primary_source_only: false,
      source_truth: 'regulatory_corpus',
      policy_projection_version: 'unverified',
      subscriber_safe: false,
    },
    warnings: [],
    ...overrides,
  }
}

test('Abe AI connector is fail-closed when no key is configured', () => {
  assert.equal(getAbeAiConfig({}), null)
})

test('unconfigured deployment reports its own state rather than calling out', async () => {
  const result = await searchAbeRegulatoryCorpus('AHPRA advertising rules', {
    env: {},
    fetchImpl: async () => {
      throw new Error('fetch must not be attempted without a key')
    },
  })
  assert.equal(result.status, 'unconfigured')
  assert.equal(result.verification, 'unknown')
  assert.equal(result.chunks.length, 0)
  assert.match(result.warning ?? '', /not configured/)
  assert.equal(buildAbeRegulatoryContext(result), '')
})

test('happy path asks for first-party grounding and carries the unverified label through', async () => {
  let sentBody: Record<string, unknown> | null = null

  const result = await searchAbeRegulatoryCorpus('AHPRA advertising rules', {
    env: ENV,
    fetchImpl: async (input, init) => {
      assert.equal(String(input), 'https://abe.test/api/corpus/search')
      assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer abe_test')
      sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(JSON.stringify(firstPartyBody()), { status: 200 })
    },
  })

  // First-party relaxes the rights gate; it must never relax the currency gate.
  assert.equal(sentBody!.citation_mode, 'first_party_grounding')
  assert.equal(sentBody!.current_only, true)
  assert.equal(sentBody!.scope, 'all_healthcare')

  assert.equal(result.status, 'connected')
  assert.equal(result.verification, 'first_party_unverified')
  assert.equal(result.corpusVersion, 'full-v2@2026-05-27')
  assert.equal(result.citations.length, 1)
  // The expected path is not a risk to read out to the owner.
  assert.equal(result.warning, undefined)

  const context = buildAbeRegulatoryContext(result)
  assert.match(context, /FIRST-PARTY GROUNDING ONLY/)
  assert.match(context, /do not present any of it as a verified or quotable citation/)
  assert.match(context, /AHPRA advertising guidelines/)
})

test('a verified response is distinguishable from first-party grounding', async () => {
  const result = await searchAbeRegulatoryCorpus('AHPRA advertising rules', {
    env: ENV,
    fetchImpl: async () => new Response(JSON.stringify(firstPartyBody({
      constraints: {
        citation_mode: 'verified',
        citation_status: 'verified_primary_source',
        subscriber_safe: true,
      },
    })), { status: 200 }),
  })

  assert.equal(result.status, 'connected')
  assert.equal(result.verification, 'verified')
  assert.equal(result.warning, undefined)
  assert.match(buildAbeRegulatoryContext(result), /VERIFIED primary-source material/)
})

test('an unlabelled response is treated as unverified, not optimistically', async () => {
  const result = await searchAbeRegulatoryCorpus('AHPRA advertising rules', {
    env: ENV,
    // An Abe AI deploy that predates citation_mode returns no honesty field.
    fetchImpl: async () => new Response(JSON.stringify({
      corpus_version: 'full-v2@2026-05-27',
      chunks: [chunk()],
      citations: [chunk()],
    }), { status: 200 }),
  })

  assert.equal(result.status, 'connected')
  assert.equal(result.verification, 'unknown')
  assert.match(result.warning ?? '', /did not state whether/)
  assert.match(buildAbeRegulatoryContext(result), /VERIFICATION UNKNOWN/)
})

test('HTTP 500 carries Abe AI\'s own error body, not just the status code', async () => {
  await assert.rejects(
    searchAbeRegulatoryCorpus('AHPRA advertising rules', {
      env: ENV,
      fetchImpl: async () => new Response(
        JSON.stringify({ error: 'Corpus search failed. Please try again shortly.' }),
        { status: 500 },
      ),
    }),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      assert.match(message, /HTTP 500/)
      // The two-day outage produced no diagnosis because this half was dropped.
      assert.match(message, /Corpus search failed\. Please try again shortly\./)
      return true
    },
  )
})

test('a non-JSON failure body is reported and bounded', async () => {
  await assert.rejects(
    searchAbeRegulatoryCorpus('AHPRA advertising rules', {
      env: ENV,
      fetchImpl: async () => new Response(
        `<html><body>${'gateway timeout '.repeat(200)}</body></html>`,
        { status: 502 },
      ),
    }),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      assert.match(message, /HTTP 502/)
      assert.match(message, /gateway timeout/)
      // Bounded: a whole error page must not end up in a compliance warning.
      assert.ok(message.length < 700, `message was ${message.length} characters`)
      return true
    },
  )
})

test('a 403 explains which gate refused, instead of a bare status', async () => {
  await assert.rejects(
    searchAbeRegulatoryCorpus('AHPRA advertising rules', {
      env: ENV,
      fetchImpl: async () => new Response(
        JSON.stringify({ error: 'This API key is not permitted first-party grounding retrieval.' }),
        { status: 403 },
      ),
    }),
    /not permitted first-party grounding retrieval/,
  )
})

test('HTTP 200 with zero chunks is not a grounded review', async () => {
  const result = await searchAbeRegulatoryCorpus('AHPRA advertising rules', {
    env: ENV,
    fetchImpl: async () => new Response(JSON.stringify(firstPartyBody({
      corpus_version: null,
      chunks: [],
      citations: [],
      warnings: ['NO_CORPUS_MATCH'],
    })), { status: 200 }),
  })

  assert.equal(result.status, 'no_grounding')
  assert.notEqual(result.status, 'connected')
  assert.equal(result.chunks.length, 0)
  assert.equal(result.verification, 'first_party_unverified')
  assert.match(result.warning ?? '', /returned no matching AHPRA\/TGA material/)
  // Abe AI's own reason is the difference between a diagnosis and a shrug.
  assert.match(result.warning ?? '', /NO_CORPUS_MATCH/)
  // Nothing to ground with means nothing goes into the compliance prompt.
  assert.equal(buildAbeRegulatoryContext(result), '')
})

test('a 200 with a non-JSON body fails loudly rather than looking like no grounding', async () => {
  await assert.rejects(
    searchAbeRegulatoryCorpus('AHPRA advertising rules', {
      env: ENV,
      fetchImpl: async () => new Response('<html>edge cache</html>', { status: 200 }),
    }),
    /non-JSON body/,
  )
})
