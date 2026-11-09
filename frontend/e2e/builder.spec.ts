import { expect, test } from '@playwright/test'

test.describe('CV Builder Satukit', () => {
  test('responsif, bebas overflow zoom 200%, keyboard, dan dark mode', async ({ page }) => {
    await page.goto('/#/builder')

    const editor = page.getByTestId('builder-editor-panel')
    const preview = page.getByTestId('builder-preview-panel')
    await expect(editor).toBeVisible()

    const emptyState = page.getByTestId('builder-empty-state')
    if (await emptyState.isVisible()) {
      await page.getByTestId('btn-builder-create-new').click()
    }

    await expect(page.getByTestId('tab-contact')).toHaveAttribute('aria-current', 'step')
    await expect(preview).toBeVisible()
    await expect(page.getByTestId('resume-preview-sheet')).toBeVisible()

    for (const width of [1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      const toolbar = page.getByTestId('builder-context-toolbar')
      await expect(toolbar).toBeVisible()
      const toolbarBox = await toolbar.boundingBox()
      expect(toolbarBox).not.toBeNull()
      expect(toolbarBox!.x + toolbarBox!.width).toBeLessThanOrEqual(width + 1)

      const toolbarItems = [
        page.getByTestId('builder-title-status'),
        page.getByTestId('builder-design-controls'),
        page.getByTestId('badge-ats-score'),
        page.getByTestId('btn-open-import'),
        page.getByTestId('btn-export-menu')
      ]
      const boxes = await Promise.all(toolbarItems.map(item => item.boundingBox()))
      for (let index = 1; index < boxes.length; index += 1) {
        expect(boxes[index - 1]).not.toBeNull()
        expect(boxes[index]).not.toBeNull()
        expect(boxes[index - 1]!.x + boxes[index - 1]!.width).toBeLessThanOrEqual(boxes[index]!.x + 1)
      }
    }

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByTestId('tab-summary').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('textarea-summary')).toBeVisible()

    await page.evaluate(() => {
      document.documentElement.style.zoom = '2'
    })
    const hasZoomOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    )
    expect(hasZoomOverflow).toBe(false)
    await page.evaluate(() => {
      document.documentElement.style.zoom = '1'
    })

    const themeToggle = page.getByTestId('theme-toggle-btn')
    const initialDarkMode = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    await themeToggle.click()
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(!initialDarkMode)

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(editor).toBeVisible()
    await expect(preview).toBeHidden()
    await page.getByRole('button', { name: 'Pratinjau A4' }).click()
    await expect(editor).toBeHidden()
    await expect(preview).toBeVisible()

    const mobileOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    )
    expect(mobileOverflow).toBe(false)
    expect(await page.locator('body').innerHTML()).not.toMatch(/indigo-|violet-|purple-/)
  })

  test('membuka dan menutup mega menu CV Builder dengan navigasi', async ({ page }) => {
    await page.goto('/#/home')
    await page.setViewportSize({ width: 1440, height: 900 })

    const cvMenuBtn = page.getByTestId('btn-nav-cv-builder')
    await expect(cvMenuBtn).toBeVisible()
    await expect(page.getByTestId('cv-mega-menu')).toBeHidden()

    await cvMenuBtn.click()
    const megaMenu = page.getByTestId('cv-mega-menu')
    await expect(megaMenu).toBeVisible()
    await expect(page.getByTestId('mega-menu-create-new')).toBeVisible()

    await page.getByTestId('mega-menu-create-new').click()
    await expect(megaMenu).toBeHidden()
    await expect(page).toHaveURL(/#\/builder$/)
    await expect(page.getByTestId('builder-editor-panel')).toBeVisible()
  })
})
