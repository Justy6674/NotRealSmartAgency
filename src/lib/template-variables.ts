/**
 * Built-in template variables for post templates.
 * Variables use {key} syntax in caption templates.
 */

export interface TemplateVariable {
  key: string
  label: string
  description: string
  defaultValue: string | (() => string)
}

export const BUILT_IN_VARIABLES: TemplateVariable[] = [
  { key: 'brand', label: 'Brand name', description: 'The active brand name', defaultValue: '' },
  { key: 'date', label: 'Date', description: 'Today\'s date (e.g. 8 April 2026)', defaultValue: () => new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) },
  { key: 'month', label: 'Month', description: 'Current month (e.g. April)', defaultValue: () => new Date().toLocaleDateString('en-AU', { month: 'long' }) },
  { key: 'year', label: 'Year', description: 'Current year', defaultValue: () => String(new Date().getFullYear()) },
  { key: 'day_of_week', label: 'Day of week', description: 'Today\'s day (e.g. Tuesday)', defaultValue: () => new Date().toLocaleDateString('en-AU', { weekday: 'long' }) },
  { key: 'product', label: 'Product', description: 'Product or service name', defaultValue: '' },
  { key: 'offer', label: 'Offer', description: 'Current promotion or offer', defaultValue: '' },
  { key: 'link', label: 'Link', description: 'URL to include', defaultValue: '' },
]

/**
 * Resolve a template string by replacing {key} placeholders with values.
 */
export function resolveTemplate(
  template: string,
  variables: Record<string, string>,
  brandName?: string
): string {
  let result = template

  // Add brand name
  if (brandName) {
    variables.brand = brandName
  }

  // Add built-in date variables
  for (const v of BUILT_IN_VARIABLES) {
    if (!(v.key in variables)) {
      const defaultVal = typeof v.defaultValue === 'function' ? v.defaultValue() : v.defaultValue
      if (defaultVal) variables[v.key] = defaultVal
    }
  }

  // Replace all {key} placeholders
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }

  return result
}

/**
 * Extract variable keys from a template string.
 */
export function extractVariables(template: string): string[] {
  const matches = template.match(/\{(\w+)\}/g)
  if (!matches) return []
  return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))]
}
