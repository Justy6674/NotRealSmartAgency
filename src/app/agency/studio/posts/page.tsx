'use client'

export const dynamic = 'force-dynamic'

import { PostsIndex } from '@/components/agency/studio/posts/PostsIndex'

export default function PostsIndexPage() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <PostsIndex />
    </div>
  )
}
