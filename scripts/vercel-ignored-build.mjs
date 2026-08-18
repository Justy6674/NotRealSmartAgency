#!/usr/bin/env node
/**
 * Vercel Ignored Build Step.
 *
 * Exit 0 = skip this deploy (leave the last good production build live).
 * Exit 1 = go ahead and build.
 *
 * Production only: if GitHub's Quality check has already finished and failed
 * for this commit, do not ship it. Preview deploys always build. A missing
 * token or a check that has not finished yet falls through to the production
 * build command, which runs the tests itself — so a red suite still cannot
 * go live, and we do not skip the first deploy of a commit that has not
 * been checked yet.
 */
const env = process.env.VERCEL_ENV ?? ''
if (env !== 'production') process.exit(1)

const sha = process.env.VERCEL_GIT_COMMIT_SHA
const owner = process.env.VERCEL_GIT_REPO_OWNER
const repo = process.env.VERCEL_GIT_REPO_SLUG
if (!sha || !owner || !repo) process.exit(1)

const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=20`
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'nrs-vercel-ignored-build',
}
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
}

try {
  const res = await fetch(url, { headers })
  if (!res.ok) process.exit(1)
  const body = await res.json()
  const quality = (body.check_runs ?? []).find(
    (run) => run.name === 'quality' || run.name === 'Quality',
  )
  if (quality?.status === 'completed' && quality.conclusion === 'failure') {
    console.log(`[vercel-ignored-build] Quality failed for ${sha} — skipping production deploy`)
    process.exit(0)
  }
} catch (err) {
  console.error('[vercel-ignored-build] check lookup failed, building anyway:', err)
}

process.exit(1)
