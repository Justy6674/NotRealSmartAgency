import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import type { SocialDeskAction } from './actions'
import type { SocialCommandContext, SocialCommandRepository } from './command-service'
import type { SocialPostDocumentV1 } from './model'
import type { SocialCommandReceipt } from './receipts'

const ROOT = process.cwd()
const SOCIAL = resolve(ROOT, 'src/lib/social')

async function loadSocial() {
  const required = [
    'actions.ts',
    'capabilities.ts',
    'command-service.ts',
    'model.ts',
    'reducer.ts',
    'receipts.ts',
    'schemas.ts',
    'fill-payload.ts',
    'apply-desk-actions.ts',
  ]
  const missing = required.filter((file) => !existsSync(resolve(SOCIAL, file)))
  assert.deepEqual(missing, [], `Slice 1 social command files are missing: ${missing.join(', ')}`)

  return {
    actions: await import('./actions'),
    capabilities: await import('./capabilities'),
    commandService: await import('./command-service'),
    model: await import('./model'),
    reducer: await import('./reducer'),
    schemas: await import('./schemas'),
  }
}

const ids = {
  user: '11111111-1111-4111-8111-111111111111',
  otherUser: '22222222-2222-4222-8222-222222222222',
  brand: '33333333-3333-4333-8333-333333333333',
  otherBrand: '44444444-4444-4444-8444-444444444444',
  composition: '55555555-5555-4555-8555-555555555555',
  mediaA: '66666666-6666-4666-8666-666666666666',
  mediaB: '77777777-7777-4777-8777-777777777777',
  commandA: '88888888-8888-4888-8888-888888888888',
  commandB: '99999999-9999-4999-8999-999999999999',
}

function documentFixture(): SocialPostDocumentV1 {
  return {
    schemaVersion: 1,
    compositionId: ids.composition,
    brandId: ids.brand,
    ownerUserId: ids.user,
    conversationId: null,
    revision: 0,
    lifecycle: 'editing',
    masterCaption: '',
    hashtags: [],
    contentType: 'feed',
    media: [],
    targets: [],
    schedule: { mode: 'draft', timezone: 'Australia/Sydney' },
    compliance: { warnings: [] },
    updatedAt: '2026-08-18T00:00:00.000Z',
  }
}

function commandFixture(action: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    commandId: ids.commandA,
    compositionId: ids.composition,
    brandId: ids.brand,
    expectedRevision: 0,
    source: 'manual',
    actorUserId: ids.user,
    action,
    createdAt: '2026-08-18T00:00:01.000Z',
    ...overrides,
  }
}

test('the strict command schema rejects unknown and invalid actions', async () => {
  const { schemas } = await loadSocial()
  assert.equal(schemas.SocialDeskCommandSchema.safeParse(
    commandFixture({ type: 'rewrite_dom', selector: '#caption', value: 'unsafe' }),
  ).success, false)
  assert.equal(schemas.SocialDeskCommandSchema.safeParse({
    ...commandFixture({ type: 'set_master_caption', caption: 'Valid' }),
    arbitraryPatch: { masterCaption: 'bypass' },
  }).success, false)
})

test('the reducer applies caption, platform, media, account, title, cover, options and schedule edits', async () => {
  const { reducer, capabilities } = await loadSocial()
  const context = {
    capabilities: capabilities.SOCIAL_PLATFORM_CAPABILITIES,
    now: '2026-08-18T00:00:10.000Z',
    mediaById: new Map([
      [ids.mediaA, { mediaItemId: ids.mediaA, position: 0, type: 'image' as const, title: 'A' }],
      [ids.mediaB, { mediaItemId: ids.mediaB, position: 0, type: 'video' as const, title: 'B' }],
    ]),
  }

  const actions = [
    { type: 'set_master_caption', caption: 'Measured caption' },
    { type: 'set_platforms', platforms: ['instagram', 'youtube'] },
    { type: 'choose_accounts', targetId: 'instagram', accountIds: ['ig-account'] },
    { type: 'set_platform_caption', targetId: 'instagram', caption: 'Instagram version' },
    { type: 'set_platform_title', targetId: 'youtube', title: 'A useful title' },
    { type: 'set_cover', targetId: 'instagram', source: { kind: 'media', mediaItemId: ids.mediaA } },
    { type: 'add_media', mediaItemId: ids.mediaA },
    { type: 'add_media', mediaItemId: ids.mediaB },
    { type: 'reorder_media', mediaItemIds: [ids.mediaB, ids.mediaA] },
    { type: 'set_content_type', contentType: 'reel' },
    { type: 'set_hashtags', hashtags: ['measured', '#bare'] },
    {
      type: 'set_platform_options',
      targetId: 'instagram',
      patch: { shareToFeed: true, isAiGenerated: false },
    },
    {
      type: 'set_schedule',
      schedule: { mode: 'at', scheduledAt: '2026-08-19T09:00:00+10:00', timezone: 'Australia/Sydney' },
    },
  ]

  let current = documentFixture()
  for (const action of actions) {
    current = reducer.reduceSocialCommand(current, action as SocialDeskAction, context).document
  }

  assert.equal(current.revision, actions.length)
  assert.equal(current.masterCaption, 'Measured caption')
  assert.deepEqual(current.hashtags, ['measured', 'bare'])
  assert.deepEqual(current.media.map((item: { mediaItemId: string; position: number }) => [item.mediaItemId, item.position]), [
    [ids.mediaB, 0],
    [ids.mediaA, 1],
  ])
  assert.equal(current.targets.find((target: { targetId: string }) => target.targetId === 'instagram')?.captionOverride, 'Instagram version')
  assert.deepEqual(current.targets.find((target: { targetId: string }) => target.targetId === 'instagram')?.accountIds, ['ig-account'])
  assert.equal(current.targets.find((target: { targetId: string }) => target.targetId === 'youtube')?.title, 'A useful title')
  assert.equal(current.schedule.mode, 'at')
})

test('platform capability validation rejects unsupported fields', async () => {
  const { reducer, capabilities } = await loadSocial()
  const withYouTube = reducer.reduceSocialCommand(
    documentFixture(),
    { type: 'set_platforms', platforms: ['youtube'] },
    { capabilities: capabilities.SOCIAL_PLATFORM_CAPABILITIES, now: '2026-08-18T00:00:10.000Z', mediaById: new Map() },
  ).document

  assert.throws(
    () => reducer.reduceSocialCommand(
      withYouTube,
      { type: 'set_platform_options', targetId: 'youtube', patch: { customThumbnailUrl: 'https://example.com/cover.jpg' } },
      { capabilities: capabilities.SOCIAL_PLATFORM_CAPABILITIES, now: '2026-08-18T00:00:11.000Z', mediaById: new Map() },
    ),
    (error: unknown) => (error as { code?: string }).code === 'UNSUPPORTED_OPTION',
  )
})

test('safe inverse actions restore caption, platforms, media and accounts', async () => {
  const { reducer, capabilities } = await loadSocial()
  const context = {
    capabilities: capabilities.SOCIAL_PLATFORM_CAPABILITIES,
    now: '2026-08-18T00:00:10.000Z',
    mediaById: new Map([[ids.mediaA, { mediaItemId: ids.mediaA, position: 0, type: 'image' as const }]]),
  }
  const original = documentFixture()
  const actions = [
    { type: 'set_master_caption', caption: 'Changed' },
    { type: 'set_platforms', platforms: ['instagram'] },
    { type: 'choose_accounts', targetId: 'instagram', accountIds: ['ig-account'] },
    { type: 'add_media', mediaItemId: ids.mediaA },
  ]

  let current = original
  const inverses: SocialDeskAction[] = []
  for (const action of actions) {
    const result = reducer.reduceSocialCommand(current, action as SocialDeskAction, context)
    assert.ok(result.inverseAction)
    inverses.unshift(result.inverseAction)
    current = result.document
  }
  for (const inverse of inverses) current = reducer.reduceSocialCommand(current, inverse, context).document

  assert.equal(current.masterCaption, original.masterCaption)
  assert.deepEqual(current.targets, original.targets)
  assert.deepEqual(current.media, original.media)
})

class MemoryRepository implements SocialCommandRepository {
  document = documentFixture()
  receipts = new Map<string, SocialCommandReceipt>()

  async getComposition() {
    return structuredClone(this.document)
  }

  async getReceipt(commandId: string) {
    return this.receipts.get(commandId) ?? null
  }

  async commit(input: {
    command: { commandId: string; expectedRevision: number }
    document: SocialPostDocumentV1
    receipt: SocialCommandReceipt
  }) {
    if (input.command.expectedRevision !== this.document.revision) return { conflictRevision: this.document.revision }
    this.document = structuredClone(input.document)
    this.receipts.set(input.command.commandId, structuredClone(input.receipt))
    return { document: structuredClone(this.document), receipt: structuredClone(input.receipt) }
  }
}

function serviceContext(repository: MemoryRepository, overrides: Partial<SocialCommandContext> = {}): SocialCommandContext {
  return {
    repository,
    authenticatedUserId: ids.user,
    canWriteBrand: async (actorUserId: string, brandId: string) => actorUserId === ids.user && brandId === ids.brand,
    validateAccounts: async () => true,
    loadMedia: async () => new Map(),
    now: () => '2026-08-18T00:00:10.000Z',
    ...overrides,
  }
}

test('the command service rejects stale revisions, wrong brands and spoofed users', async () => {
  const { commandService } = await loadSocial()

  const stale = await commandService.executeSocialCommand(
    serviceContext(new MemoryRepository()),
    commandFixture({ type: 'set_master_caption', caption: 'Stale' }, { expectedRevision: 9 }),
  )
  assert.equal(stale.receipt.errorCode, 'REVISION_CONFLICT')

  const wrongBrand = await commandService.executeSocialCommand(
    serviceContext(new MemoryRepository()),
    commandFixture({ type: 'set_master_caption', caption: 'Wrong brand' }, { brandId: ids.otherBrand }),
  )
  assert.equal(wrongBrand.receipt.errorCode, 'BRAND_MISMATCH')

  const spoofed = await commandService.executeSocialCommand(
    serviceContext(new MemoryRepository()),
    commandFixture({ type: 'set_master_caption', caption: 'Spoofed' }, { actorUserId: ids.otherUser }),
  )
  assert.equal(spoofed.receipt.errorCode, 'PERMISSION_DENIED')
})

test('duplicate command IDs are idempotent and return the original receipt', async () => {
  const { commandService } = await loadSocial()
  const repository = new MemoryRepository()
  const command = commandFixture({ type: 'set_master_caption', caption: 'Exactly once' })

  const first = await commandService.executeSocialCommand(serviceContext(repository), command)
  const duplicate = await commandService.executeSocialCommand(serviceContext(repository), {
    ...command,
    expectedRevision: 99,
  })

  assert.equal(first.receipt.commandId, duplicate.receipt.commandId)
  assert.equal(repository.document.revision, 1)
  assert.equal(repository.document.masterCaption, 'Exactly once')
})

test('undo applies the stored safe inverse as a new revision', async () => {
  const { commandService } = await loadSocial()
  const repository = new MemoryRepository()
  const applied = await commandService.executeSocialCommand(
    serviceContext(repository),
    commandFixture({ type: 'set_master_caption', caption: 'Undo me' }),
  )
  assert.equal(applied.document.masterCaption, 'Undo me')

  const undone = await commandService.executeSocialCommand(
    serviceContext(repository),
    commandFixture(
      { type: 'undo', commandId: ids.commandA },
      { commandId: ids.commandB, expectedRevision: 1 },
    ),
  )
  assert.equal(undone.document.masterCaption, '')
  assert.equal(undone.document.revision, 2)
  assert.equal(undone.receipt.status, 'undone')
})

test('Slice 1 has no pendingCaptionApply bridge and declares additive RLS tables', () => {
  const store = readFileSync(resolve(ROOT, 'src/stores/compose-desk-store.ts'), 'utf8')
  const creator = readFileSync(resolve(ROOT, 'src/components/agency/studio/post/PostCreator.tsx'), 'utf8')
  const actions = readFileSync(resolve(ROOT, 'src/components/agency/MessageActions.tsx'), 'utf8')
  const preview = readFileSync(resolve(ROOT, 'src/components/agency/inline/PostPreviewCard.tsx'), 'utf8')
  const migrationPath = resolve(ROOT, 'supabase/migrations/20260818010000_social_compositions_command_bus.sql')

  const tools = readFileSync(resolve(ROOT, 'src/lib/agents/tools/index.ts'), 'utf8')
  const chat = readFileSync(resolve(ROOT, 'src/components/agency/ChatMessage.tsx'), 'utf8')
  assert.doesNotMatch(`${store}\n${creator}\n${actions}\n${preview}`, /pendingCaptionApply|setPendingCaptionApply/)
  assert.match(`${store}\n${creator}\n${actions}`, /pendingDeskActions|enqueueDeskActions/)
  assert.match(tools, /fill_compose_desk/)
  assert.match(chat, /extractDeskFillFromMessage/)
  assert.ok(existsSync(migrationPath), 'Slice 1 migration is missing')
  const migration = readFileSync(migrationPath, 'utf8')
  assert.match(migration, /create table(?: if not exists)? public\.social_compositions/)
  assert.match(migration, /create table(?: if not exists)? public\.social_desk_commands/)
  assert.match(migration, /can_access_brand\(brand_id\)/)
  assert.match(migration, /can_write_for_owner\(/)
  assert.match(migration, /apply_social_desk_command/)
})
