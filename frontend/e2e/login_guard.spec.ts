import { test, expect } from '@playwright/test'

test.describe('Login Page & Two-Step Anti-Bot Flow', () => {
  test('pengguna anonim membuka alat komputasi server dialihkan ke #/login dengan pesan guard', async ({
    page,
  }) => {
    // 1. Akses ke #/tools
    await page.goto('/#/tools')
    await expect(page.getByTestId('input-search-tools')).toBeVisible()

    // 2. Klik alat komputasi server (Merge Dokumen) -> alihkan ke #/login
    await page.getByTestId('tool-card-merge-dokumen').click()
    await expect(page).toHaveURL(/#\/login$/)

    // 3. Pastikan halaman login penuh terbuka (bukan popup)
    await expect(page.getByTestId('login-page-container')).toBeVisible()
    await expect(
      page.getByText('Alat komputasi server memerlukan akun terdaftar. Silakan masuk atau daftar terlebih dahulu.')
    ).toBeVisible()

    // 4. Form Step 1 kredensial ada, soal matematika anti-bot BELUM muncul
    await expect(page.getByTestId('input-auth-email')).toBeVisible()
    await expect(page.getByTestId('input-auth-password')).toBeVisible()
    await expect(page.getByTestId('btn-submit-step-1')).toBeVisible()
    await expect(page.getByTestId('challenge-question')).not.toBeAttached()

    // 5. Tombol kembali ke beranda
    await page.getByTestId('btn-login-back-home').click()
    await expect(page).toHaveURL(/#\/home$/)
    await expect(page.getByTestId('dashboard-view')).toBeVisible()
  })

  test('pengguna anonim melihat kartu Coming Soon nonaktif dan dapat membuka alat murni browser aktif tanpa login', async ({
    page,
  }) => {
    await page.goto('/#/tools')
    await expect(page.getByTestId('input-search-tools')).toBeVisible()

    // Kartu WebP ke JPG berstatus Coming Soon dan disabled
    const webpCard = page.getByTestId('tool-card-webp-ke-jpg')
    await expect(webpCard).toBeDisabled()
    await expect(webpCard).toContainText('Coming Soon')

    // Klik alat murni browser aktif (Generate QR Code)
    await page.getByTestId('tool-card-generate-qr-code').click()
    await expect(page.getByTestId('btn-close-qr-modal')).toBeVisible()
  })

  test('tombol masuk di navbar membuka halaman penuh #/login', async ({ page }) => {
    await page.goto('/#/home')
    await expect(page.getByTestId('dashboard-view')).toBeVisible()

    // Klik tombol Masuk di topbar
    await page.getByTestId('btn-nav-login').click()
    await expect(page).toHaveURL(/#\/login$/)
    await expect(page.getByTestId('login-page-container')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Masuk ke Beresin' })).toBeVisible()
  })
})
