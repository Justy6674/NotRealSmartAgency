/**
 * Issue an NRS MCP access key scoped to every active project.
 *
 * Uses the same `issueScopedMcpAccessKey` service the Settings UI calls, so the
 * key and its per-project `mcp` grants are created exactly as they would be in
 * the app — no bespoke insert that could drift from the real auth path.
 *
 * The raw key is shown once, by design. It is written to the target env file
 * rather than printed in full, so it does not end up in shell history or logs.
 *
 * Usage: npx tsx scripts/issue-mcp-key.ts "<key name>" [path/to/.env] [ENV_VAR_NAME]
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { issueScopedMcpAccessKey } from '@/lib/auth/api-key'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
  const match = line.match(/^\s*(?:export\s+)?([A-Z_0-9]+)\s*=\s*(.*)$/)
  if (!match || process.env[match[1]]) continue
  process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
}

const [, , nameArg, envPathArg, envVarArg] = process.argv
const keyName = nameArg ?? 'MCP connection'
const envVar = envVarArg ?? 'MCP_NOTREALSMART_API_KEY'

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: installation } = await admin
    .from('github_app_installations')
    .select('owner_user_id')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  const userId = installation?.owner_user_id as string | undefined
  if (!userId) {
    console.error('Could not determine the owner account.')
    process.exit(1)
  }

  const { data: projects } = await admin
    .from('brands')
    .select('id, name')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('name')

  if (!projects?.length) {
    console.error('No active projects to scope the key to.')
    process.exit(1)
  }

  console.log(`Scoping "${keyName}" to ${projects.length} active projects:`)
  for (const p of projects) console.log(`  · ${p.name}`)

  const key = await issueScopedMcpAccessKey({
    userId,
    projectIds: projects.map((p) => p.id),
    name: keyName,
  })

  console.log(`\nIssued key ${key.prefix}… (id ${key.id})`)

  if (!envPathArg) {
    console.log('\nNo env file given. The raw key is intentionally not printed.')
    console.log('Re-run with an env file path to have it written there.')
    return
  }

  const envPath = resolve(envPathArg)
  if (!existsSync(envPath)) {
    console.error(`Env file not found: ${envPath}`)
    process.exit(1)
  }

  // A timestamped backup, because this rewrites a file holding other secrets.
  const backup = `${envPath}.bak-${key.id.slice(0, 8)}`
  copyFileSync(envPath, backup)

  const contents = readFileSync(envPath, 'utf8')
  const line = `${envVar}=${key.raw}`
  const pattern = new RegExp(`^${envVar}=.*$`, 'm')
  const updated = pattern.test(contents)
    ? contents.replace(pattern, line)
    : `${contents.replace(/\n*$/, '\n')}${line}\n`

  writeFileSync(envPath, updated, { mode: 0o600 })
  console.log(`Wrote ${envVar} to ${envPath} (backup: ${backup})`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
