import type { HelpSection } from '@/lib/help/types'

interface HelpArticleBodyProps {
  sections: HelpSection[]
}

export function HelpArticleBody({ sections }: HelpArticleBodyProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {sections.map((section, i) => (
        <div key={i}>
          {section.heading && (
            <h2
              style={{
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: '1.2rem',
                fontWeight: 600,
                color: 'oklch(0.85 0.005 240)',
                marginBottom: '0.6rem',
              }}
            >
              {section.heading}
            </h2>
          )}

          {section.body ? (
            <p
              style={{
                fontFamily: "var(--font-sans), 'IBM Plex Sans', sans-serif",
                fontSize: '0.95rem',
                color: 'oklch(0.65 0 0)',
                lineHeight: 1.7,
                marginBottom: section.steps || section.tip || section.warning ? '0.75rem' : 0,
              }}
            >
              {section.body}
            </p>
          ) : null}

          {section.steps && (
            <ol
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {section.steps.map((step, j) => (
                <li
                  key={j}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    fontSize: '0.92rem',
                    color: 'oklch(0.65 0 0)',
                    lineHeight: 1.6,
                  }}
                >
                  <span
                    style={{
                      fontFamily:
                        "var(--font-mono), 'IBM Plex Mono', monospace",
                      fontSize: '0.75rem',
                      color: 'oklch(0.5 0.05 220)',
                      flexShrink: 0,
                      width: '20px',
                      textAlign: 'right',
                      paddingTop: '2px',
                    }}
                  >
                    {j + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          )}

          {section.tip && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '12px 16px',
                background: 'oklch(0.12 0.02 220)',
                border: '1px solid oklch(0.2 0.03 220)',
                borderRadius: '8px',
                fontSize: '0.88rem',
                color: 'oklch(0.7 0.05 220)',
                lineHeight: 1.6,
              }}
            >
              <span
                style={{
                  fontFamily:
                    "var(--font-mono), 'IBM Plex Mono', monospace",
                  fontSize: '0.65rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'oklch(0.6 0.08 220)',
                  marginRight: '8px',
                }}
              >
                tip
              </span>
              {section.tip}
            </div>
          )}

          {section.warning && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '12px 16px',
                background: 'oklch(0.12 0.03 30)',
                border: '1px solid oklch(0.2 0.05 30)',
                borderRadius: '8px',
                fontSize: '0.88rem',
                color: 'oklch(0.7 0.08 30)',
                lineHeight: 1.6,
              }}
            >
              <span
                style={{
                  fontFamily:
                    "var(--font-mono), 'IBM Plex Mono', monospace",
                  fontSize: '0.65rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'oklch(0.6 0.1 30)',
                  marginRight: '8px',
                }}
              >
                warning
              </span>
              {section.warning}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
