/**
 * Run the consolidated media processing pipeline against a live media_items row.
 * Uses tsx so TypeScript imports + @/* path aliases resolve.
 *
 * Usage: npx tsx scripts/run-pipeline.ts <media_item_id>
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { runMediaProcessingPipeline } from '@/lib/media/process-pipeline'

async function main() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const envPath = resolve(__dirname, '..', '.env.local')
  const envContent = readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.+)$/)
    if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const mediaItemId = process.argv[2]
  if (!mediaItemId) {
    console.error('Usage: npx tsx scripts/run-pipeline.ts <media_item_id>')
    process.exit(1)
  }

  console.log(`\n━━━ RUN PIPELINE ${mediaItemId} ━━━`)
  const start = Date.now()
  const result = await runMediaProcessingPipeline({ supabase: admin, mediaItemId })
  const duration = Date.now() - start

  console.log(`\nTotal: ${(duration / 1000).toFixed(1)}s`)
  console.log(`Success: ${result.success}`)
  if (result.error) console.log(`Error: ${result.error}`)
  console.log(`\nReport:`)
  console.log(JSON.stringify(result.report, null, 2))
  console.log(`\nPersisted fields:`)
  console.log(`  thumbnail_url:        ${result.thumbnail_url ? '✓ set' : '(null)'}`)
  console.log(`  transcription:        ${result.transcription ? `${result.transcription.length} chars` : '(null)'}`)
  console.log(`  transcription_status: ${result.transcription_status}`)
  console.log(`  ai_description:       ${result.ai_description ? result.ai_description.slice(0, 100) + '...' : '(null)'}`)
  console.log(`  tags:                 ${JSON.stringify(result.tags)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
