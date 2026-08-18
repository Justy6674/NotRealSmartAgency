#!/usr/bin/env node
/**
 * Production build that refuses to ship a red test suite.
 *
 * Tests run in a child process with the same non-secret placeholders CI uses,
 * so they cannot bake a dummy NEXT_PUBLIC_SUPABASE_URL into the client bundle
 * and cannot hit live Supabase. The parent then runs the real production build
 * with Vercel's injected env.
 */
import { spawnSync } from 'node:child_process'

function run(command, args, extraEnv) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
    shell: false,
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (process.env.VERCEL_ENV === 'production') {
  run('npm', ['test'], {
    RESEND_API_KEY: 're_ci_build_placeholder',
    NEXT_PUBLIC_SUPABASE_URL: 'https://ci-placeholder.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'ci_build_placeholder',
  })
}

run('npm', ['run', 'build'])
