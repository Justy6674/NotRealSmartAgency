import { chromium } from 'playwright'

const EMAIL = 'downscale@icloud.com'
const PASSWORD = 'IloveBB0307$$'
const BASE = 'http://localhost:3000'
const CONV_ID = 'bd103f3b-b8ba-4fa0-bf35-59161a39538b'

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  page.on('console', msg => {
    if (msg.text().includes('[chat]')) console.log(`  BROWSER: ${msg.text()}`)
  })

  // 1. Log in
  console.log('[1] Logging in...')
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/agency/**', { timeout: 15000 })
  await page.waitForTimeout(2000)
  console.log('[1] Done')

  // 2. Test A: Direct URL navigation
  console.log('\n=== TEST A: Direct navigation ===')
  await page.goto(`${BASE}/agency/chat/${CONV_ID}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(4000)

  let mainText = await page.locator('main').textContent()
  let hasWelcome = mainText?.includes('I oversee all departments')
  let hasMsg = mainText?.includes('Say hi') || mainText?.includes('G day')
  console.log(`Welcome: ${hasWelcome}, Messages: ${hasMsg}`)
  console.log(`Text: "${mainText?.slice(0, 150)}"`)
  await page.screenshot({ path: '/tmp/nrs-A-direct.png' })

  // 3. Test B: Click from sidebar
  console.log('\n=== TEST B: Sidebar click ===')
  await page.goto(`${BASE}/agency/chat`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  const recentButtons = await page.locator('section:has(p:text("Recent Chats")) button').all()
  console.log(`Recent chats: ${recentButtons.length}`)

  // Find the "Say hi" conversation button
  let targetBtn = null
  for (const btn of recentButtons) {
    const t = await btn.textContent()
    if (t?.includes('Say hi')) {
      targetBtn = btn
      break
    }
  }

  if (!targetBtn) {
    console.log('Could not find "Say hi" conversation, using first button')
    targetBtn = recentButtons[0]
  }

  const btnText = await targetBtn.textContent()
  console.log(`Clicking: "${btnText?.trim().slice(0, 50)}"`)
  await targetBtn.click()
  await page.waitForTimeout(5000)

  const url = page.url()
  console.log(`URL: ${url}`)

  mainText = await page.locator('main').textContent()
  hasWelcome = mainText?.includes('I oversee all departments')
  hasMsg = mainText?.includes('Say hi') || mainText?.includes('G day')
  console.log(`Welcome: ${hasWelcome}, Messages: ${hasMsg}`)
  console.log(`Text: "${mainText?.slice(0, 150)}"`)
  await page.screenshot({ path: '/tmp/nrs-B-click.png' })

  // Verdict
  console.log('\n=== VERDICT ===')
  if (hasMsg && !hasWelcome) {
    console.log('✅ FIXED — messages load correctly')
  } else if (hasWelcome) {
    console.log('❌ STILL BROKEN — welcome screen showing instead of messages')
  }

  await browser.close()
})()
