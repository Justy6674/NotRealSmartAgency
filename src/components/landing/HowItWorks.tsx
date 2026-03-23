const STEPS = [
  {
    num: '01',
    title: 'Pick Your Brand',
    desc: 'Select from your portfolio or create a new brand profile with tone, audience, and compliance flags.',
  },
  {
    num: '02',
    title: 'Brief an Agent',
    desc: 'Choose a department, describe what you need. The agent knows your brand context already.',
  },
  {
    num: '03',
    title: 'Get Finished Output',
    desc: 'Review, copy, publish. Compliance-checked for health brands. Save to your output library.',
  },
]

export function HowItWorks() {
  return (
    <section className="px-6 py-24" style={{ background: 'oklch(0.06 0 0)' }}>
      <div className="mx-auto max-w-4xl">
        <h2
          className="text-center text-3xl font-bold tracking-tight md:text-4xl"
          style={{ color: 'oklch(0.92 0 0)' }}
        >
          How It Works
        </h2>

        <div className="mt-16 grid gap-12 md:grid-cols-3">
          {STEPS.map(({ num, title, desc }) => (
            <div key={num} className="text-center">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 font-mono text-xl font-bold"
                style={{
                  borderColor: 'oklch(0.55 0.12 55)',
                  color: 'oklch(0.75 0.15 75)',
                }}
              >
                {num}
              </div>
              <h3
                className="mt-5 text-lg font-semibold"
                style={{ color: 'oklch(0.88 0 0)' }}
              >
                {title}
              </h3>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: 'oklch(0.5 0 0)' }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
