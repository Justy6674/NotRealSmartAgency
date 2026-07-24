import type { TelegramBrand } from './nrs-telegram.ts'
import type { TelegramReplyKeyboard } from './telegram-api.ts'

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('en-AU').replace(/[^a-z0-9]/g, '')
}

function isCommand(text: string, command: string): boolean {
  return new RegExp(`^/${command}(?:@\\w+)?\\s*$`, 'i').test(text.trim())
}

export function isTelegramProjectPickerRequest(text: string): boolean {
  return isCommand(text, 'start') || isCommand(text, 'projects') || isCommand(text, 'project')
}

/** A button tap is sent back as plain text. Accept a deliberate /use command too. */
export function getTelegramProjectSelection(text: string, brands: TelegramBrand[]): TelegramBrand | null {
  const candidate = text.trim().replace(/^\/use\s+/i, '')
  const normalizedCandidate = normalize(candidate)
  if (!normalizedCandidate) return null

  return brands.find((brand) =>
    [brand.name, brand.slug].some((reference) => normalize(reference) === normalizedCandidate),
  ) ?? null
}

export function buildTelegramProjectKeyboard(brands: TelegramBrand[]): TelegramReplyKeyboard {
  const keyboard: string[][] = []
  for (let index = 0; index < brands.length; index += 2) {
    keyboard.push(brands.slice(index, index + 2).map((brand) => brand.name))
  }

  return {
    keyboard,
    resize_keyboard: true,
    input_field_placeholder: 'Choose a business',
  }
}

/** Telegram shortcuts describe intent; the Director still does all marketing work. */
export function toTelegramDirectorRequest(text: string, brand: TelegramBrand): string {
  if (isCommand(text, 'social') || isCommand(text, 'topical')) {
    return `Create a topical social media pack for ${brand.name}. Use the brand's approved business context and current public conversation relevant to the business. Draft five platform-native posts with a hook, caption, format and CTA for the Review queue. Do not publish anything.`
  }

  return text
}
