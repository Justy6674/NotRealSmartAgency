import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMacroBoard,
  MAX_DECISIONS,
  type BoardApprovalInput,
  type BoardPostInput,
  type BoardProjectInput,
  type BuildBoardInput,
} from './board.ts'

const NOW = new Date('2026-07-30T09:00:00.000Z')

function iso(dayOffset: number): string {
  return new Date(NOW.getTime() + dayOffset * 24 * 60 * 60 * 1000).toISOString()
}

function project(over: Partial<BoardProjectInput> & { id: string; name: string }): BoardProjectInput {
  return { slug: over.name.toLowerCase().replace(/\s+/g, '-'), ...over }
}

function post(over: Partial<BoardPostInput> & { id: string; brand_id: string; status: string }): BoardPostInput {
  return over
}

function build(over: Partial<BuildBoardInput> = {}) {
  return buildMacroBoard({
    projects: [],
    posts: [],
    accounts: [],
    approvals: [],
    now: NOW,
    ...over,
  })
}

test('every project appears, with nothing selected first', () => {
  const projects = Array.from({ length: 11 }, (_, i) =>
    project({ id: `p${i}`, name: `Project ${i}` }),
  )
  const board = build({ projects })
  assert.equal(board.projects.length, 11)
})

test('an unreachable connection reads as not known, never as zero accounts', () => {
  const board = build({
    projects: [project({ id: 'p1', name: 'Downscale' })],
    accounts: null,
  })
  assert.equal(board.projects[0].accountCount, null)
  assert.equal(board.connectionsKnown, false)
})

test('a reachable source with no accounts for this project is zero, not unknown', () => {
  const board = build({
    projects: [project({ id: 'p1', name: 'Downscale' })],
    accounts: [{ brandId: 'other', accountName: 'Somewhere Else', authorized: true }],
  })
  assert.equal(board.projects[0].accountCount, 0)
  assert.equal(board.connectionsKnown, true)
})

test('a lapsed connection says it needs reconnecting rather than going silent', () => {
  const board = build({
    projects: [project({ id: 'p1', name: 'TeleScribe' })],
    accounts: [{ brandId: 'p1', accountName: 'TeleScribe Page', authorized: false }],
  })
  assert.deepEqual(board.projects[0].needsReconnecting, ['TeleScribe Page'])
  const row = board.decisions.find((d) => d.kind === 'needs_reconnecting')
  assert.ok(row, 'a lapsed connection must produce a row')
  assert.match(row!.headline, /needs reconnecting/i)
  assert.equal(row!.urgency, 'blocked')
})

test('regulated content scheduled without a review is visible before it publishes', () => {
  const board = build({
    projects: [
      project({ id: 'p1', name: 'Downscale', compliance_flags: { ahpra: true, tga: true } }),
    ],
    posts: [
      post({ id: 's1', brand_id: 'p1', status: 'scheduled', scheduled_at: iso(2) }),
      post({ id: 's2', brand_id: 'p1', status: 'scheduled', scheduled_at: iso(4) }),
    ],
  })
  const row = board.decisions.find((d) => d.kind === 'unreviewed_regulated')
  assert.ok(row, 'unreviewed regulated content must surface')
  assert.equal(row!.urgency, 'regulated')
  assert.equal(board.projects[0].unreviewedRegulated, 2)
})

test('a recorded review takes the post off the board', () => {
  const board = build({
    projects: [
      project({ id: 'p1', name: 'Downscale', compliance_flags: { ahpra: true, tga: false } }),
    ],
    posts: [
      post({
        id: 's1',
        brand_id: 'p1',
        status: 'scheduled',
        scheduled_at: iso(2),
        metadata: { compliance_reviewed: true },
      }),
    ],
  })
  assert.equal(board.projects[0].unreviewedRegulated, 0)
  assert.equal(board.decisions.some((d) => d.kind === 'unreviewed_regulated'), false)
})

test('an unregulated project is not asked for a health review', () => {
  const board = build({
    projects: [project({ id: 'p1', name: 'Scent Sell' })],
    posts: [post({ id: 's1', brand_id: 'p1', status: 'scheduled', scheduled_at: iso(1) })],
  })
  assert.equal(board.projects[0].unreviewedRegulated, 0)
})

test('regulated and blocked rank above waiting, and the list caps at eight', () => {
  const projects: BoardProjectInput[] = []
  const posts: BoardPostInput[] = []
  const approvals: BoardApprovalInput[] = []

  // Ten projects, each with something merely waiting.
  for (let i = 0; i < 10; i++) {
    projects.push(project({ id: `w${i}`, name: `Waiting ${i}` }))
    posts.push(post({ id: `d${i}`, brand_id: `w${i}`, status: 'draft' }))
    approvals.push({ id: `a${i}`, brandId: `w${i}`, actionType: 'publish', createdAt: iso(-1) })
  }
  // One regulated project with unreviewed content, one project blocked.
  projects.push(
    project({ id: 'reg', name: 'Downscale', compliance_flags: { ahpra: true, tga: false } }),
  )
  posts.push(post({ id: 'r1', brand_id: 'reg', status: 'scheduled', scheduled_at: iso(1) }))
  projects.push(project({ id: 'blk', name: 'TeleCheck' }))
  posts.push(post({ id: 'f1', brand_id: 'blk', status: 'failed' }))

  const board = build({ projects, posts, approvals })

  assert.equal(board.decisions.length, MAX_DECISIONS)
  assert.equal(board.decisions[0].urgency, 'regulated')
  assert.equal(board.decisions[0].projectName, 'Downscale')
  assert.equal(board.decisions[1].urgency, 'blocked')

  const firstWaiting = board.decisions.findIndex((d) => d.urgency === 'waiting')
  const lastBlocked = board.decisions.map((d) => d.urgency).lastIndexOf('blocked')
  assert.ok(lastBlocked < firstWaiting, 'no waiting row may outrank a blocked one')
})

test('every row names its project and carries an action to hand the Director', () => {
  const board = build({
    projects: [
      project({ id: 'p1', name: 'Downscale', compliance_flags: { ahpra: true, tga: false } }),
      project({ id: 'p2', name: 'Scent Sell' }),
    ],
    posts: [
      post({ id: 's1', brand_id: 'p1', status: 'scheduled', scheduled_at: iso(1) }),
      post({ id: 'd1', brand_id: 'p2', status: 'draft' }),
    ],
  })
  assert.ok(board.decisions.length > 0)
  for (const row of board.decisions) {
    assert.ok(row.projectName.length > 0, 'a row without a project is unreadable')
    assert.ok(row.projectId.length > 0)
    assert.ok(row.suggestedAction.length > 20, `row ${row.id} has no usable action`)
    assert.match(row.suggestedAction, new RegExp(row.projectName.split(' ')[0], 'i'))
  }
})

test('a quiet project is told it has nothing planned', () => {
  const board = build({ projects: [project({ id: 'p1', name: 'EndorseMe' })] })
  assert.equal(board.projects[0].state, 'quiet')
  assert.equal(board.decisions[0].kind, 'nothing_planned')
})

test('a project with content this week reads as steady, not as needing attention', () => {
  const board = build({
    projects: [project({ id: 'p1', name: 'Scent Sell' })],
    posts: [post({ id: 's1', brand_id: 'p1', status: 'scheduled', scheduled_at: iso(3) })],
  })
  assert.equal(board.projects[0].state, 'steady')
})

test('content scheduled beyond the week is not counted as this week', () => {
  const board = build({
    projects: [project({ id: 'p1', name: 'Scent Sell' })],
    posts: [post({ id: 's1', brand_id: 'p1', status: 'scheduled', scheduled_at: iso(30) })],
  })
  assert.equal(board.projects[0].scheduledThisWeek, 0)
})

test('ordering is stable across two identical builds', () => {
  const input: Partial<BuildBoardInput> = {
    projects: [
      project({ id: 'a', name: 'Alpha' }),
      project({ id: 'b', name: 'Bravo' }),
      project({ id: 'c', name: 'Charlie' }),
    ],
  }
  const first = build(input).decisions.map((d) => d.id)
  const second = build(input).decisions.map((d) => d.id)
  assert.deepEqual(first, second)
})

test('many quiet projects collapse into one row instead of filling the list', () => {
  // Against the real portfolio the list filled entirely with "nothing planned
  // this week" — true of most projects most weeks — and pushed the stuck work
  // off the bottom. One row says the same thing and leaves room.
  const projects = Array.from({ length: 8 }, (_, i) =>
    project({ id: `q${i}`, name: `Quiet ${i}` }),
  )
  projects.push(project({ id: 'blk', name: 'TeleCheck' }))

  const board = build({
    projects,
    posts: [post({ id: 'f1', brand_id: 'blk', status: 'failed' })],
  })

  const quietRows = board.decisions.filter((d) => d.kind === 'nothing_planned')
  assert.equal(quietRows.length, 1, 'quiet projects must merge into a single row')
  assert.match(quietRows[0].headline, /8 projects/)
  assert.match(quietRows[0].suggestedAction, /Quiet 0/)

  // The blocked project must still be reachable, and above the merged row.
  const blocked = board.decisions.findIndex((d) => d.urgency === 'blocked')
  assert.ok(blocked >= 0, 'a blocked project must not be pushed off by quiet ones')
  assert.ok(blocked < board.decisions.indexOf(quietRows[0]))
})

test('two quiet projects stay as their own rows', () => {
  const board = build({
    projects: [project({ id: 'a', name: 'Alpha' }), project({ id: 'b', name: 'Bravo' })],
  })
  assert.equal(board.decisions.filter((d) => d.kind === 'nothing_planned').length, 2)
})

test('nothing shown to the owner names internal plumbing', () => {
  // He is not a developer. A row that says "OAuth token expired (401)" is a
  // row he cannot act on. Any word here is a leak of something he should
  // never have to learn.
  const forbidden = [
    'mixpost',
    'oauth',
    'vps',
    'webhook',
    'endpoint',
    'supabase',
    'ahpra', // the regime is named in prose only via "advertising rules"
    'null',
    'undefined',
    'http',
    '401',
    '500',
  ]

  const board = build({
    projects: [
      project({ id: 'p1', name: 'Downscale', compliance_flags: { ahpra: true, tga: true } }),
      project({ id: 'p2', name: 'Scent Sell' }),
      project({ id: 'p3', name: 'TeleScribe' }),
    ],
    posts: [
      post({ id: 's1', brand_id: 'p1', status: 'scheduled', scheduled_at: iso(1) }),
      post({ id: 'f1', brand_id: 'p2', status: 'failed' }),
      post({ id: 'd1', brand_id: 'p3', status: 'draft' }),
    ],
    accounts: [{ brandId: 'p3', accountName: 'TeleScribe Page', authorized: false }],
    approvals: [{ id: 'a1', brandId: 'p2', actionType: 'publish', createdAt: iso(-1) }],
  })

  const shown = [
    ...board.decisions.flatMap((d) => [d.headline, d.detail, d.suggestedAction]),
    ...board.projects.map((p) => p.suggestedAction),
  ]
    .join(' \n ')
    .toLowerCase()

  for (const word of forbidden) {
    assert.ok(
      !shown.includes(word),
      `board copy leaks internal vocabulary: "${word}"`,
    )
  }
})

test('a connection about to expire is raised before it stops working', () => {
  // Saying so only after it has stopped is saying so too late — content just
  // silently stops going out.
  const soon = new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const board = build({
    projects: [project({ id: 'p1', name: 'Downscale' })],
    accounts: [{ brandId: 'p1', accountName: 'Downscale Page', authorized: true, expiresAt: soon }],
  })

  const row = board.decisions.find((d) => d.kind === 'expiring_soon')
  assert.ok(row, 'an expiring connection must be raised')
  assert.equal(row!.urgency, 'blocked')
  assert.deepEqual(board.projects[0].expiringSoon, ['Downscale Page'])
  assert.equal(board.projects[0].state, 'attention')
})

test('a connection with plenty of time left is left alone', () => {
  const later = new Date(NOW.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()
  const board = build({
    projects: [project({ id: 'p1', name: 'Downscale' })],
    accounts: [{ brandId: 'p1', accountName: 'Downscale Page', authorized: true, expiresAt: later }],
  })
  assert.equal(board.decisions.some((d) => d.kind === 'expiring_soon'), false)
  assert.deepEqual(board.projects[0].expiringSoon, [])
})

test('a connection with no known expiry is not reported as expiring', () => {
  // Most connections do not report one. Treating unknown as imminent would put
  // every project on the board asking to renew something that is fine.
  const board = build({
    projects: [project({ id: 'p1', name: 'Downscale' })],
    accounts: [{ brandId: 'p1', accountName: 'Downscale Page', authorized: true }],
  })
  assert.equal(board.decisions.some((d) => d.kind === 'expiring_soon'), false)
})

test('an already-lapsed connection outranks one merely expiring', () => {
  const soon = new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()
  const board = build({
    projects: [project({ id: 'p1', name: 'Downscale' })],
    accounts: [
      { brandId: 'p1', accountName: 'Dead Page', authorized: false },
      { brandId: 'p1', accountName: 'Dying Page', authorized: true, expiresAt: soon },
    ],
  })
  const lapsedAt = board.decisions.findIndex((d) => d.kind === 'needs_reconnecting')
  const expiringAt = board.decisions.findIndex((d) => d.kind === 'expiring_soon')
  assert.ok(lapsedAt < expiringAt, 'something already stopped matters more than something about to')
})
