'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useCallback, useEffect } from 'react'
import type { PostPlatform } from '@/types/database'

const PLATFORM_LIMITS: Record<string, { label: string; maxChars: number; icon: string }> = {
  instagram:  { label: 'Instagram',  maxChars: 2200,   icon: 'Instagram' },
  facebook:   { label: 'Facebook',   maxChars: 63206,  icon: 'Facebook' },
  linkedin:   { label: 'LinkedIn',   maxChars: 3000,   icon: 'Linkedin' },
  twitter:    { label: 'X',          maxChars: 280,    icon: 'Twitter' },
  tiktok:     { label: 'TikTok',     maxChars: 2200,   icon: 'Music2' },
  youtube:    { label: 'YouTube',    maxChars: 5000,   icon: 'Youtube' },
}

export { PLATFORM_LIMITS }

interface PostEditorProps {
  content: string
  onContentChange: (text: string) => void
  selectedPlatforms: PostPlatform[]
  onPlatformsChange: (platforms: PostPlatform[]) => void
  hashtags: string
  onHashtagsChange: (hashtags: string) => void
  disabled?: boolean
}

const ALL_PLATFORMS: PostPlatform[] = ['instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube']

export function PostEditor({
  content,
  onContentChange,
  selectedPlatforms,
  onPlatformsChange,
  hashtags,
  onHashtagsChange,
  disabled = false,
}: PostEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: 'Write your post here...',
      }),
      CharacterCount,
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onContentChange(ed.getText())
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm prose-invert max-w-none min-h-[180px] px-4 py-3 focus:outline-none font-[family-name:var(--font-ibm-plex-sans)] text-sm leading-relaxed',
      },
    },
  })

  // Sync external content changes (e.g. AI-generated content) into the editor
  useEffect(() => {
    if (editor && content !== editor.getText()) {
      editor.commands.setContent(content ? `<p>${content.replace(/\n/g, '</p><p>')}</p>` : '')
    }
    // Only sync when content prop changes externally, not from editor updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  const togglePlatform = useCallback(
    (platform: PostPlatform) => {
      if (selectedPlatforms.includes(platform)) {
        onPlatformsChange(selectedPlatforms.filter(p => p !== platform))
      } else {
        onPlatformsChange([...selectedPlatforms, platform])
      }
    },
    [selectedPlatforms, onPlatformsChange],
  )

  const charCount = editor?.storage.characterCount?.characters() ?? 0

  // Tightest character limit among selected platforms
  const tightestLimit = selectedPlatforms.length > 0
    ? Math.min(...selectedPlatforms.map(p => PLATFORM_LIMITS[p]?.maxChars ?? Infinity))
    : Infinity

  const isOverLimit = tightestLimit !== Infinity && charCount > tightestLimit

  return (
    <div className="flex flex-col gap-4">
      {/* Platform selector */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          Platforms
        </label>
        <div className="flex flex-wrap gap-2">
          {ALL_PLATFORMS.map(platform => {
            const info = PLATFORM_LIMITS[platform]
            const selected = selectedPlatforms.includes(platform)
            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                disabled={disabled}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? 'bg-[oklch(0.75_0.06_240)] text-[oklch(0.15_0.02_240)]'
                    : 'bg-[oklch(0.22_0.02_240)] text-muted-foreground hover:bg-[oklch(0.28_0.03_240)]'
                }`}
              >
                {info.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Editor area */}
      <div className="rounded-lg border border-border bg-[oklch(0.14_0.01_240)] overflow-hidden">
        <EditorContent editor={editor} />
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <span className={`text-xs font-mono ${isOverLimit ? 'text-red-400' : 'text-muted-foreground'}`}>
            {charCount.toLocaleString()}
            {tightestLimit !== Infinity && ` / ${tightestLimit.toLocaleString()}`}
          </span>
          {selectedPlatforms.length > 0 && (
            <div className="flex gap-2">
              {selectedPlatforms.map(p => {
                const info = PLATFORM_LIMITS[p]
                const over = charCount > info.maxChars
                return (
                  <span
                    key={p}
                    className={`text-[10px] font-mono ${over ? 'text-red-400' : 'text-muted-foreground/60'}`}
                  >
                    {info.label}: {charCount}/{info.maxChars}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Hashtag input */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Hashtags
        </label>
        <input
          type="text"
          value={hashtags}
          onChange={e => onHashtagsChange(e.target.value)}
          disabled={disabled}
          placeholder="#marketing #brand #content"
          className="w-full rounded-lg border border-border bg-[oklch(0.14_0.01_240)] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[oklch(0.55_0.1_240)] font-[family-name:var(--font-ibm-plex-sans)]"
        />
      </div>
    </div>
  )
}
