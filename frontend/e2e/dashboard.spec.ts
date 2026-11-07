import { expect, test } from '@playwright/test'

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'laptop-1024', width: 1024, height: 768 },
  { name: 'tablet-landscape-820', width: 820, height: 1180 },
  { name: 'tablet-portrait-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 }
]

test.describe('Dashboard / Beranda Batched Multi-Viewport & Quality Gate Verification', () => {
  test('verifikasi multi-viewport (1440, 1024, 820, 768, 390), zoom 200%, tipografi, CLS <= 0.1, dan navigasi keyboard', async ({
    page
  }) => {
    // Pasang observer CLS sebelum halaman dimuat
    await page.addInitScript(() => {
      ;(window as any).__clsScore = 0
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver(list => {
            for (const entry of list.getEntries() as any[]) {
              if (!entry.hadRecentInput) {
                ;(window as any).__clsScore += entry.value
              }
            }
          })
          observer.observe({ type: 'layout-shift', buffered: true })
        } catch {
          // ignore if unsupported
        }
      }
    })

    await page.goto('/#/home')
    const dashboard = page.getByTestId('dashboard-view')
    await expect(dashboard).toBeVisible()

    // Verifikasi jumlah alat dokumen terhubung dinamis (18)
    await expect(page.getByTestId('stat-tools-count')).toHaveText('18')

    // Verifikasi arah warna Editorial Paper & Forest Teal (bebas kelas ungu indigo/violet/purple pada Beranda & Navbar)
    const hasPurpleClasses = await page.evaluate(() => {
      const appShell = document.querySelector('.app-shell')
      return appShell ? /indigo-|violet-|purple-/.test(appShell.innerHTML) : false
    })
    expect(hasPurpleClasses).toBe(false)

    // Verifikasi tekstur kertas (.paper-canvas) pada latar belakang di belakang kartu, dan kartu tetap putih bersih
    const paperTextureMetrics = await page.evaluate(() => {
      const dash = document.querySelector('[data-testid="dashboard-view"]') as HTMLElement | null
      const card = document.querySelector('[data-testid="card-workspace-builder"]') as HTMLElement | null
      const dashStyle = dash ? window.getComputedStyle(dash) : null
      const cardStyle = card ? window.getComputedStyle(card) : null
      return {
        hasPaperClass: dash ? dash.classList.contains('paper-canvas') : false,
        dashBgImage: dashStyle ? dashStyle.backgroundImage : 'none',
        cardBgImage: cardStyle ? cardStyle.backgroundImage : 'none',
        cardHasPaperClass: card ? card.classList.contains('paper-canvas') : true
      }
    })
    expect(paperTextureMetrics.hasPaperClass).toBe(true)
    expect(paperTextureMetrics.dashBgImage).toContain('linear-gradient')
    expect(paperTextureMetrics.dashBgImage).toContain('radial-gradient')
    expect(paperTextureMetrics.dashBgImage).toContain('data:image/svg+xml')
    expect(paperTextureMetrics.cardBgImage).toBe('none')
    expect(paperTextureMetrics.cardHasPaperClass).toBe(false)

    // Verifikasi tidak ada tombol mati (disabled) pada kondisi awal
    const disabledButtons = await dashboard.locator('button:disabled').count()
    expect(disabledButtons).toBe(0)

    // Verifikasi ukuran font terhitung (computed font-size):
    // Paragraf utama >= 16px, label/metadata >= 13px
    const fontMetrics = await dashboard.evaluate(root => {
      const heroParagraph = root.querySelector('section p')
      const heroFontSize = heroParagraph
        ? parseFloat(window.getComputedStyle(heroParagraph).fontSize)
        : 0

      const allTextElements = Array.from(
        root.querySelectorAll('h1, h2, h3, p, span, button, strong')
      )
      let minFontSize = Infinity
      for (const el of allTextElements) {
        const text = (el.textContent || '').trim()
        if (!text) continue
        const size = parseFloat(window.getComputedStyle(el).fontSize)
        if (size > 0 && size < minFontSize) {
          minFontSize = size
        }
      }
      return { heroFontSize, minFontSize }
    })

    expect(fontMetrics.heroFontSize).toBeGreaterThanOrEqual(16)
    expect(fontMetrics.minFontSize).toBeGreaterThanOrEqual(13)

    // Batch pemeriksaan seluruh 5 viewport: bebas horizontal overflow & elemen utama terlihat
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await expect(page.getByRole('heading', { name: /Rancang CV Unggul/i })).toBeVisible()
      await expect(page.getByTestId('btn-dashboard-create-cv')).toBeVisible()
      await expect(page.getByTestId('card-workspace-builder')).toBeVisible()
      await expect(page.getByTestId('card-workspace-ats')).toBeVisible()
      await expect(page.getByTestId('card-workspace-tools')).toBeVisible()

      const hasHorizontalOverflow = await page.evaluate(() => {
        const doc = document.documentElement
        const main = document.querySelector('[data-testid="dashboard-view"]') as HTMLElement | null
        const docOverflow = doc.scrollWidth > doc.clientWidth + 1
        const mainOverflow = main ? main.scrollWidth > main.clientWidth + 1 : false
        return docOverflow || mainOverflow
      })
      expect(hasHorizontalOverflow, `Overflow horizontal terdeteksi pada ${vp.name}`).toBe(false)
    }

    // Uji ketahanan perbesaran 200% (simulasi zoom 200% pada desktop 1440px)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2'
    })
    const zoomOverflow = await page.evaluate(() => {
      const main = document.querySelector('[data-testid="dashboard-view"]') as HTMLElement | null
      return main ? main.scrollWidth > main.clientWidth + 1 : false
    })
    expect(zoomOverflow).toBe(false)
    await page.evaluate(() => {
      document.documentElement.style.zoom = '1'
    })

    // Verifikasi CLS <= 0.1
    const clsScore = await page.evaluate(() => (window as any).__clsScore || 0)
    expect(clsScore).toBeLessThanOrEqual(0.1)

    // Uji navigasi keyboard (Tab & Enter) menuju Buat CV Baru dan kembali ke Beranda
    const createBtn = page.getByTestId('btn-dashboard-create-cv')
    await createBtn.focus()
    await expect(createBtn).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/#\/builder$/)
    const titleInput = page.getByTestId('input-draft-title')
    await expect(titleInput).toBeVisible()

    // Uji ketahanan teks ekstrem (judul CV sangat panjang tanpa spasi) saat kembali ke Beranda
    const extremeTitle =
      'CV_Principal_Distributed_Systems_Architect_With_Extremely_Long_Unbroken_Identifier_2026_V12'
    await titleInput.fill(extremeTitle)
    await page.getByTestId('btn-logo-home').click()

    await expect(page).toHaveURL(/#\/home$/)
    await expect(page.getByTestId('dashboard-drafts-list')).toBeVisible()

    // Pastikan pada mobile 390px dengan judul ekstrem tetap tidak ada horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 })
    const mobileExtremeOverflow = await page.evaluate(() => {
      const main = document.querySelector('[data-testid="dashboard-view"]') as HTMLElement | null
      return main ? main.scrollWidth > main.clientWidth + 1 : false
    })
    expect(mobileExtremeOverflow).toBe(false)

    // Verifikasi lintas route (#/builder, #/ats, #/tools) bebas kelas ungu dan mempertahankan tekstur kertas di latar belakang
    await page.setViewportSize({ width: 1440, height: 900 })
    for (const route of ['/#/builder', '/#/ats', '/#/tools']) {
      await page.goto(route)
      const routeCheck = await page.evaluate(() => {
        const shell = document.querySelector('.app-shell')
        return {
          hasPaperCanvas: shell ? shell.classList.contains('paper-canvas') : false,
          hasPurple: /indigo-|violet-|purple-/.test(document.body.innerHTML)
        }
      })
      expect(routeCheck.hasPaperCanvas, `Kanvas .paper-canvas harus aktif pada ${route}`).toBe(true)
      expect(routeCheck.hasPurple, `Tidak boleh ada kelas ungu pada ${route}`).toBe(false)
    }
  })
})
