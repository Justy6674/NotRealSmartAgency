/**
 * Inspect the current Director (overall) agent_configs row.
 * Read-only — just so we know what the base persona looks like before we
 * decide how to update it.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = resolve(import.meta.dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.+)$/)
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data, error } = await admin
  .from('agent_configs')
  .select('*')
  .eq('agent_type', 'overall')
  .limit(1)
  .single()

if (error) {
  console.error('❌', error.message)
  process.exit(1)
}

console.log('Columns:', Object.keys(data))
console.log('\n━━━ FULL system_prompt ━━━\n')
console.log(data.system_prompt)
