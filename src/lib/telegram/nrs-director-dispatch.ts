import { resolveTelegramBrand, type TelegramBrand } from './nrs-telegram.ts'

export type TelegramDirectorDispatch =
  | { kind: 'queued'; jobId: string; brand: TelegramBrand }
  | { kind: 'needs_brand'; text: string }

/**
 * Telegram never decides marketing strategy itself. It identifies a single
 * brand and gives the user's wording unchanged to the existing NRS Director.
 */
export async function dispatchTelegramDirectorRequest({
  text,
  brands,
  queueDirectorJob,
}: {
  text: string
  brands: TelegramBrand[]
  queueDirectorJob: (input: { brandId: string; message: string }) => Promise<{ jobId: string }>
}): Promise<TelegramDirectorDispatch> {
  const resolution = resolveTelegramBrand(text, brands)
  if (resolution.kind !== 'matched') {
    return {
      kind: 'needs_brand',
      text: `Which brand should I work on? Name one: ${brands.map((brand) => brand.name).join(', ')}.`,
    }
  }

  const { jobId } = await queueDirectorJob({
    brandId: resolution.brand.id,
    message: text,
  })

  return { kind: 'queued', jobId, brand: resolution.brand }
}
