'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, List, ListOrdered, Undo, Redo, Sparkles } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { EmojiPickerPopover } from './EmojiPickerPopover'
import { AiSpotlight } from './AiSpotlight'

interface RichCaptionEditorProps {
  value: string
  onChange: (plainText: string, html: string) => void
  placeholder?: string
  /** Optional max character count enforced by the TipTap extension */
  characterLimit?: number
  /** Compact mode strips some toolbar buttons for dense UIs */
  compact?: boolean
  /** Brand name passed through to AI Spotlight */
  brandName?: string
  /** Selected platforms passed through to AI Spotlight */
  platforms?: string[]
}

/**
 * TipTap-powered rich caption editor for the composer.
 *
 * Phase 3 of the Mixpost UI port. Replaces NRS's plain textarea with a
 * formatting-aware editor matching the feel of Mixpost's EditorClassic.vue
 * (339 LOC) — bold / italic / underline / link / bullet list / ordered
 * list / undo / redo / emoji picker.
 *
 * TipTap's output is HTML by default. Social platforms want plain text
 * (they strip HTML or render it literally depending on platform), so
 * this component emits BOTH plainText and html on every change. The
 * parent decides which to persist. For most flows, use plainText as
 * the caption body and discard the HTML.
 *
 * Hashtag and mention autocomplete are layered on in
 * HashtagMentionAutocomplete.tsx (separate extension) — not wired in
 * the initial cut so this component stays focused.
 */
export function RichCaptionEditor({
  value,
  onChange,
  placeholder = 'What do you want to say?',
  characterLimit,
  compact = false,
  brandName,
  platforms,
}: RichCaptionEditorProps) {
  const [spotlightOpen, setSpotlightOpen] = useState(false)
  // Memoise extensions to prevent TipTap duplicate-name warnings caused
  // by recreating the array on every render cycle.
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder }),
      ...(characterLimit
        ? [CharacterCount.configure({ limit: characterLimit })]
        : []),
    ],
    // Recreate only when placeholder or limit actually change
     
    [placeholder, characterLimit],
  )

  const editor = useEditor({
    extensions,
    content: value,
    editorProps: {
      attributes: {
        class:
          'min-h-[140px] max-h-[420px] overflow-y-auto rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring prose prose-sm dark:prose-invert max-w-none',
      },
    },
    onUpdate: ({ editor }) => {
      const plainText = editor.getText()
      const html = editor.getHTML()
      onChange(plainText, html)
    },
    // IMPORTANT: Next.js + React 19 hydration — immediate render is fine
    // because the editor only mounts on the client (use client directive).
    immediatelyRender: false,
  })

  // Keep internal editor state in sync when the parent resets the caption
  // (e.g. loading a draft or clearing the form). Only update if the
  // incoming value actually differs from the editor's current plaintext.
  useEffect(() => {
    if (!editor) return
    const current = editor.getText()
    if (current !== value) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  if (!editor) {
    return <div className="h-[140px] rounded-lg border border-border bg-muted/20 animate-pulse" />
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="space-y-1.5">
      {/* Toolbar */}
      <div className="flex items-center gap-1 flex-wrap">
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          label="Underline"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('link')}
          onClick={setLink}
          label="Link"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        {!compact && (
          <>
            <div className="mx-1 h-4 w-px bg-border" />
            <ToolbarButton
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              label="Bullet list"
            >
              <List className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              label="Numbered list"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </ToolbarButton>
            <div className="mx-1 h-4 w-px bg-border" />
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              label="Undo"
              disabled={!editor.can().undo()}
            >
              <Undo className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              label="Redo"
              disabled={!editor.can().redo()}
            >
              <Redo className="h-3.5 w-3.5" />
            </ToolbarButton>
          </>
        )}

        <div className="ml-auto flex items-center gap-1">
          <EmojiPickerPopover
            onSelect={(emoji) => editor.chain().focus().insertContent(emoji).run()}
          />
          <ToolbarButton
            onClick={() => setSpotlightOpen(true)}
            label="AI Spotlight"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          </ToolbarButton>
        </div>
      </div>

      {/* Editor surface */}
      <EditorContent editor={editor} />

      {/* AI Spotlight command palette */}
      <AiSpotlight
        open={spotlightOpen}
        onOpenChange={setSpotlightOpen}
        caption={value}
        brandName={brandName ?? 'Brand'}
        platforms={platforms ?? []}
        charLimit={characterLimit}
      />
    </div>
  )
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-md border border-transparent px-1.5 py-1 text-muted-foreground transition-colors ${
        active
          ? 'bg-muted text-foreground border-border'
          : 'hover:bg-muted hover:text-foreground'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  )
}
