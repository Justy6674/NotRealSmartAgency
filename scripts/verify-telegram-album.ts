/**
 * Exercise the Telegram album path end to end, minus Telegram's own file
 * transfer.
 *
 * Everything after the download is NRS code, and that is exactly where both
 * faults were: media_group_id was ignored, so an album became N posts, and the
 * Director was only asked for captions so nothing reached the review queue.
 * This runs the real resolveAlbum, the real buildMediaDirective, and a real
 * Director job on the 'telegram' channel.
 *
 * Existing images are tagged with an album id for the run and untagged after,
 * so no junk rows are left behind.
 *
 * Usage: npx tsx scripts/verify-telegram-album.ts
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { resolveAlbum, buildMediaDirective } from '@/lib/telegram/telegram-album'
import { createTelegramDirectorExecution } from '@/lib/agents/director-execution'
import { runDirectorJob } from '@/lib/mcp/director-job'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
  const match = line.match(/^\s*(?:export\s+)?([A-Z_0-9]+)\s*=\s*(.*)$/)
  if (!match || process.env[match[1]]) continue
  process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
}

const BRAND = '941fd585-1f85-4646-a1d7-e000aa0ca00a' // ScentSell
const GRANT = '7c0d5002-b7ec-4eeb-b540-5cf01372d0cc' // its active telegram grant
const ALBUM_ID = `verify-${Date.now()}`

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: brand } = await admin
    .from('brands')
    .select('user_id')
    .eq('id', BRAND)
    .single()
  const userId = brand!.user_id as string

  // Three real images, tagged as if they arrived together as one Telegram album.
  const { data: images } = await admin
    .from('media_items')
    .select('id, file_name, metadata')
    .eq('brand_id', BRAND)
    .ilike('file_name', 'scentsell-explainer-%')
    .order('file_name', { ascending: true })
    .limit(3)

  const members = images ?? []
  if (members.length < 3) throw new Error('need 3 images to simulate an album')

  console.log(`Tagging ${members.length} images as Telegram album ${ALBUM_ID}`)
  for (const image of members) {
    await admin
      .from('media_items')
      .update({
        metadata: {
          ...((image.metadata as Record<string, unknown> | null) ?? {}),
          telegram_media_group_id: ALBUM_ID,
        },
      })
      .eq('id', image.id)
  }

  try {
    // Every album message runs this. Exactly one must come back the leader.
    const results = []
    for (const image of members) {
      results.push(
        await resolveAlbum({
          supabase: admin,
          brandId: BRAND,
          mediaGroupId: ALBUM_ID,
          myMediaItemId: image.id as string,
          settleMs: 200,
        }),
      )
    }

    const leaders = results.filter((r) => r.isLeader)
    console.log(`\nLeader election: ${leaders.length} leader of ${results.length} messages`)
    console.log(`Album assembled : ${leaders[0]?.mediaItemIds.length} media items`)
    if (leaders.length !== 1) throw new Error(`expected exactly 1 leader, got ${leaders.length}`)

    const directive = buildMediaDirective({
      kind: 'photo',
      mediaItemIds: leaders[0].mediaItemIds,
      description: 'ScentSell explainer slides',
    })

    // A real Director run on the telegram channel, exactly as the webhook queues it.
    const message = 'Make a post out of these' + directive
    const { data: job } = await admin
      .from('mcp_jobs')
      .insert({
        user_id: userId,
        brand_id: BRAND,
        channel: 'telegram',
        project_access_grant_id: GRANT,
        policy_version: 1,
        job_type: 'director_chat',
        status: 'queued',
        input: { brand_id: BRAND, message },
      })
      .select('id')
      .single()

    const execution = createTelegramDirectorExecution({
      userId,
      grant: { grantId: GRANT, projectId: BRAND, capabilities: ['director:chat'] },
      chatId: 'verify-run',
    })

    console.log(`\nRunning Director on the telegram channel (job ${job!.id})…`)
    await runDirectorJob(job!.id as string, execution, { brand_id: BRAND, message })

    const { data: done } = await admin
      .from('mcp_jobs')
      .select('status, result, error')
      .eq('id', job!.id)
      .single()

    console.log(`Director job status: ${done!.status}`)
    if (done!.error) console.log(`error: ${done!.error}`)

    // What actually landed.
    const { data: drafts } = await admin
      .from('scheduled_posts')
      .select('id, platform, post_type, caption, media_item_ids, metadata, created_at')
      .eq('brand_id', BRAND)
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    console.log('\nDrafts created in the last 10 minutes:')
    for (const draft of drafts ?? []) {
      const mixpost = (draft.metadata as Record<string, unknown> | null)?.mixpost as
        | { post_uuid?: string }
        | undefined
      console.log(
        `  ${draft.platform.padEnd(10)} ${String(draft.post_type).padEnd(9)} ` +
          `media:${(draft.media_item_ids as string[]).length} ` +
          `caption:${(draft.caption as string).length} ` +
          `mixpost:${mixpost?.post_uuid ?? 'NONE'}`,
      )
    }
  } finally {
    console.log('\nRemoving the album tag from the images…')
    for (const image of members) {
      const metadata = { ...((image.metadata as Record<string, unknown> | null) ?? {}) }
      delete metadata.telegram_media_group_id
      await admin.from('media_items').update({ metadata }).eq('id', image.id)
    }
    console.log('Done.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
