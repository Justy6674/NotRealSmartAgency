'use client'

import { useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FaqItem {
  question: string
  answer: string
}

interface FaqCategory {
  id: string
  label: string
  items: FaqItem[]
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const FAQ_DATA: FaqCategory[] = [
  {
    id: 'getting-started',
    label: 'getting-started',
    items: [
      {
        question: 'What is NotRealSmart Agency?',
        answer:
          'An AI-powered marketing agency with 10 specialist departments. You brief an agent, it produces finished marketing output — social posts, ad copy, SEO strategies, email sequences, and more. Built specifically for Australian health businesses.',
      },
      {
        question: 'How is this different from ChatGPT?',
        answer:
          'Three things. First, brand memory — every agent knows your brand voice, audience, and past outputs. Second, compliance — every output is checked against AHPRA and TGA advertising guidelines. Third, departments — you brief a specialist, not a generalist.',
      },
      {
        question: 'Do I need marketing experience?',
        answer:
          'No. Each agent asks the right questions and guides you through the brief. You describe what you want in plain English, and the agent handles the rest.',
      },
    ],
  },
  {
    id: 'compliance',
    label: 'compliance',
    items: [
      {
        question: 'How does AHPRA compliance work?',
        answer:
          'Every output passes through our compliance agent which checks for prohibited claims, testimonial usage, and TGA advertising restrictions. It flags issues and suggests compliant alternatives. This is guidance — not a legal determination.',
      },
      {
        question: 'Can I use this for regulated health advertising?',
        answer:
          "Yes, that's exactly what it's built for. The compliance layer understands AHPRA's advertising guidelines, including the September 2025 update that makes AI-generated content carry the same legal accountability as manually written content.",
      },
      {
        question: 'What health professions are supported?',
        answer:
          'GP, nurse practitioner, allied health, dental, chiropractic, optometry, telehealth, cannabis clinics, aesthetics, mental health, weight management, and aged care.',
      },
    ],
  },
  {
    id: 'billing',
    label: 'billing',
    items: [
      {
        question: 'How much does it cost?',
        answer:
          "Pricing is coming soon. We're finalising plans that work for solo practitioners through to multi-location practices.",
      },
      {
        question: 'Is there a free trial?',
        answer:
          "Yes. We'll offer a trial period so you can test the agents with your actual brand before committing.",
      },
      {
        question: 'Can I manage multiple brands?',
        answer:
          'Absolutely. The dashboard supports multiple brand profiles. Switch between them and each agent automatically loads the right context.',
      },
    ],
  },
  {
    id: 'technical',
    label: 'technical',
    items: [
      {
        question: 'Is my data secure?',
        answer:
          'Yes. We use Supabase with row-level security, hosted in Sydney (ap-southeast-2). No patient data is stored — only your brand profiles, briefs, and marketing outputs.',
      },
      {
        question: 'Can I export my outputs?',
        answer:
          'Every output is saved to your library. You can copy, download, or iterate on any previous output at any time.',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(question: string): string {
  return question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MacOsTrafficLights() {
  return (
    <div className="nrs-traffic-lights">
      <span className="nrs-dot nrs-dot--red" aria-hidden="true" />
      <span className="nrs-dot nrs-dot--yellow" aria-hidden="true" />
      <span className="nrs-dot nrs-dot--green" aria-hidden="true" />
    </div>
  )
}

function TerminalTitleBar({ path }: { path: string }) {
  return (
    <div className="nrs-titlebar">
      <MacOsTrafficLights />
      <span className="nrs-titlebar__title">{path}</span>
      {/* spacer to keep title centred */}
      <span className="nrs-titlebar__spacer" aria-hidden="true" />
    </div>
  )
}

function CategoryTab({
  category,
  isActive,
  onClick,
}: {
  category: FaqCategory
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`nrs-tab${isActive ? ' nrs-tab--active' : ''}`}
      aria-pressed={isActive}
    >
      <span className="nrs-tab__prompt" aria-hidden="true">
        {isActive ? '>' : ' '}
      </span>
      <span className="nrs-tab__label">{category.label}/</span>
    </button>
  )
}

function FaqRow({
  item,
  index,
  categoryId,
  isOpen,
  onToggle,
}: {
  item: FaqItem
  index: number
  categoryId: string
  isOpen: boolean
  onToggle: () => void
}) {
  const commandId = `${categoryId}-${index}`

  return (
    <div className={`nrs-faq-row${isOpen ? ' nrs-faq-row--open' : ''}`}>
      {/* Command line / question */}
      <button
        className="nrs-faq-command"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`answer-${commandId}`}
        id={`question-${commandId}`}
      >
        <span className="nrs-faq-command__prompt" aria-hidden="true">$</span>
        <span className="nrs-faq-command__text">
          ask --category={categoryId} &quot;{item.question}&quot;
        </span>
        <span className="nrs-faq-command__chevron" aria-hidden="true">
          {isOpen ? '▾' : '▸'}
        </span>
      </button>

      {/* Answer output */}
      {isOpen && (
        <div
          className="nrs-faq-answer"
          id={`answer-${commandId}`}
          role="region"
          aria-labelledby={`question-${commandId}`}
        >
          <div className="nrs-faq-answer__prefix" aria-hidden="true">
            <span className="nrs-faq-answer__arrow">⎿</span>
            <span className="nrs-faq-answer__label">output</span>
          </div>
          <p className="nrs-faq-answer__text nrs-typeout">{item.answer}</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TerminalFaq() {
  const [activeCategory, setActiveCategory] = useState<string>('getting-started')
  const [openQuestion, setOpenQuestion] = useState<string | null>(null)

  const currentCategory = FAQ_DATA.find((c) => c.id === activeCategory) ?? FAQ_DATA[0]

  function handleCategoryChange(id: string) {
    setActiveCategory(id)
    setOpenQuestion(null)
  }

  function handleToggle(key: string) {
    setOpenQuestion((prev) => (prev === key ? null : key))
  }

  const breadcrumb = `~/nrs/faq/${activeCategory}`

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Scoped styles                                                        */}
      {/* ------------------------------------------------------------------ */}
      <style>{`
        /* --- Token palette ------------------------------------------------ */
        :root {
          --nrs-bg:           oklch(0.08 0.005 240);
          --nrs-border:       oklch(0.2 0.01 240);
          --nrs-prompt:       oklch(0.75 0.15 75);
          --nrs-output:       oklch(0.7 0 0);
          --nrs-heading:      oklch(0.6 0.01 240);
          --nrs-active:       oklch(0.85 0.005 240);
          --nrs-muted:        oklch(0.4 0 0);
          --nrs-page-bg:      oklch(0.06 0 0);
          --nrs-glow-cyan:    oklch(0.7 0.12 220);
          --nrs-glow-amber:   oklch(0.75 0.15 75);
        }

        /* --- Page wrapper ------------------------------------------------- */
        .nrs-faq-page {
          min-height: 100dvh;
          background: var(--nrs-page-bg);
          padding-top: 5rem;         /* clear fixed nav ~80px */
          padding-bottom: 4rem;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* --- Section header ----------------------------------------------- */
        .nrs-faq-section-header {
          width: 100%;
          max-width: 900px;
          padding: 0 1rem 2rem;
          text-align: center;
        }

        .nrs-faq-section-header__eyebrow {
          font-family: var(--font-mono), 'IBM Plex Mono', monospace;
          font-size: 0.7rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--nrs-prompt);
          margin-bottom: 0.75rem;
        }

        .nrs-faq-section-header__title {
          font-family: var(--font-mono), 'IBM Plex Mono', monospace;
          font-size: clamp(1.4rem, 4vw, 2rem);
          font-weight: 600;
          color: var(--nrs-active);
          text-shadow: 0 0 18px oklch(0.6 0.01 240 / 0.35);
          margin-bottom: 0.5rem;
        }

        .nrs-faq-section-header__sub {
          font-family: var(--font-mono), 'IBM Plex Mono', monospace;
          font-size: 0.8rem;
          color: var(--nrs-muted);
        }

        /* --- Terminal shell ----------------------------------------------- */
        .nrs-terminal {
          position: relative;
          width: 100%;
          max-width: 900px;
          margin: 0 1rem;
          background: var(--nrs-bg);
          border: 1px solid var(--nrs-border);
          border-radius: 10px;
          overflow: hidden;
          box-shadow:
            0 0 0 1px oklch(0.08 0.005 240),
            0 24px 60px oklch(0 0 0 / 0.7),
            0 0 40px oklch(0.6 0.01 240 / 0.06);
        }

        /* Scanline overlay */
        .nrs-terminal::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: repeating-linear-gradient(
            0deg,
            oklch(0 0 0 / 0.04) 0px,
            oklch(0 0 0 / 0.04) 1px,
            transparent 1px,
            transparent 3px
          );
          z-index: 10;
          border-radius: 10px;
        }

        /* --- Title bar ---------------------------------------------------- */
        .nrs-titlebar {
          display: flex;
          align-items: center;
          gap: 0;
          padding: 0 1rem;
          height: 2.75rem;
          background: oklch(0.12 0.005 240);
          border-bottom: 1px solid var(--nrs-border);
          user-select: none;
        }

        .nrs-traffic-lights {
          display: flex;
          gap: 6px;
          align-items: center;
          flex-shrink: 0;
        }

        .nrs-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: block;
        }

        .nrs-dot--red    { background: oklch(0.62 0.22 27); }
        .nrs-dot--yellow { background: oklch(0.78 0.17 85); }
        .nrs-dot--green  { background: oklch(0.68 0.2 145); }

        .nrs-titlebar__title {
          flex: 1;
          text-align: center;
          font-family: var(--font-mono), 'IBM Plex Mono', monospace;
          font-size: 0.72rem;
          color: var(--nrs-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .nrs-titlebar__spacer {
          flex-shrink: 0;
          width: 54px; /* mirrors traffic lights width so title stays centred */
        }

        /* --- Terminal body ------------------------------------------------ */
        .nrs-terminal__body {
          display: flex;
          flex-direction: column;
        }

        /* --- Breadcrumb bar ----------------------------------------------- */
        .nrs-breadcrumb {
          padding: 0.55rem 1.25rem;
          border-bottom: 1px solid oklch(0.15 0.005 240);
          font-family: var(--font-mono), 'IBM Plex Mono', monospace;
          font-size: 0.72rem;
          color: var(--nrs-heading);
          text-shadow: 0 0 8px oklch(0.6 0.01 240 / 0.4);
          letter-spacing: 0.02em;
        }

        .nrs-breadcrumb__prompt {
          color: var(--nrs-prompt);
          margin-right: 0.5rem;
        }

        /* --- Category tabs ------------------------------------------------ */
        .nrs-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0;
          padding: 0.75rem 1.25rem;
          border-bottom: 1px solid oklch(0.15 0.005 240);
          background: oklch(0.1 0.004 240);
        }

        .nrs-tab {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.3rem 0.75rem 0.3rem 0.4rem;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 4px;
          cursor: pointer;
          font-family: var(--font-mono), 'IBM Plex Mono', monospace;
          font-size: 0.75rem;
          color: var(--nrs-muted);
          transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
          white-space: nowrap;
        }

        .nrs-tab:hover {
          color: var(--nrs-output);
          border-color: oklch(0.25 0.01 240);
          background: oklch(0.11 0.005 240);
        }

        .nrs-tab--active {
          color: var(--nrs-prompt);
          border-color: oklch(0.28 0.012 240);
          background: oklch(0.12 0.005 240);
          text-shadow: 0 0 10px oklch(0.75 0.15 75 / 0.35);
        }

        .nrs-tab__prompt {
          color: var(--nrs-prompt);
          font-weight: 600;
          width: 0.65rem;
          display: inline-block;
        }

        .nrs-tab__label {
          letter-spacing: 0.01em;
        }

        /* --- FAQ list ----------------------------------------------------- */
        .nrs-faq-list {
          padding: 0.5rem 0 1rem;
        }

        /* --- FAQ row ------------------------------------------------------ */
        .nrs-faq-row {
          border-bottom: 1px solid oklch(0.13 0.004 240);
          transition: background 0.12s ease;
        }

        .nrs-faq-row:last-child {
          border-bottom: none;
        }

        .nrs-faq-row--open {
          background: oklch(0.095 0.006 240);
        }

        /* --- Command line ------------------------------------------------- */
        .nrs-faq-command {
          width: 100%;
          display: flex;
          align-items: baseline;
          gap: 0.55rem;
          padding: 0.85rem 1.25rem;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: background 0.12s ease;
        }

        .nrs-faq-command:hover {
          background: oklch(0.1 0.005 240);
        }

        .nrs-faq-command__prompt {
          font-family: var(--font-mono), 'IBM Plex Mono', monospace;
          font-size: 0.8rem;
          color: var(--nrs-prompt);
          text-shadow: 0 0 8px oklch(0.75 0.15 75 / 0.5);
          flex-shrink: 0;
          line-height: 1;
          padding-top: 0.1rem;
        }

        .nrs-faq-command__text {
          font-family: var(--font-mono), 'IBM Plex Mono', monospace;
          font-size: 0.82rem;
          color: var(--nrs-active);
          line-height: 1.5;
          flex: 1;
          word-break: break-word;
        }

        .nrs-faq-command__chevron {
          font-family: var(--font-mono), 'IBM Plex Mono', monospace;
          font-size: 0.7rem;
          color: var(--nrs-muted);
          flex-shrink: 0;
          transition: color 0.15s ease;
        }

        .nrs-faq-row--open .nrs-faq-command__chevron {
          color: var(--nrs-prompt);
        }

        /* --- Answer ------------------------------------------------------- */
        .nrs-faq-answer {
          padding: 0 1.25rem 1rem 2.85rem;
        }

        .nrs-faq-answer__prefix {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          margin-bottom: 0.4rem;
        }

        .nrs-faq-answer__arrow {
          font-family: var(--font-mono), 'IBM Plex Mono', monospace;
          font-size: 0.75rem;
          color: var(--nrs-heading);
          text-shadow: 0 0 8px oklch(0.6 0.01 240 / 0.5);
        }

        .nrs-faq-answer__label {
          font-family: var(--font-mono), 'IBM Plex Mono', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: oklch(0.35 0.01 240);
        }

        .nrs-faq-answer__text {
          font-family: var(--font-mono), 'IBM Plex Mono', monospace;
          font-size: 0.8rem;
          line-height: 1.7;
          color: var(--nrs-output);
        }

        /* --- Typeout animation -------------------------------------------- */
        @keyframes nrs-typeout {
          from { clip-path: inset(0 100% 0 0); }
          to   { clip-path: inset(0 0% 0 0); }
        }

        .nrs-typeout {
          animation: nrs-typeout 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }

        /* --- Blinking cursor in heading ----------------------------------- */
        @keyframes nrs-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }

        .nrs-cursor {
          display: inline-block;
          width: 0.55em;
          height: 1em;
          background: var(--nrs-prompt);
          vertical-align: text-bottom;
          margin-left: 0.15em;
          animation: nrs-blink 1.1s step-end infinite;
        }

        /* --- Terminal footer ---------------------------------------------- */
        .nrs-terminal__footer {
          padding: 0.6rem 1.25rem;
          border-top: 1px solid oklch(0.13 0.004 240);
          background: oklch(0.09 0.004 240);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-family: var(--font-mono), 'IBM Plex Mono', monospace;
          font-size: 0.65rem;
          color: oklch(0.28 0.008 240);
        }

        .nrs-terminal__footer-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: oklch(0.68 0.2 145);
          box-shadow: 0 0 5px oklch(0.68 0.2 145 / 0.6);
          flex-shrink: 0;
        }

        /* --- Responsive --------------------------------------------------- */
        @media (max-width: 640px) {
          .nrs-faq-page {
            padding-top: 4.5rem;
          }

          .nrs-terminal {
            margin: 0;
            border-left: none;
            border-right: none;
            border-radius: 0;
          }

          .nrs-faq-command__text {
            font-size: 0.75rem;
          }

          .nrs-faq-answer__text {
            font-size: 0.75rem;
          }

          .nrs-tabs {
            gap: 0.25rem 0;
          }
        }
      `}</style>

      {/* ------------------------------------------------------------------ */}
      {/* Markup                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="nrs-faq-page">

        {/* Section header */}
        <header className="nrs-faq-section-header">
          <p className="nrs-faq-section-header__eyebrow">// help &amp; documentation</p>
          <h1 className="nrs-faq-section-header__title">
            Frequently Asked Questions
            <span className="nrs-cursor" aria-hidden="true" />
          </h1>
          <p className="nrs-faq-section-header__sub">
            Select a category, then run a command to reveal the answer.
          </p>
        </header>

        {/* Terminal window */}
        <div className="nrs-terminal" role="region" aria-label="FAQ terminal">

          {/* Title bar */}
          <TerminalTitleBar path={breadcrumb} />

          <div className="nrs-terminal__body">

            {/* Breadcrumb */}
            <div className="nrs-breadcrumb" aria-hidden="true">
              <span className="nrs-breadcrumb__prompt">$</span>
              ls {breadcrumb}
            </div>

            {/* Category tabs */}
            <nav className="nrs-tabs" aria-label="FAQ categories">
              {FAQ_DATA.map((cat) => (
                <CategoryTab
                  key={cat.id}
                  category={cat}
                  isActive={cat.id === activeCategory}
                  onClick={() => handleCategoryChange(cat.id)}
                />
              ))}
            </nav>

            {/* FAQ rows */}
            <div className="nrs-faq-list" role="list" aria-label={`${activeCategory} questions`}>
              {currentCategory.items.map((item, i) => {
                const key = slugify(item.question)
                return (
                  <div key={key} role="listitem">
                    <FaqRow
                      item={item}
                      index={i}
                      categoryId={activeCategory}
                      isOpen={openQuestion === key}
                      onToggle={() => handleToggle(key)}
                    />
                  </div>
                )
              })}
            </div>

          </div>

          {/* Terminal footer status bar */}
          <div className="nrs-terminal__footer" aria-hidden="true">
            <span className="nrs-terminal__footer-dot" />
            <span>nrs-faq v1.0.0</span>
            <span style={{ marginLeft: 'auto' }}>
              {currentCategory.items.length} entries &nbsp;|&nbsp; {activeCategory}
            </span>
          </div>

        </div>
      </section>
    </>
  )
}
