'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useEffect } from 'react'
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

export function PostEditor({
  content,
  onContentChange,
  selectedPlatforms,
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
          'prose prose-sm max-w-none min-h-[150px] px-4 py-3 focus:outline-none text-sm leading-relaxed text-foreground',
      },
    },
  })

  // Sync external content changes (e.g. AI-generated content) into the editor
  useEffect(() => {
    if (editor && content !== editor.getText()) {
      editor.commands.setContent(content ? `<p>${content.replace(/\n/g, '</p><p>')}</p>` : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  const charCount = editor?.storage.characterCount?.characters() ?? 0

  // Tightest character limit among selected platforms
  const tightestLimit = selectedPlatforms.length > 0
    ? Math.min(...selectedPlatforms.map(p => PLATFORM_LIMITS[p]?.maxChars ?? Infinity))
    : Infinity

  const isOverLimit = tightestLimit !== Infinity && charCount > tightestLimit

  return (
    <div className="flex flex-col gap-2">
      {/* Editor area — light background, readable text */}
      <div className="rounded-lg border border-border bg-background overflow-hidden">
        <EditorContent editor={editor} />
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <span className={`text-xs font-mono ${isOverLimit ? 'text-red-400' : 'text-muted-foreground'}`}>
            {charCount.toLocaleString()}
            {tightestLimit !== Infinity && ` / ${tightestLimit.toLocaleString()}`}
          </span>
          {selectedPlatforms.length > 0 && (
            <div className="flex gap-3">
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
    </div>
  )
}
