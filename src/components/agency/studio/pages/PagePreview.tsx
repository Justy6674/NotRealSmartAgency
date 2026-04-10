'use client'

import { PhoneFrame } from '../preview/PhoneFrame'
import { ExternalLink } from 'lucide-react'

export interface PageBlock {
  id: string
  type: 'heading' | 'text' | 'image' | 'link_button' | 'social_links' | 'bio' | 'cta'
  data: Record<string, unknown>
}

interface PagePreviewProps {
  blocks: PageBlock[]
  brandName?: string
}

function HeadingBlock({ data }: { data: Record<string, unknown> }) {
  const size = (data.size as string) ?? 'h2'
  const text = (data.text as string) ?? ''
  const fontSize = size === 'h1' ? 20 : size === 'h2' ? 16 : 14
  const weight = size === 'h1' ? 800 : 700

  return (
    <div className="px-4 py-2">
      <p style={{ fontSize, fontWeight: weight, color: 'oklch(0.95 0 240)', lineHeight: 1.3 }}>
        {text || 'Heading'}
      </p>
    </div>
  )
}

function TextBlock({ data }: { data: Record<string, unknown> }) {
  const text = (data.text as string) ?? ''
  return (
    <div className="px-4 py-1.5">
      <p style={{ fontSize: 12, color: 'oklch(0.75 0 240)', lineHeight: 1.6 }}>
        {text || 'Paragraph text'}
      </p>
    </div>
  )
}

function ImageBlock({ data }: { data: Record<string, unknown> }) {
  const url = (data.url as string) ?? ''
  const alt = (data.alt as string) ?? ''
  return (
    <div className="px-4 py-1.5">
      {url ? (
        <div
          style={{
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: 8,
            background: `url(${url}) center/cover`,
          }}
          role="img"
          aria-label={alt}
        />
      ) : (
        <div
          className="flex items-center justify-center"
          style={{
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: 8,
            background: 'oklch(0.15 0.005 240)',
            color: 'oklch(0.4 0 240)',
            fontSize: 11,
          }}
        >
          Image placeholder
        </div>
      )}
    </div>
  )
}

function LinkButtonBlock({ data }: { data: Record<string, unknown> }) {
  const label = (data.label as string) ?? 'Link'
  const colour = (data.colour as string) ?? 'oklch(0.55 0.15 250)'
  return (
    <div className="px-4 py-1.5">
      <div
        className="flex items-center justify-center gap-1.5 rounded-full py-2.5"
        style={{ background: colour, color: '#fff', fontSize: 13, fontWeight: 600 }}
      >
        {label}
        <ExternalLink className="h-3 w-3" />
      </div>
    </div>
  )
}

function SocialLinksBlock({ data }: { data: Record<string, unknown> }) {
  const links = (data.links as Array<{ platform: string; url: string }>) ?? []
  if (!links.length) {
    return (
      <div className="flex justify-center gap-3 px-4 py-2">
        {['IG', 'FB', 'TW', 'LI'].map(p => (
          <div
            key={p}
            className="flex items-center justify-center rounded-full"
            style={{ width: 32, height: 32, background: 'oklch(0.2 0.005 240)', color: 'oklch(0.6 0 240)', fontSize: 9, fontWeight: 700 }}
          >
            {p}
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="flex justify-center gap-3 px-4 py-2">
      {links.map((link, i) => (
        <div
          key={i}
          className="flex items-center justify-center rounded-full"
          style={{ width: 32, height: 32, background: 'oklch(0.2 0.005 240)', color: 'oklch(0.6 0 240)', fontSize: 9, fontWeight: 700 }}
        >
          {link.platform.slice(0, 2).toUpperCase()}
        </div>
      ))}
    </div>
  )
}

function BioBlock({ data }: { data: Record<string, unknown> }) {
  const name = (data.name as string) ?? ''
  const tagline = (data.tagline as string) ?? ''
  const avatar = (data.avatar as string) ?? ''
  return (
    <div className="flex flex-col items-center px-4 py-3">
      <div
        className="rounded-full"
        style={{
          width: 56,
          height: 56,
          background: avatar
            ? `url(${avatar}) center/cover`
            : 'linear-gradient(135deg, oklch(0.45 0.18 250), oklch(0.55 0.15 230))',
        }}
      />
      <p style={{ fontSize: 14, fontWeight: 700, color: 'oklch(0.95 0 240)', marginTop: 8 }}>
        {name || 'Your Name'}
      </p>
      <p style={{ fontSize: 11, color: 'oklch(0.6 0 240)', marginTop: 2 }}>
        {tagline || 'Your tagline'}
      </p>
    </div>
  )
}

function CtaBlock({ data }: { data: Record<string, unknown> }) {
  const headline = (data.headline as string) ?? ''
  const description = (data.description as string) ?? ''
  const buttonLabel = (data.buttonLabel as string) ?? 'Get started'
  return (
    <div className="px-4 py-3">
      <div
        className="rounded-xl p-4"
        style={{ background: 'oklch(0.15 0.01 250)', border: '1px solid oklch(0.25 0.01 250)' }}
      >
        <p style={{ fontSize: 14, fontWeight: 700, color: 'oklch(0.95 0 240)' }}>
          {headline || 'Call to action'}
        </p>
        {description && (
          <p style={{ fontSize: 11, color: 'oklch(0.65 0 240)', marginTop: 4, lineHeight: 1.5 }}>
            {description}
          </p>
        )}
        <div
          className="mt-3 flex items-center justify-center rounded-lg py-2"
          style={{ background: 'oklch(0.55 0.15 250)', color: '#fff', fontSize: 12, fontWeight: 600 }}
        >
          {buttonLabel}
        </div>
      </div>
    </div>
  )
}

const BLOCK_RENDERERS: Record<string, React.ComponentType<{ data: Record<string, unknown> }>> = {
  heading: HeadingBlock,
  text: TextBlock,
  image: ImageBlock,
  link_button: LinkButtonBlock,
  social_links: SocialLinksBlock,
  bio: BioBlock,
  cta: CtaBlock,
}

export function PagePreview({ blocks, brandName }: PagePreviewProps) {
  return (
    <PhoneFrame>
      <div className="flex h-full flex-col overflow-y-auto" style={{ background: 'oklch(0.08 0.005 240)' }}>
        {/* Mini nav bar */}
        <div className="flex items-center justify-center py-3" style={{ borderBottom: '1px solid oklch(0.15 0.005 240)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'oklch(0.8 0 240)' }}>
            {brandName ?? 'My Page'}
          </span>
        </div>

        {/* Blocks */}
        <div className="flex-1 py-2">
          {blocks.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p style={{ fontSize: 11, color: 'oklch(0.4 0 240)' }}>Add blocks to see a preview</p>
            </div>
          ) : (
            blocks.map(block => {
              const Renderer = BLOCK_RENDERERS[block.type]
              if (!Renderer) return null
              return <Renderer key={block.id} data={block.data} />
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center py-2" style={{ borderTop: '1px solid oklch(0.15 0.005 240)' }}>
          <span style={{ fontSize: 9, color: 'oklch(0.35 0 240)' }}>
            Built with NotRealSmart
          </span>
        </div>
      </div>
    </PhoneFrame>
  )
}
