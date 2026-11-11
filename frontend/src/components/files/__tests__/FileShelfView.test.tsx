import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileShelfView } from '../FileShelfView'
import * as fileShelfService from '../../../services/fileShelf'
import { type AuthUser } from '../../../services/auth'

vi.mock('../../../services/fileShelf', () => ({
  fetchUserFiles: vi.fn(),
  fetchFileMetrics: vi.fn(),
  deleteUserFile: vi.fn(),
  downloadUserFile: vi.fn(),
  uploadFileStream: vi.fn(),
}))

describe('FileShelfView Component', () => {
  const mockNavigate = vi.fn()
  const verifiedUser: AuthUser = {
    id: 'user-1',
    name: 'Budi Santoso',
    email: 'budi@example.com',
    email_verified: true,
  }

  const defaultMetrics: fileShelfService.FileShelfMetrics = {
    slots_used: 1,
    slots_total: 5,
    storage_used_bytes: 2048,
    max_storage_bytes: 125000000,
    uploads_rolling_count: 2,
    max_uploads_per_hour: 10,
    downloads_rolling_count: 5,
    max_downloads_per_hour: 30,
    r2_storage_status: 'HEALTHY',
    retention_days: 30,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fileShelfService.fetchUserFiles).mockResolvedValue([])
    vi.mocked(fileShelfService.fetchFileMetrics).mockResolvedValue(defaultMetrics)
  })

  // 1. STATE: UNAUTHENTICATED
  it('State 1 (UNAUTHENTICATED): menampilkan prompt login saat currentUser null', () => {
    render(<FileShelfView currentUser={null} onNavigate={mockNavigate} />)

    const view = screen.getByTestId('file-shelf-view')
    expect(view).toHaveAttribute('data-state', 'unauthenticated')
    expect(screen.getByTestId('state-unauthenticated')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Masuk untuk Mengakses Rak Berkas' })
    ).toBeInTheDocument()

    const loginBtn = screen.getByRole('button', { name: 'Masuk / Daftar Akun' })
    fireEvent.click(loginBtn)
    expect(mockNavigate).toHaveBeenCalledWith('login')
  })

  // 2. STATE: UNVERIFIED_EMAIL
  it('State 2 (UNVERIFIED_EMAIL): menampilkan peringatan jika email belum diverifikasi', () => {
    const unverifiedUser: AuthUser = {
      ...verifiedUser,
      email_verified: false,
    }

    render(<FileShelfView currentUser={unverifiedUser} onNavigate={mockNavigate} />)

    const view = screen.getByTestId('file-shelf-view')
    expect(view).toHaveAttribute('data-state', 'unverified_email')
    expect(screen.getByTestId('state-unverified-email')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Alamat Email Belum Diverifikasi' })
    ).toBeInTheDocument()
  })

  // 3. STATE: EMPTY
  it('State 3 (EMPTY): menampilkan pesan rak kosong saat belum ada berkas tersimpan', async () => {
    vi.mocked(fileShelfService.fetchUserFiles).mockResolvedValue([])
    vi.mocked(fileShelfService.fetchFileMetrics).mockResolvedValue({
      ...defaultMetrics,
      slots_used: 0,
    })

    render(<FileShelfView currentUser={verifiedUser} onNavigate={mockNavigate} />)

    await waitFor(() => {
      const view = screen.getByTestId('file-shelf-view')
      expect(view).toHaveAttribute('data-state', 'empty')
    })

    expect(screen.getByTestId('state-empty')).toBeInTheDocument()
    expect(screen.getByText('Rak Berkas Anda Masih Kosong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pilih Berkas Pertama' })).toBeInTheDocument()
  })

  // 5. STATE: CHECKING
  it('State 5 (CHECKING): menampilkan status pemindaian ClamAV & inspeksi in-flight', async () => {
    const checkingItem: fileShelfService.FileShelfItem = {
      id: 'item-checking-1',
      filename: 'dokumen_kerja.pdf',
      content_type: 'application/pdf',
      size_bytes: 1048576,
      status: 'CHECKING',
      has_exif_warning: false,
      uploaded_at: Date.now() / 1000,
    }

    vi.mocked(fileShelfService.fetchUserFiles).mockResolvedValue([checkingItem])

    render(<FileShelfView currentUser={verifiedUser} onNavigate={mockNavigate} />)

    await waitFor(() => {
      const view = screen.getByTestId('file-shelf-view')
      expect(view).toHaveAttribute('data-state', 'checking')
    })

    expect(screen.getByTestId('status-checking')).toHaveTextContent('Memindai ClamAV...')
    expect(screen.getByText('dokumen_kerja.pdf')).toBeInTheDocument()
  })

  // 6. STATE: AVAILABLE
  it('State 6 (AVAILABLE): menampilkan daftar berkas aman dengan aksi unduh & hapus', async () => {
    const availableItem: fileShelfService.FileShelfItem = {
      id: 'item-avail-1',
      filename: 'laporan_tahunan.docx',
      content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size_bytes: 2097152, // 2.0 MB
      status: 'AVAILABLE',
      has_exif_warning: false,
      sha256_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      uploaded_at: Date.now() / 1000,
      available_at: Date.now() / 1000,
      expires_at: (Date.now() / 1000) + (30 * 86400),
    }

    vi.mocked(fileShelfService.fetchUserFiles).mockResolvedValue([availableItem])

    render(<FileShelfView currentUser={verifiedUser} onNavigate={mockNavigate} />)

    await waitFor(() => {
      const view = screen.getByTestId('file-shelf-view')
      expect(view).toHaveAttribute('data-state', 'available')
    })

    expect(screen.getByTestId('status-available')).toHaveTextContent('Aman (Terenkripsi)')
    expect(screen.getByText('laporan_tahunan.docx')).toBeInTheDocument()
    expect(screen.getByText('2.0 MB')).toBeInTheDocument()
    expect(screen.getByText(/hari tersisa/)).toBeInTheDocument()
    expect(screen.getByText(/SHA256: abcdef123456/)).toBeInTheDocument()

    // Test download trigger
    const downloadBtn = screen.getByRole('button', { name: 'Unduh laporan_tahunan.docx' })
    fireEvent.click(downloadBtn)
    expect(fileShelfService.downloadUserFile).toHaveBeenCalledWith('item-avail-1', 'laporan_tahunan.docx')

    // Test delete trigger with confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const deleteBtn = screen.getByRole('button', { name: 'Hapus laporan_tahunan.docx' })
    fireEvent.click(deleteBtn)
    expect(fileShelfService.deleteUserFile).toHaveBeenCalledWith('item-avail-1')
  })

  // 7. STATE: QUOTA_FULL
  it('State 7 (QUOTA_FULL): menampilkan peringatan kuota penuh saat 5 slot terpakai', async () => {
    const fullItems: fileShelfService.FileShelfItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: `item-${i}`,
      filename: `doc_${i}.pdf`,
      content_type: 'application/pdf',
      size_bytes: 100000,
      status: 'AVAILABLE',
      has_exif_warning: false,
      uploaded_at: Date.now() / 1000,
    }))

    vi.mocked(fileShelfService.fetchUserFiles).mockResolvedValue(fullItems)
    vi.mocked(fileShelfService.fetchFileMetrics).mockResolvedValue({
      ...defaultMetrics,
      slots_used: 5,
    })

    render(<FileShelfView currentUser={verifiedUser} onNavigate={mockNavigate} />)

    await waitFor(() => {
      const view = screen.getByTestId('file-shelf-view')
      expect(view).toHaveAttribute('data-state', 'quota_full')
    })

    expect(screen.getByTestId('state-quota-full')).toBeInTheDocument()
    expect(screen.getByText(/Batas Kuota Rak Berkas Tercapai/)).toBeInTheDocument()

    const uploadBtn = screen.getByRole('button', { name: 'Unggah Berkas' })
    expect(uploadBtn).toBeDisabled()
  })

  // 8. STATE: ERROR
  it('State 8 (ERROR): menampilkan banner error saat pemuatan atau operasi gagal', async () => {
    vi.mocked(fileShelfService.fetchUserFiles).mockRejectedValue(
      new Error('Koneksi database server terputus.')
    )

    render(<FileShelfView currentUser={verifiedUser} onNavigate={mockNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('error-banner')).toBeInTheDocument()
      expect(screen.getByText('Koneksi database server terputus.')).toBeInTheDocument()
    })
  })

  // EXIF / GPS Warning Modal (RISK-SEC-014)
  it('menampilkan modal peringatan EXIF/GPS saat berkas gambar dipilih dan mewajibkan checkbox', async () => {
    vi.mocked(fileShelfService.fetchUserFiles).mockResolvedValue([])

    const { container } = render(
      <FileShelfView currentUser={verifiedUser} onNavigate={mockNavigate} />
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()

    const imageFile = new File(['fake-jpg-content'], 'foto_liburan.jpg', {
      type: 'image/jpeg',
    })

    fireEvent.change(fileInput, { target: { files: [imageFile] } })

    // Modal EXIF must appear
    expect(screen.getByTestId('exif-warning-modal')).toBeInTheDocument()
    expect(
      screen.getByText('Konfirmasi Metadata Foto (EXIF/GPS)')
    ).toBeInTheDocument()

    const confirmBtn = screen.getByTestId('confirm-exif-upload-button')
    expect(confirmBtn).toBeDisabled()

    // Check agreement checkbox
    const checkbox = screen.getByTestId('exif-agreement-checkbox')
    fireEvent.click(checkbox)
    expect(confirmBtn).not.toBeDisabled()

    // Click confirm upload
    vi.mocked(fileShelfService.uploadFileStream).mockResolvedValue({
      id: 'new-img-id',
      filename: 'foto_liburan.jpg',
      content_type: 'image/jpeg',
      size_bytes: 16,
      status: 'CHECKING',
      has_exif_warning: true,
      uploaded_at: Date.now() / 1000,
    })

    fireEvent.click(confirmBtn)
    expect(fileShelfService.uploadFileStream).toHaveBeenCalledWith(
      imageFile,
      true,
      expect.any(Function)
    )
  })
})
