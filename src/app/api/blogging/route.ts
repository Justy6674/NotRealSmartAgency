import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  blogHandoverStatus,
  countByStatus,
  extractBlogImages,
  hostFromWebsite,
  summariseQueue,
  type BlogArticleRow,
} from '@/lib/blogging/handover'
import { healthChecklist, isRegulatedHealth } from '@/lib/blogging/health-checklist'
import { ideasFromPlan } from '@/lib/blogging/ideas-from-plan'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const brandId = new URL(request.url).searchParams.get('brandId')
  if (!brandId) return NextResponse.json({ error: 'brandId is required' }, { status: 400 })

  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id, name, website_url, compliance_flags, content_pillars')
    .eq('id', brandId)
    .single()

  if (brandError || !brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  const { data: rows, error } = await supabase
    .from('outputs')
    .select('id, title, content, is_approved, created_at, metadata')
    .eq('brand_id', brandId)
    .eq('output_type', 'blog_article')
    .order('created_at', { ascending: false })
    .limit(80)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const articles = (rows ?? []) as BlogArticleRow[]
  const visible = articles.filter((row) => blogHandoverStatus(row) !== 'dismissed')
  const flags = (brand.compliance_flags ?? {}) as { ahpra?: boolean; tga?: boolean }
  const healthcare = isRegulatedHealth(flags)

  const posts = visible.map((row) => {
    const status = blogHandoverStatus(row)
    const meta = row.metadata ?? {}
    const compliance = meta.compliance as
      | { isValid?: boolean; checkCompleted?: boolean }
      | undefined
    const review =
      compliance && typeof compliance.isValid === 'boolean'
        ? {
            isValid: Boolean(compliance.isValid),
            checkCompleted: Boolean(compliance.checkCompleted),
          }
        : null
    const wordCount =
      typeof meta.word_count === 'number'
        ? meta.word_count
        : row.content.split(/\s+/).filter(Boolean).length

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      status,
      created_at: row.created_at,
      target_keyword: typeof meta.target_keyword === 'string' ? meta.target_keyword : null,
      word_count: wordCount,
      images: extractBlogImages(row),
      checklist: healthcare ? healthChecklist(flags, review) : [],
      review_passed: Boolean(review?.isValid && review.checkCompleted),
    }
  })

  const counts = countByStatus(visible)
  const existingTitles = posts.map((post) => post.title)
  const ideas = ideasFromPlan({
    pillars: Array.isArray(brand.content_pillars) ? brand.content_pillars : [],
    existingTitles,
  })

  return NextResponse.json({
    brand: {
      name: brand.name,
      website_host: hostFromWebsite(brand.website_url),
      healthcare,
    },
    summary: summariseQueue(counts),
    counts,
    posts,
    ideas,
  })
}
