import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Dashboard } from '../Dashboard'
import { type ResumeDraft, type ResumeDraftSummary, createEmptyResumeData } from '../../../types/resume'

const sampleDraft: ResumeDraft = {
  id: 'draft-1',
  title: 'CV Software Engineer',
  templateId: 'ats-clean',
  colorTheme: '#1e293b',
  fontFamily: 'sans',
  resumeLanguage: 'id',
  data: createEmptyResumeData(),
  createdAt: 1000,
  updatedAt: Date.now() - 5000,
  version: 1,
  favorite: false
}

const sampleSummaries: ResumeDraftSummary[] = [
  {
    id: 'draft-1',
    title: 'CV Software Engineer',
    templateId: 'ats-clean',
    createdAt: 1000,
    updatedAt: Date.now() - 5000,
    favorite: true,
    targetJobTitle: 'Senior Backend Engineer'
  },
  {
    id: 'draft-2',
    title: 'CV Frontend Lead',
    templateId: 'ats-modern',
    createdAt: 2000,
    updatedAt: Date.now() - 120000,
    favorite: false
  }
]

describe('Dashboard Component Suite', () => {
  it('merender dashboard dengan empty state saat belum ada CV yang dibuat', () => {
    render(
      <Dashboard
        draft={null}
        draftsList={[]}
        privateMode={false}
        onNavigate={vi.fn()}
        onCreateNewResume={vi.fn()}
        onOpenImportModal={vi.fn()}
        onLoadDraft={vi.fn()}
      />
    )

    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Satu Tempat,\s*Banyak Solusi Digital/i })).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-drafts-empty')).toBeInTheDocument()
    expect(screen.getByText(/Belum ada CV yang dibuat/i)).toBeInTheDocument()
    expect(screen.getByTestId('stat-total-drafts')).toHaveTextContent('0')
    expect(screen.queryByTestId('btn-dashboard-continue-latest')).not.toBeInTheDocument()
  })

  it('merender dashboard dengan daftar draft tersimpan dan metrik cepat', () => {
    render(
      <Dashboard
        draft={sampleDraft}
        draftsList={sampleSummaries}
        atsScore={88}
        privateMode={true}
        documentToolsCount={18}
        onNavigate={vi.fn()}
        onCreateNewResume={vi.fn()}
        onOpenImportModal={vi.fn()}
        onLoadDraft={vi.fn()}
        onOpenAtsScore={vi.fn()}
      />
    )

    expect(screen.getByTestId('stat-total-drafts')).toHaveTextContent('2')
    expect(screen.getByTestId('stat-ats-score')).toHaveTextContent('88')
    expect(screen.getByTestId('stat-tools-count')).toHaveTextContent('18')
    expect(screen.getByText('Mode Privat Aktif')).toBeInTheDocument()
    expect(screen.getByTestId('btn-dashboard-continue-latest')).toBeInTheDocument()
    expect(screen.getAllByText('CV Software Engineer').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('CV Frontend Lead')).toBeInTheDocument()
    expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument()
  })

  it('memanggil handler saat tombol aksi cepat dan kartu workspace diklik', async () => {
    const handleNavigate = vi.fn()
    const handleCreateNew = vi.fn()
    const handleImport = vi.fn()
    const handleLoadDraft = vi.fn()
    const handleToggleFavorite = vi.fn()

    render(
      <Dashboard
        draft={sampleDraft}
        draftsList={sampleSummaries}
        atsScore={75}
        privateMode={false}
        onNavigate={handleNavigate}
        onCreateNewResume={handleCreateNew}
        onOpenImportModal={handleImport}
        onLoadDraft={handleLoadDraft}
        onToggleFavorite={handleToggleFavorite}
      />
    )

    // Klik Buat CV Baru
    fireEvent.click(screen.getByTestId('btn-dashboard-create-cv'))
    await waitFor(() => expect(handleCreateNew).toHaveBeenCalledTimes(1))

    // Klik Impor CV
    fireEvent.click(screen.getByTestId('btn-dashboard-import-cv'))
    await waitFor(() => expect(handleImport).toHaveBeenCalledTimes(1))

    // Klik Kartu Workspace Builder
    fireEvent.click(screen.getByTestId('card-workspace-builder'))
    expect(handleNavigate).toHaveBeenCalledWith('builder')

    // Klik Kartu Workspace ATS
    fireEvent.click(screen.getByTestId('card-workspace-ats'))
    expect(handleNavigate).toHaveBeenCalledWith('ats')

    // Klik Kartu Workspace Tools
    fireEvent.click(screen.getByTestId('card-workspace-tools'))
    expect(handleNavigate).toHaveBeenCalledWith('tools')

    // Klik judul draft dalam daftar
    fireEvent.click(screen.getByText('CV Frontend Lead'))
    await waitFor(() => {
      expect(handleLoadDraft).toHaveBeenCalledWith('draft-2')
      expect(handleNavigate).toHaveBeenCalledWith('builder')
    })

    // Klik tombol favorit pada draft
    fireEvent.click(screen.getByLabelText('Favorit CV Software Engineer'))
    await waitFor(() => expect(handleToggleFavorite).toHaveBeenCalledWith('draft-1'))
  })

  it('menampilkan skeleton loading saat isLoadingDrafts bernilai true tanpa menampilkan empty state palsu', () => {
    render(
      <Dashboard
        draft={null}
        draftsList={[]}
        privateMode={false}
        isLoadingDrafts={true}
        onNavigate={vi.fn()}
        onCreateNewResume={vi.fn()}
        onOpenImportModal={vi.fn()}
        onLoadDraft={vi.fn()}
      />
    )

    expect(screen.getByTestId('dashboard-drafts-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-drafts-empty')).not.toBeInTheDocument()
    expect(screen.getByTestId('stat-total-drafts')).toHaveTextContent('…')
    expect(screen.getByTestId('stat-active-draft-title')).toHaveTextContent('Memuat draf...')
  })

  it('menampilkan banner error penyimpanan tersanitasi dan memanggil onRetryLoadDrafts saat tombol Coba Lagi diklik', () => {
    const handleRetry = vi.fn()
    render(
      <Dashboard
        draft={null}
        draftsList={[]}
        privateMode={false}
        storageError="Gagal mengakses penyimpanan lokal browser. Silakan coba lagi."
        onRetryLoadDrafts={handleRetry}
        onNavigate={vi.fn()}
        onCreateNewResume={vi.fn()}
        onOpenImportModal={vi.fn()}
        onLoadDraft={vi.fn()}
      />
    )

    const alert = screen.getByTestId('dashboard-storage-error')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent('Gagal mengakses penyimpanan lokal browser. Silakan coba lagi.')

    fireEvent.click(screen.getByTestId('btn-dashboard-retry-storage'))
    expect(handleRetry).toHaveBeenCalledTimes(1)
  })

  it('menampilkan jumlah alat dokumen secara dinamis dan tidak merender tombol mati saat skor ATS belum tersedia', () => {
    render(
      <Dashboard
        draft={null}
        draftsList={[]}
        privateMode={false}
        documentToolsCount={18}
        onNavigate={vi.fn()}
        onCreateNewResume={vi.fn()}
        onOpenImportModal={vi.fn()}
        onLoadDraft={vi.fn()}
      />
    )

    expect(screen.getByTestId('stat-tools-count')).toHaveTextContent('18')
    expect(screen.queryByTestId('btn-dashboard-ats-details')).not.toBeInTheDocument()
    expect(screen.getByText('Belum ada evaluasi')).toBeInTheDocument()

    // Pastikan tidak ada tombol yang disabled pada kondisi awal
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => {
      expect(btn).not.toBeDisabled()
    })
  })

  it('mencegah double-submit saat tombol Buat CV Baru diklik berulang kali sementara operasi async masih berlangsung', async () => {
    let resolveCreate: () => void = () => {}
    const slowCreate = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveCreate = resolve
        })
    )

    render(
      <Dashboard
        draft={null}
        draftsList={[]}
        privateMode={false}
        onNavigate={vi.fn()}
        onCreateNewResume={slowCreate}
        onOpenImportModal={vi.fn()}
        onLoadDraft={vi.fn()}
      />
    )

    const createBtn = screen.getByTestId('btn-dashboard-create-cv')
    fireEvent.click(createBtn)
    fireEvent.click(createBtn)
    fireEvent.click(createBtn)

    expect(slowCreate).toHaveBeenCalledTimes(1)
    expect(createBtn).toHaveTextContent('Membuat CV...')

    resolveCreate()
    await waitFor(() => {
      expect(createBtn).toHaveTextContent('Coba Sekarang')
    })
  })

  it('merender badge sisa hari retensi dan peringatan saat masa aktif <= 7 hari', () => {
    const now = Date.now()
    const draftsWithExpiry: ResumeDraftSummary[] = [
      {
        id: 'draft-normal',
        title: 'CV Masih Aman',
        templateId: 'ats-clean',
        createdAt: now,
        updatedAt: now,
        expiresAt: now + 25 * 86400 * 1000, // 25 hari lagi
        favorite: false
      },
      {
        id: 'draft-urgent',
        title: 'CV Akan Kedaluwarsa',
        templateId: 'ats-clean',
        createdAt: now,
        updatedAt: now,
        expiresAt: now + 5 * 86400 * 1000, // 5 hari lagi (<= 7 hari)
        favorite: false
      }
    ]

    render(
      <Dashboard
        draft={null}
        draftsList={draftsWithExpiry}
        privateMode={false}
        onNavigate={vi.fn()}
        onCreateNewResume={vi.fn()}
        onOpenImportModal={vi.fn()}
        onLoadDraft={vi.fn()}
      />
    )

    const normalBadge = screen.getByTestId('draft-expiry-draft-normal')
    expect(normalBadge).toHaveTextContent('Tersisa 25 hari')
    expect(normalBadge.className).toContain('text-stone-600')

    const urgentBadge = screen.getByTestId('draft-expiry-draft-urgent')
    expect(urgentBadge).toHaveTextContent('Tersisa 5 hari')
    expect(urgentBadge.className).toContain('text-amber-900')
  })

  it('menerapkan fondasi merek Satukit dan komposisi landing referensi tanpa kelas warna ungu', () => {
    const { container } = render(
      <Dashboard
        draft={sampleDraft}
        draftsList={sampleSummaries}
        atsScore={90}
        privateMode={false}
        onNavigate={vi.fn()}
        onCreateNewResume={vi.fn()}
        onOpenImportModal={vi.fn()}
        onLoadDraft={vi.fn()}
        onOpenAtsScore={vi.fn()}
      />
    )

    expect(container.innerHTML).not.toMatch(/indigo-|violet-|purple-/)
    const dashboardView = screen.getByTestId('dashboard-view')
    expect(dashboardView.className).toContain('paper-canvas')
    expect(screen.getByTestId('btn-dashboard-create-cv')).toHaveTextContent('Coba Sekarang')
    expect(screen.getByRole('heading', { name: /Fitur Unggulan Satukit/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Cara Menggunakan Satukit/i })).toBeInTheDocument()
    const builderCard = screen.getByTestId('card-workspace-builder')
    expect(builderCard.parentElement?.className).toContain('bg-white')
    expect(builderCard.parentElement?.className).toContain('dark:bg-stone-900')
    expect(screen.getByTestId('dashboard-drafts-list').className).toContain('dark:bg-stone-900')
    expect(container.innerHTML).not.toContain('stone-850')
    expect(builderCard.className).not.toContain('paper-canvas')
  })

  it('memastikan seluruh kode sumber produksi frontend bebas dari warna ungu lama dan memiliki definisi .paper-canvas', () => {
    const rawModules = import.meta.glob('../../../**/*.{ts,tsx,css}', {
      query: '?raw',
      import: 'default',
      eager: true
    }) as Record<string, string>

    const prodEntries = Object.entries(rawModules).filter(
      ([filePath]) => !filePath.includes('__tests__') && !filePath.includes('/test/')
    )
    expect(prodEntries.length).toBeGreaterThan(20)

    const forbiddenPattern = /\b(?:indigo|violet|purple)-[a-z0-9/]+|#7c3aed|#6d28d9|#4338ca/i
    const violations: string[] = []

    for (const [filePath, content] of prodEntries) {
      const match = content.match(forbiddenPattern)
      if (match) {
        violations.push(`${filePath}: ${match[0]}`)
      }
    }

    expect(violations).toEqual([])

    const appTsxEntry = prodEntries.find(([filePath]) => filePath.endsWith('App.tsx'))
    const dashboardTsxEntry = prodEntries.find(([filePath]) => filePath.endsWith('Dashboard.tsx'))
    expect(appTsxEntry?.[1]).toContain('paper-canvas')
    expect(dashboardTsxEntry?.[1]).toContain('paper-canvas')
  })

  it('merender footer informasi pengembang, tahun 2026, dan link portofolio Rahmat Hidayat', () => {
    render(
      <Dashboard
        draft={sampleDraft}
        draftsList={sampleSummaries}
        privateMode={false}
        onNavigate={vi.fn()}
        onCreateNewResume={vi.fn()}
        onOpenImportModal={vi.fn()}
        onLoadDraft={vi.fn()}
      />
    )

    const footer = screen.getByTestId('app-footer')
    expect(footer).toBeInTheDocument()
    expect(footer).toHaveTextContent('2026')

    const devLink = screen.getByTestId('footer-developer-link')
    expect(devLink).toHaveTextContent('Rahmat Hidayat')
    expect(devLink).toHaveAttribute('href', 'https://porto.rahmath72.cloud/')
    expect(devLink).toHaveAttribute('target', '_blank')
    expect(devLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('merender 3 trust badge hero dalam kapsul kontras tinggi (Cepat & Mudah, Aman & Privat, Selalu Bertambah)', () => {
    render(
      <Dashboard
        draft={null}
        draftsList={[]}
        privateMode={false}
        onNavigate={vi.fn()}
        onCreateNewResume={vi.fn()}
        onOpenImportModal={vi.fn()}
        onLoadDraft={vi.fn()}
      />
    )

    expect(screen.getByText('Cepat & Mudah')).toBeInTheDocument()
    expect(screen.getByText('Aman & Privat')).toBeInTheDocument()
    expect(screen.getByText('Selalu Bertambah')).toBeInTheDocument()

    const badgeSpan = screen.getByText('Cepat & Mudah').closest('.rounded-full')
    expect(badgeSpan?.className).toContain('rounded-full')
    expect(badgeSpan?.className).toContain('bg-white/80')
  })
})
