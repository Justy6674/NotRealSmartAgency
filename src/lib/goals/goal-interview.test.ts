import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GOAL_QUESTIONS,
  buildInterviewDirective,
  draftGoalFromAnswers,
  goalInterviewProgress,
  nextGoalQuestion,
  type GoalAnswers,
} from './goal-interview.ts'

const FULL: GoalAnswers = {
  outcome: 'More people listing bottles they no longer wear',
  audience: 'Someone with eight bottles, three they never wear',
  action: 'List one bottle',
  barrier: 'They think it is a hassle',
  channels: 'Instagram and Facebook',
  metric: 'Bottles listed per week',
}

test('the first question asked is what a win looks like', () => {
  // Everything else is chosen to serve it. Asking about channels first is how
  // you end up with a posting schedule and no reason for it.
  assert.equal(nextGoalQuestion({})?.field, 'outcome')
})

test('questions come in the order a director would ask them', () => {
  const order = GOAL_QUESTIONS.filter((q) => !q.optional).map((q) => q.field)
  assert.deepEqual(order, ['outcome', 'audience', 'action', 'barrier', 'channels', 'metric'])
})

test('an answered question is never asked again', () => {
  assert.equal(nextGoalQuestion({ outcome: 'More listings' })?.field, 'audience')
})

test('a blank answer does not count as answered', () => {
  assert.equal(nextGoalQuestion({ outcome: '   ' })?.field, 'outcome')
})

test('the goal is usable before the interview is exhausted', () => {
  // He can stop after the essentials without leaving it half-set.
  const progress = goalInterviewProgress(FULL)
  assert.equal(progress.usable, true)
  assert.equal(progress.complete, false)
  assert.equal(nextGoalQuestion(FULL)?.field, 'baseline')
})

test('optional questions come only after every essential one', () => {
  const partial: GoalAnswers = { outcome: 'x', deadline: 'end of year' }
  assert.equal(nextGoalQuestion(partial)?.field, 'audience')
})

test('the interview ends rather than looping', () => {
  const everything: GoalAnswers = {
    ...FULL, baseline: 'two a week', deadline: 'December', guardrail: 'never sound like a discount bin',
  }
  assert.equal(nextGoalQuestion(everything), null)
  assert.equal(goalInterviewProgress(everything).complete, true)
})

test('exactly one question is put to him at a time', () => {
  // Asking all nine at once is the form he did not want, with extra steps.
  const directive = buildInterviewDirective('Scent Sell', { outcome: 'More listings' })
  const quoted = directive.match(/"[^"]+\?"/g) ?? []
  assert.equal(quoted.length, 1, 'more than one question was put in front of him')
  assert.match(directive, /ONE question/)
})

test('the directive never re-asks what he already told it', () => {
  const directive = buildInterviewDirective('Scent Sell', FULL)
  assert.match(directive, /never ask these again/i)
  assert.match(directive, /More people listing bottles/)
  // The next question must be the first unanswered one, not a repeat.
  assert.match(directive, /Where is that number today/)
})

test('the directive forbids answering on his behalf', () => {
  const directive = buildInterviewDirective('Scent Sell', {})
  assert.match(directive, /Do not answer it for him/)
  assert.match(directive, /not his answer/)
})

test('once everything is answered it asks him to confirm the wording', () => {
  const everything: GoalAnswers = {
    ...FULL, baseline: 'two a week', deadline: 'December', guardrail: 'no discount bin',
  }
  const directive = buildInterviewDirective('Scent Sell', everything)
  assert.match(directive, /READY TO AGREE/)
  assert.match(directive, /his own words/)
  assert.match(directive, /before saving/)
})

test('the goal is drafted in his words, not rewritten into marketing language', () => {
  const draft = draftGoalFromAnswers(FULL)
  assert.ok(draft)
  assert.equal(draft!.title, 'More people listing bottles they no longer wear')
  assert.match(draft!.description, /Who it is for: Someone with eight bottles/)
  assert.match(draft!.description, /What is in the way: They think it is a hassle/)
})

test('nothing is drafted from an interview with no outcome', () => {
  assert.equal(draftGoalFromAnswers({ audience: 'collectors' }), null)
})

test('a partial interview drafts only what was actually said', () => {
  const draft = draftGoalFromAnswers({ outcome: 'More listings', action: 'List one bottle' })
  assert.ok(draft)
  assert.match(draft!.description, /What they should do: List one bottle/)
  assert.ok(!draft!.description.includes('Who it is for'), 'nothing unanswered may be invented')
})

test('every question carries a reason and an illustration', () => {
  // He will ask why, and he will stall. Both need an answer that is ready.
  for (const q of GOAL_QUESTIONS) {
    assert.ok(q.why.length > 20, `${q.field} has no reason`)
    assert.ok(q.example.length > 10, `${q.field} has no illustration`)
    assert.match(q.question, /\?$/, `${q.field} is not phrased as a question`)
  }
})

test('no question uses marketing jargon he has said he does not know', () => {
  const jargon = /\b(CRO|CTR|GEO|SEO|funnel|persona|ICP|KPI|conversion rate|top of funnel|CAC|LTV)\b/i
  for (const q of GOAL_QUESTIONS) {
    assert.ok(!jargon.test(q.question), `${q.field} asks in jargon: ${q.question}`)
  }
})
