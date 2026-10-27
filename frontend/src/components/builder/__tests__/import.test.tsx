import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ImportResumeModal } from '../ImportResumeModal'
import { apiFetch } from '../../../services/apiClient'

vi.mock('../../../services/apiClient', () => ({ apiFetch: vi.fn() }))

describe('ImportResumeModal Component', () => {
  it('tidak me-render apapun ketika isOpen bernilai false', () => {
    const { container } = render(
      <ImportResumeModal isOpen={false} onClose={vi.fn()} onApply={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('merender area upload dan tombol ketika isOpen bernilai true', () => {
    render(
      <ImportResumeModal isOpen={true} onClose={vi.fn()} onApply={vi.fn()} />
    )
    expect(screen.getByText(/Impor Data CV/i)).toBeInTheDocument()
    expect(screen.getByTestId('dropzone-import')).toBeInTheDocument()
    expect(screen.getByTestId('btn-start-parse')).toBeInTheDocument()
  })

  it('menolak pemilihan berkas selain .pdf dan .docx', () => {
    render(
      <ImportResumeModal isOpen={true} onClose={vi.fn()} onApply={vi.fn()} />
    )

    const input = screen.getByTestId('input-file-import')
    const badFile = new File(['dummy content'], 'document.txt', { type: 'text/plain' })

    fireEvent.change(input, { target: { files: [badFile] } })

    expect(
      screen.getByText(/Hanya berkas format \.pdf dan \.docx yang didukung/i)
    ).toBeInTheDocument()
  })

  it('menerima berkas .pdf yang valid dan mengaktifkan tombol ekstrak', () => {
    render(
      <ImportResumeModal isOpen={true} onClose={vi.fn()} onApply={vi.fn()} />
    )

    const input = screen.getByTestId('input-file-import')
    const pdfFile = new File(['%PDF-1.4 content'], 'my_old_resume.pdf', { type: 'application/pdf' })

    fireEvent.change(input, { target: { files: [pdfFile] } })

    expect(screen.getByText('my_old_resume.pdf')).toBeInTheDocument()
    const btnParse = screen.getByTestId('btn-start-parse')
    expect(btnParse).not.toBeDisabled()
  })

  it('menampilkan semua hasil dan mewajibkan konfirmasi sebelum mengganti editor', async () => {
    const onApply = vi.fn()
    const result = {
      success: true,
      filename: 'resume.docx',
      data: {
        contact: {
          fullName: 'Rina Wijaya',
          email: 'rina@example.com',
          phone: '+628123456789',
          location: 'Jakarta',
          linkedin: '',
          website: ''
        },
        summary: 'Backend engineer berpengalaman membangun layanan berskala besar.',
        experiences: [{
          id: 'exp-1', jobTitle: 'Senior Engineer', company: 'PT Maju', location: 'Jakarta',
          startDate: '2021', endDate: 'Sekarang', current: true, description: 'Meningkatkan performa.'
        }],
        education: [{
          id: 'edu-1', institution: 'Universitas Indonesia', degree: 'S1', fieldOfStudy: 'Ilmu Komputer',
          startDate: '2015', endDate: '2019', gpa: '3.8', description: ''
        }],
        skills: [{ id: 'skill-1', name: 'Python', category: 'Technical' }],
        languages: [{ id: 'lang-1', language: 'English', proficiency: 'Professional' }],
        customSections: [{
          id: 'custom-1', sectionTitle: 'Sertifikasi',
          items: [{ id: 'item-1', title: '', subtitle: '', date: '', description: 'AWS Certified' }]
        }]
      },
      confidence: {
        overall: 0.82, fullName: 0.85, email: 0.95, phone: 0.9, summary: 0.85,
        experiences: 0.9, education: 0.9, skills: 0.6, languages: 0.85, customSections: 0.85
      },
      extraction: {
        sourceFormat: 'DOCX', lineCount: 20, textCharacters: 500,
        detectedSections: ['Ringkasan', 'Pengalaman Kerja', 'Pendidikan', 'Keahlian', 'Bahasa', 'Sertifikasi'],
        missingSections: [], layoutPreserved: false
      },
      warnings: ['Desain asli tidak ikut diimpor.']
    }
    vi.mocked(apiFetch).mockResolvedValueOnce(new Response(JSON.stringify(result), { status: 200 }))

    render(<ImportResumeModal isOpen={true} onClose={vi.fn()} onApply={onApply} />)
    fireEvent.change(screen.getByTestId('input-file-import'), {
      target: { files: [new File(['docx'], 'resume.docx')] }
    })
    fireEvent.click(screen.getByTestId('btn-start-parse'))

    await waitFor(() => expect(screen.getByText('Tinjau Semua Bagian')).toBeInTheDocument())
    expect(screen.getByText(/Senior Engineer — PT Maju/i)).toBeInTheDocument()
    expect(screen.getByText(/English \(Professional\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Sertifikasi[\s\S]*AWS Certified/i)).toBeInTheDocument()

    const applyButton = screen.getByTestId('btn-confirm-apply')
    expect(applyButton).toBeDisabled()
    fireEvent.click(screen.getByTestId('confirm-replace-import'))
    expect(applyButton).not.toBeDisabled()
    fireEvent.click(applyButton)
    expect(onApply).toHaveBeenCalledWith(
      result.data,
      [
        'contact',
        'summary',
        'experiences',
        'education',
        'skills',
        'languages',
        'customSections'
      ],
      'merge'
    )
  })

  it('hanya mengirim bagian yang dicentang dengan mode yang dipilih', async () => {
    const onApply = vi.fn()
    const result = {
      success: true,
      filename: 'resume.docx',
      data: {
        contact: { fullName: 'Rina', email: 'rina@example.com', phone: '', location: '', linkedin: '', website: '' },
        summary: 'Ringkasan hasil impor.',
        experiences: [],
        education: [],
        skills: [{ id: 'skill-1', name: 'Python', category: 'Technical' }],
        languages: [],
        customSections: []
      },
      confidence: { overall: 0.8, fullName: 0.9, email: 0.9, phone: 0, summary: 0.8, experiences: 0, education: 0, skills: 0.8, languages: 0, customSections: 0 },
      extraction: { sourceFormat: 'docx', lineCount: 10, textCharacters: 100, detectedSections: ['skills'], missingSections: [], layoutPreserved: false },
      warnings: []
    }
    vi.mocked(apiFetch).mockResolvedValueOnce(new Response(JSON.stringify(result), { status: 200 }))

    render(<ImportResumeModal isOpen={true} onClose={vi.fn()} onApply={onApply} />)
    fireEvent.change(screen.getByTestId('input-file-import'), {
      target: { files: [new File(['docx'], 'resume.docx')] }
    })
    fireEvent.click(screen.getByTestId('btn-start-parse'))
    await waitFor(() => expect(screen.getByText('Tinjau Semua Bagian')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('import-section-contact'))
    fireEvent.click(screen.getByTestId('import-section-summary'))
    fireEvent.click(screen.getByTestId('import-mode-replace'))
    fireEvent.click(screen.getByTestId('confirm-replace-import'))
    fireEvent.click(screen.getByTestId('btn-confirm-apply'))

    expect(onApply).toHaveBeenCalledWith(
      result.data,
      ['experiences', 'education', 'skills', 'languages', 'customSections'],
      'replace'
    )
  })
})
