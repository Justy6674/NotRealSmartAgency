'use client'

import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { ScheduledPost } from '@/types/database'

const PLATFORM_DOT_COLOURS: Record<string, string> = {
  instagram: 'bg-pink-400',
  facebook: 'bg-blue-400',
  linkedin: 'bg-sky-400',
  tiktok: 'bg-cyan-400',
  youtube: 'bg-red-400',
  twitter: 'bg-zinc-400',
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDays(): Date[] {
  const now = new Date()
  const dayOfWeek = now.getDay()
  // Monday = 0 offset
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

interface WeekAtGlanceProps {
  posts: ScheduledPost[]
}

export function WeekAtGlance({ posts }: WeekAtGlanceProps) {
  const weekDays = getWeekDays()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Group posts by day
  const postsByDay = weekDays.map(day => {
    const dayPosts = posts.filter(p => {
      const postDate = new Date(p.scheduled_at || p.created_at)
      return isSameDay(postDate, day) &&
        ['scheduled', 'published', 'draft', 'publishing'].includes(p.status)
    })
    return { day, posts: dayPosts }
  })

  const handleFillDay = (day: Date) => {
    const dayName = day.toLocaleDateString('en-AU', { weekday: 'long' })
    sendToDirector(`Create a post for ${dayName}`)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">This Week</h3>

      <div className="grid grid-cols-7 gap-1">
        {postsByDay.map(({ day, posts: dayPosts }, i) => {
          const isToday = isSameDay(day, today)
          const isEmpty = dayPosts.length === 0

          return (
            <div
              key={i}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg py-2 px-1',
                isToday && 'ring-1 ring-primary/30 bg-primary/5'
              )}
            >
              {/* Day label */}
              <span className={cn(
                'text-[10px] font-medium',
                isToday ? 'text-primary' : 'text-muted-foreground'
              )}>
                {DAY_LABELS[i]}
              </span>

              {/* Day number */}
              <span className={cn(
                'text-xs font-medium',
                isToday ? 'text-foreground' : 'text-muted-foreground/70'
              )}>
                {day.getDate()}
              </span>

              {/* Platform dots or add button */}
              <div className="flex flex-wrap justify-center gap-0.5 min-h-[12px]">
                {dayPosts.length > 0 ? (
                  dayPosts.slice(0, 4).map((post, j) => (
                    <span
                      key={j}
                      className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        PLATFORM_DOT_COLOURS[post.platform] ?? 'bg-zinc-500'
                      )}
                      title={`${post.platform}: ${post.caption?.slice(0, 30)}...`}
                    />
                  ))
                ) : (
                  <button
                    onClick={() => handleFillDay(day)}
                    className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Plus className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>

              {/* Count if > 4 */}
              {dayPosts.length > 4 && (
                <span className="text-[9px] text-muted-foreground">+{dayPosts.length - 4}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Platform colour legend */}
      {(() => {
        const usedPlatforms = [...new Set(posts.map(p => p.platform))]
        if (usedPlatforms.length === 0) return null
        return (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {usedPlatforms.map(platform => (
              <span key={platform} className="inline-flex items-center gap-1">
                <span className={cn('h-2 w-2 rounded-full', PLATFORM_DOT_COLOURS[platform] ?? 'bg-zinc-500')} />
                <span className="text-[10px] text-muted-foreground capitalize">{platform}</span>
              </span>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
