import { chromium } from '@playwright/test'
import { preview } from 'vite'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(__dirname, '..', 'frontend')
const artifactDir = process.env.ARTIFACT_DIR || path.resolve(__dirname, '..', 'screenshots')

async function run() {
  console.log('Starting Vite preview server...')
  const server = await preview({
    root: frontendDir,
    preview: { port: 4173 }
  })
  const url = 'http://localhost:4173'
  console.log(`Preview server running at ${url}`)

  const browser = await chromium.launch({ headless: true })
  fs.mkdirSync(artifactDir, { recursive: true })

  try {
    // 1. Desktop Light Mode
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    const lightPath = path.join(artifactDir, 'screenshot_landing_light.png')
    await page.screenshot({ path: lightPath, fullPage: false })
    console.log(`Saved: ${lightPath}`)

    // 2. Feature Cards Close-up (Light Mode)
    const cardsSection = page.locator('section[aria-labelledby="features-heading"]')
    if (await cardsSection.count() > 0) {
      await cardsSection.scrollIntoViewIfNeeded()
      await page.waitForTimeout(600)
      const cardsPath = path.join(artifactDir, 'screenshot_feature_cards.png')
      await cardsSection.screenshot({ path: cardsPath })
      console.log(`Saved: ${cardsPath}`)
    }

    // 3. Desktop Dark Mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark')
      localStorage.setItem('satukit_theme', 'dark')
    })
    await page.waitForTimeout(600)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(400)

    const darkPath = path.join(artifactDir, 'screenshot_landing_dark.png')
    await page.screenshot({ path: darkPath, fullPage: false })
    console.log(`Saved: ${darkPath}`)

    // 4. Mobile View (Light)
    await page.close()
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await mobilePage.goto(url, { waitUntil: 'networkidle' })
    await mobilePage.waitForTimeout(1000)

    const mobilePath = path.join(artifactDir, 'screenshot_landing_mobile.png')
    await mobilePage.screenshot({ path: mobilePath, fullPage: false })
    console.log(`Saved: ${mobilePath}`)
    await mobilePage.close()

  } finally {
    await browser.close()
    server.httpServer.close()
    console.log('Server stopped.')
  }
}

run().catch(err => {
  console.error('Capture error:', err)
  process.exit(1)
})
