import type { TelegramBrand } from './nrs-telegram.ts'
import type { TelegramReplyKeyboard } from './telegram-api.ts'

const PROJECTS_PER_PAGE = 6
const NEXT_PROJECTS_BUTTON = 'More projects →'
const PREVIOUS_PROJECTS_BUTTON = '← Earlier projects'

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('en-AU').replace(/[^a-z0-9]/g, '')
}

function isCommand(text: string, command: string): boolean {
  return new RegExp(`^/${command}(?:@\\w+)?\\s*$`, 'i').test(text.trim())
}

export function isTelegramProjectPickerRequest(text: string): boolean {
  return isCommand(text, 'start') || isCommand(text, 'projects') || isCommand(text, 'project')
}

export function isTelegramStartRequest(text: string): boolean {
  return isCommand(text, 'start')
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

export function getTelegramProjectPageAction(
  text: string,
  currentPage: number,
  brands: TelegramBrand[],
): number | null {
  const pageCount = Math.ceil(brands.length / PROJECTS_PER_PAGE)
  if (pageCount <= 1) return null

  if (text.trim() === NEXT_PROJECTS_BUTTON && currentPage < pageCount - 1) return currentPage + 1
  if (text.trim() === PREVIOUS_PROJECTS_BUTTON && currentPage > 0) return currentPage - 1
  return null
}

export function buildTelegramProjectKeyboard(brands: TelegramBrand[], requestedPage = 0): TelegramReplyKeyboard {
  const pageCount = Math.max(1, Math.ceil(brands.length / PROJECTS_PER_PAGE))
  const page = Math.max(0, Math.min(requestedPage, pageCount - 1))
  const pageBrands = brands.slice(page * PROJECTS_PER_PAGE, (page + 1) * PROJECTS_PER_PAGE)
  const keyboard: string[][] = []
  for (let index = 0; index < pageBrands.length; index += 2) {
    keyboard.push(pageBrands.slice(index, index + 2).map((brand) => brand.name))
  }

  if (pageCount > 1) {
    const navigation: string[] = []
    if (page > 0) navigation.push(PREVIOUS_PROJECTS_BUTTON)
    if (page < pageCount - 1) navigation.push(NEXT_PROJECTS_BUTTON)
    keyboard.push(navigation)
  }

  return {
    keyboard,
    resize_keyboard: true,
    input_field_placeholder: pageCount > 1 ? `Choose a business (${page + 1}/${pageCount})` : 'Choose a business',
  }
}

/** Telegram shortcuts describe intent; the Director still does all marketing work. */
export function toTelegramDirectorRequest(text: string, brand: TelegramBrand): string {
  if (isCommand(text, 'social') || isCommand(text, 'topical')) {
    return `Create a topical social media pack for ${brand.name}. Use the brand's approved business context and current public conversation relevant to the business. Draft five platform-native posts with a hook, caption, format and CTA for the Review queue. Do not publish anything.`
  }

  return text
}
