import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifyProductTool } from './verify-product.ts'

/**
 * A walkthrough video names a dozen products. Checking them one call each
 * exhausted the Director's step budget before a single caption was written —
 * "the Director burned its step limit trying to verify everything" — so the
 * copy came out unverified, which is the exact failure the check exists to
 * prevent. One call has to cover the lot.
 */

type ToolShape = {
  inputSchema: { safeParse: (value: unknown) => { success: boolean } }
  execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
}

const tool = createVerifyProductTool() as unknown as ToolShape

test('accepts every name in one call', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ product_name: `Product ${i}` }))
  assert.equal(tool.inputSchema.safeParse({ products: many }).success, true)
})

test('still accepts the single-name form, so existing callers keep working', () => {
  assert.equal(tool.inputSchema.safeParse({ product_name: 'Ormonde Jayne Ta\'if' }).success, true)
})

test('refuses a batch beyond what one call should carry', () => {
  const tooMany = Array.from({ length: 13 }, (_, i) => ({ product_name: `Product ${i}` }))
  assert.equal(tool.inputSchema.safeParse({ products: tooMany }).success, false)
})

test('an empty call is refused rather than passed as safe', async () => {
  const result = await tool.execute({})
  assert.equal(result.safe_to_publish, false)
})
