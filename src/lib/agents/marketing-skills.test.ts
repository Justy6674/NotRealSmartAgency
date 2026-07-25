import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMarketingSkillContext, selectMarketingSkills } from './marketing-skills.ts'

test('routes searchability work to adapted SEO, AI SEO, schema and architecture patterns', () => {
  const skills = selectMarketingSkills('Audit our sitemap, robots, breadcrumbs, schema and AI search visibility')
  assert.deepEqual(skills.map((skill) => skill.id), ['product-marketing', 'seo-audit', 'ai-seo', 'schema', 'site-architecture'])
})

test('keeps recurring Telegram work bounded and NRS-owned', () => {
  const context = buildMarketingSkillContext('Set up a weekly Telegram marketing loop for Instagram', 'telegram')
  assert.match(context, /marketing-loops/)
  assert.match(context, /social/)
  assert.match(context, /do not call a separate Hyper MCP/i)
  assert.match(context, /approval gate/i)
})
