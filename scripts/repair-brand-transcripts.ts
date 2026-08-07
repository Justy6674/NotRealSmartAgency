/**
 * Correct brand names already mis-heard in stored transcripts.
 *
 * The recogniser now gets the brand as a boosted keyword and the pipeline
 * repairs what still slips through, but neither helps the transcripts already
 * on disk — and those are what every future caption, tag and search is written
 * from. One clip transcribed as "Sentel" keeps producing copy that spells the
 * owner's company wrong for as long as it sits there.
 *
 * Dry run by default. Pass --apply to write.
 *
 *   npx tsx scripts/repair-brand-transcripts.ts
 *   npx tsx scripts/repair-brand-transcripts.ts --apply
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { correctBrandNameWithCount } from '../src/lib/transcription/brand-vocabulary'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [
      line.slice(0, line.indexOf('=')),
      line.slice(line.indexOf('=') + 1).replace(/^["']|["']$/g, ''),
    ]),
)

const apply = process.argv.includes('--apply')

async function main() {
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: brands, error: brandError } = await db.from('brands').select('id, name')
  if (brandError || !brands) throw new Error(`Could not read brands: ${brandError?.message}`)

  let scanned = 0
  let changed = 0
  let mentions = 0

  for (const brand of brands) {
    const { data: rows } = await db
      .from('media_items')
      .select('id, file_name, transcription')
      .eq('brand_id', brand.id)
      .not('transcription', 'is', null)

    for (const row of rows ?? []) {
      scanned += 1
      const before = row.transcription as string
      const { text, corrections } = correctBrandNameWithCount(before, {
        canonical: brand.name as string,
        terms: [],
      })
      if (corrections === 0) continue

      changed += 1
      mentions += corrections
      console.log(`${brand.name} · ${row.file_name}: ${corrections} mention(s)`)

      // Show the first correction in context so the change is inspectable
      // rather than taken on trust.
      const at = before.search(new RegExp(`\\b\\w*${(brand.name as string).slice(1, 4)}\\w*`, 'i'))
      if (at >= 0) {
        console.log(`   before: …${before.slice(Math.max(0, at - 30), at + 40).trim()}…`)
        console.log(`   after:  …${text.slice(Math.max(0, at - 30), at + 40).trim()}…`)
      }

      if (apply) {
        const { error } = await db
          .from('media_items')
          .update({ transcription: text })
          .eq('id', row.id)
        if (error) console.error(`   FAILED to write: ${error.message}`)
      }
    }
  }

  console.log(
    `\n${scanned} transcripts scanned, ${changed} need correcting, ${mentions} mis-heard mention(s).`,
  )
  console.log(apply ? 'Written.' : 'Dry run — nothing written. Re-run with --apply.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
