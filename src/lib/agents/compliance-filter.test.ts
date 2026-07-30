import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { runComplianceFilter } from './compliance-filter.ts'

const UNREGULATED = { ahpra: false, tga: false, tga_categories: [] }

test('an unregulated brand needs no regulatory review to count as checked', async () => {
  // No LLM call is made for these, so the check is complete by definition.
  // Reporting it as incomplete would block every non-health brand.
  const result = await runComplianceFilter('A post about fragrance.', UNREGULATED)

  assert.equal(result.checkCompleted, true)
  assert.equal(result.isValid, true)
})

test('local brand-voice checks still fail content without any LLM call', async () => {
  const result = await runComplianceFilter(
    'Results are guaranteed.',
    UNREGULATED,
    { never_do: ['guaranteed_outcomes'] },
  )

  assert.equal(result.isValid, false)
  assert.ok(result.brandVoiceIssues.some((issue) => /guaranteed/i.test(issue)))
})

test('a banned word is caught locally', async () => {
  const result = await runComplianceFilter(
    'This is a luxury fragrance.',
    UNREGULATED,
    { banned_words: ['luxury'] },
  )

  assert.equal(result.isValid, false)
  assert.ok(result.brandVoiceIssues.some((issue) => issue.includes('luxury')))
})

// The regulated path needs a live model, so these assert the contract at the
// source level instead. They exist because this file previously had no tests at
// all, and the defect they pin cost nothing to introduce and would have cost
// $60,000 per published offence.

test('a failed regulatory review is never reported as a completed one', () => {
  const source = readFileSync(new URL('./compliance-filter.ts', import.meta.url), 'utf8')
  const catchBlock = source.slice(source.lastIndexOf('} catch (error) {'))

  // The catch must not claim the review ran. `isValid` is initialised true, so
  // returning from here without this distinction reads as "compliant".
  assert.doesNotMatch(catchBlock, /checkCompleted\s*=\s*true/)
  assert.match(source, /result\.checkCompleted = true/)
})

test('publish_to_social blocks regulated content when the review did not run', () => {
  const source = readFileSync(
    new URL('./tools/publish-to-social.ts', import.meta.url),
    'utf8',
  )

  // Must cover TGA as well as AHPRA — DownscaleDerm is TGA-only, so an
  // ahpra-only condition let therapeutic claims through.
  assert.match(source, /!check\.checkCompleted && \(complianceFlags\.ahpra \|\| complianceFlags\.tga\)/)
  assert.doesNotMatch(source, /if \(complianceFlags\.ahpra\) \{/)
})

test('draft_post blocks a regulated draft when the review did not run', () => {
  const source = readFileSync(
    new URL('../mcp/draft-post-tool.ts', import.meta.url),
    'utf8',
  )

  assert.match(source, /!check\.checkCompleted/)
  assert.match(source, /complianceFlags\.ahpra \|\| complianceFlags\.tga/)
})
