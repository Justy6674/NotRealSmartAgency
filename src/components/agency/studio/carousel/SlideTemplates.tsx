import type { SlideDefinition, BrandTheme } from './types'

interface SlideProps {
  slide: SlideDefinition
  theme: BrandTheme
  width: number
  height: number
}

// ─── Intro Slide ──────────────────────────────────────────────────────────────

export function IntroSlide({ slide, theme, width, height }: SlideProps) {
  return (
    <div
      style={{
        width, height,
        background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary || theme.primary}dd)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: width * 0.08,
        fontFamily: '"IBM Plex Sans", sans-serif',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background pattern */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.06,
        background: `radial-gradient(circle at 30% 40%, #fff 1px, transparent 1px),
                     radial-gradient(circle at 70% 80%, #fff 1px, transparent 1px)`,
        backgroundSize: `${width * 0.05}px ${width * 0.05}px`,
      }} />

      {theme.logoUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={theme.logoUrl}
          alt=""
          style={{ height: height * 0.1, marginBottom: height * 0.04, objectFit: 'contain' }}
        />
      )}
      <div style={{
        fontSize: width * 0.07,
        fontWeight: 700,
        textAlign: 'center',
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
      }}>
        {slide.title || theme.name}
      </div>
      {slide.subtitle && (
        <div style={{
          fontSize: width * 0.035,
          fontWeight: 400,
          textAlign: 'center',
          marginTop: height * 0.02,
          opacity: 0.85,
        }}>
          {slide.subtitle}
        </div>
      )}
    </div>
  )
}

// ─── Content Slide ────────────────────────────────────────────────────────────

export function ContentSlide({ slide, theme, width, height }: SlideProps) {
  return (
    <div
      style={{
        width, height,
        background: slide.imageUrl
          ? `linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.8)), url(${slide.imageUrl}) center/cover`
          : theme.background || '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: width * 0.08,
        fontFamily: '"IBM Plex Sans", sans-serif',
        color: slide.imageUrl ? '#fff' : (theme.text || '#e4e4e7'),
        position: 'relative',
      }}
    >
      {/* Accent bar */}
      <div style={{
        width: width * 0.08,
        height: 4,
        background: theme.accent || theme.primary,
        borderRadius: 2,
        marginBottom: height * 0.03,
      }} />

      <div style={{
        fontSize: width * 0.06,
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '-0.01em',
      }}>
        {slide.title || 'Slide Title'}
      </div>

      {slide.body && (
        <div style={{
          fontSize: width * 0.032,
          fontWeight: 400,
          lineHeight: 1.6,
          marginTop: height * 0.025,
          opacity: 0.85,
        }}>
          {slide.body}
        </div>
      )}
    </div>
  )
}

// ─── Quote Slide ──────────────────────────────────────────────────────────────

export function QuoteSlide({ slide, theme, width, height }: SlideProps) {
  return (
    <div
      style={{
        width, height,
        background: theme.background || '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: width * 0.1,
        fontFamily: '"IBM Plex Sans", sans-serif',
        color: theme.text || '#e4e4e7',
        position: 'relative',
      }}
    >
      {/* Large quote mark */}
      <div style={{
        fontSize: width * 0.2,
        fontWeight: 700,
        color: theme.primary,
        opacity: 0.3,
        lineHeight: 0.8,
        position: 'absolute',
        top: height * 0.08,
        left: width * 0.06,
      }}>
        &ldquo;
      </div>

      <div style={{
        fontSize: width * 0.045,
        fontWeight: 500,
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 1.5,
        position: 'relative',
        zIndex: 1,
      }}>
        {slide.body || slide.title || 'Your quote here'}
      </div>

      {slide.subtitle && (
        <div style={{
          fontSize: width * 0.028,
          fontWeight: 400,
          marginTop: height * 0.03,
          color: theme.primary,
        }}>
          &mdash; {slide.subtitle}
        </div>
      )}
    </div>
  )
}

// ─── Stat Slide ───────────────────────────────────────────────────────────────

export function StatSlide({ slide, theme, width, height }: SlideProps) {
  return (
    <div
      style={{
        width, height,
        background: theme.background || '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: width * 0.08,
        fontFamily: '"IBM Plex Sans", sans-serif',
        color: theme.text || '#e4e4e7',
      }}
    >
      <div style={{
        fontSize: width * 0.16,
        fontWeight: 800,
        color: theme.primary,
        lineHeight: 1,
        letterSpacing: '-0.03em',
      }}>
        {slide.stat || '0'}
      </div>

      <div style={{
        fontSize: width * 0.04,
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.1em',
        marginTop: height * 0.02,
        opacity: 0.7,
      }}>
        {slide.statLabel || slide.title || 'Label'}
      </div>

      {slide.body && (
        <div style={{
          fontSize: width * 0.03,
          fontWeight: 400,
          textAlign: 'center',
          marginTop: height * 0.025,
          opacity: 0.6,
          maxWidth: '80%',
        }}>
          {slide.body}
        </div>
      )}
    </div>
  )
}

// ─── CTA Slide ────────────────────────────────────────────────────────────────

export function CTASlide({ slide, theme, width, height }: SlideProps) {
  return (
    <div
      style={{
        width, height,
        background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary || theme.primary}cc)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: width * 0.1,
        fontFamily: '"IBM Plex Sans", sans-serif',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        fontSize: width * 0.055,
        fontWeight: 700,
        textAlign: 'center',
        lineHeight: 1.3,
      }}>
        {slide.title || 'Ready to get started?'}
      </div>

      {slide.body && (
        <div style={{
          fontSize: width * 0.03,
          textAlign: 'center',
          marginTop: height * 0.02,
          opacity: 0.85,
        }}>
          {slide.body}
        </div>
      )}

      {/* CTA button */}
      <div style={{
        marginTop: height * 0.04,
        background: '#fff',
        color: theme.primary,
        fontSize: width * 0.035,
        fontWeight: 700,
        padding: `${height * 0.015}px ${width * 0.06}px`,
        borderRadius: width * 0.015,
      }}>
        {slide.subtitle || 'Learn More'}
      </div>

      {theme.logoUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={theme.logoUrl}
          alt=""
          style={{
            height: height * 0.05,
            marginTop: height * 0.04,
            objectFit: 'contain',
            opacity: 0.8,
          }}
        />
      )}
    </div>
  )
}

// ─── Image Slide ──────────────────────────────────────────────────────────────

export function ImageSlide({ slide, theme, width, height }: SlideProps) {
  return (
    <div
      style={{
        width, height,
        background: slide.imageUrl
          ? `url(${slide.imageUrl}) center/cover`
          : theme.background || '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        fontFamily: '"IBM Plex Sans", sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Gradient overlay at bottom */}
      {(slide.title || slide.body) && (
        <div style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
          padding: `${height * 0.15}px ${width * 0.06}px ${width * 0.06}px`,
          color: '#fff',
        }}>
          {slide.title && (
            <div style={{
              fontSize: width * 0.05,
              fontWeight: 700,
              lineHeight: 1.2,
            }}>
              {slide.title}
            </div>
          )}
          {slide.body && (
            <div style={{
              fontSize: width * 0.028,
              marginTop: height * 0.01,
              opacity: 0.85,
              lineHeight: 1.4,
            }}>
              {slide.body}
            </div>
          )}
        </div>
      )}

      {/* Brand watermark */}
      {!slide.title && !slide.body && (
        <div style={{
          position: 'absolute',
          bottom: width * 0.03,
          right: width * 0.03,
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          fontSize: width * 0.022,
          fontWeight: 600,
          padding: `${width * 0.008}px ${width * 0.015}px`,
          borderRadius: width * 0.008,
        }}>
          {theme.name}
        </div>
      )}
    </div>
  )
}

// ─── Render switch ────────────────────────────────────────────────────────────

export function renderSlide(props: SlideProps) {
  switch (props.slide.template) {
    case 'intro': return <IntroSlide {...props} />
    case 'content': return <ContentSlide {...props} />
    case 'quote': return <QuoteSlide {...props} />
    case 'stat': return <StatSlide {...props} />
    case 'cta': return <CTASlide {...props} />
    case 'image': return <ImageSlide {...props} />
    default: return <ContentSlide {...props} />
  }
}
