import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContactForm } from '../ContactForm'
import { SummaryForm } from '../SummaryForm'
import { SkillsForm } from '../SkillsForm'
import { ResumePreview } from '../../preview/ResumePreview'
import { type ResumeDraft, createEmptyResumeData } from '../../../types/resume'

describe('CV Builder Form Components & Live Preview', () => {
  it('ContactForm memperbarui nama lengkap ketika diubah', () => {
    const mockChange = vi.fn()
    const contact = {
      fullName: 'Ahmad Dahlan',
      email: 'ahmad@example.com',
      phone: '0812345678',
      location: 'Yogyakarta',
      linkedin: '',
      website: ''
    }

    render(<ContactForm contact={contact} onChange={mockChange} />)

    const inputName = screen.getByTestId('input-fullname') as HTMLInputElement
    expect(inputName.value).toBe('Ahmad Dahlan')

    fireEvent.change(inputName, { target: { value: 'Ahmad Dahlan, M.Kom' } })
    expect(mockChange).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Ahmad Dahlan, M.Kom' })
    )
  })

  it('SummaryForm menampilkan jumlah kata dan memicu onChange', () => {
    const mockChange = vi.fn()
    render(<SummaryForm summary="Frontend Engineer berpengalaman membangun aplikasi React." onChange={mockChange} />)

    expect(screen.getByText(/6 kata/i)).toBeInTheDocument()

    const textarea = screen.getByTestId('textarea-summary')
    fireEvent.change(textarea, { target: { value: 'Software Engineer profesional.' } })
    expect(mockChange).toHaveBeenCalledWith('Software Engineer profesional.')
  })

  it('SkillsForm menambahkan keahlian baru ke daftar', () => {
    const mockChange = vi.fn()
    const skills = [
      { id: '1', name: 'TypeScript', category: 'Technical' }
    ]

    render(<SkillsForm skills={skills} onChange={mockChange} />)

    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.queryByLabelText('Kategori Keahlian')).not.toBeInTheDocument()

    const inputSkill = screen.getByTestId('input-skill')
    fireEvent.change(inputSkill, { target: { value: 'FastAPI' } })

    const btnAdd = screen.getByTestId('btn-add-skill')
    fireEvent.click(btnAdd)

    expect(mockChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'FastAPI', category: 'General' })
      ])
    )
  })

  it('ResumePreview merender dokumen pratinjau A4 dengan data draft', () => {
    const sampleDraft: ResumeDraft = {
      id: '55555555-5555-4555-8555-555555555555',
      title: 'Draft Uji Pratinjau',
      templateId: 'ats-clean',
      colorTheme: '#4338ca',
      fontFamily: 'sans',
      resumeLanguage: 'id',
      data: {
        ...createEmptyResumeData(),
        contact: {
          fullName: 'Kartini Pertiwi',
          email: 'kartini@example.com',
          phone: '+62811223344',
          location: 'Jepara, Indonesia',
          linkedin: '',
          website: ''
        },
        summary: 'Pendidik dan aktivis literasi digital.'
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    }

    render(<ResumePreview draft={sampleDraft} />)

    expect(screen.getByTestId('preview-fullname')).toHaveTextContent('Kartini Pertiwi')
    expect(screen.getByText('kartini@example.com')).toBeInTheDocument()
    expect(screen.getByText('Pendidik dan aktivis literasi digital.')).toBeInTheDocument()
  })

  it('ContactForm mengaktifkan toggle foto dan memicu onChange', () => {
    const mockChange = vi.fn()
    const contact = {
      fullName: 'Budi Santoso',
      email: 'budi@example.com',
      phone: '',
      location: '',
      linkedin: '',
      website: '',
      usePhoto: false,
      photoUrl: ''
    }

    render(<ContactForm contact={contact} onChange={mockChange} />)

    const toggle = screen.getByTestId('toggle-use-photo') as HTMLInputElement
    expect(toggle.checked).toBe(false)
    expect(screen.queryByTestId('btn-upload-photo')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(mockChange).toHaveBeenCalledWith(
      expect.objectContaining({ usePhoto: true })
    )
  })

  it('ContactForm menampilkan website legacy dan dapat menambah hingga tiga kolom', () => {
    const mockChange = vi.fn()
    const contact = {
      fullName: 'Budi Santoso',
      email: 'budi@example.com',
      phone: '',
      location: '',
      linkedin: '',
      website: 'legacy.dev'
    }

    const { rerender } = render(<ContactForm contact={contact} onChange={mockChange} />)

    expect(screen.getByTestId('input-website-0')).toHaveValue('legacy.dev')
    expect(screen.queryByTestId('input-website-1')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-add-website'))
    expect(mockChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ websites: ['legacy.dev', ''], website: 'legacy.dev' })
    )

    rerender(
      <ContactForm
        contact={{ ...contact, websites: ['legacy.dev', 'github.com/budi'] }}
        onChange={mockChange}
      />
    )
    fireEvent.click(screen.getByTestId('btn-add-website'))
    expect(mockChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        websites: ['legacy.dev', 'github.com/budi', ''],
        website: 'legacy.dev'
      })
    )

    rerender(
      <ContactForm
        contact={{ ...contact, websites: ['legacy.dev', 'github.com/budi', 'budi.dev'] }}
        onChange={mockChange}
      />
    )
    expect(screen.getByTestId('input-website-2')).toHaveValue('budi.dev')
    expect(screen.queryByTestId('btn-add-website')).not.toBeInTheDocument()
  })

  it('ContactForm menghapus website tambahan dan merapatkan urutan', () => {
    const mockChange = vi.fn()
    const contact = {
      fullName: 'Budi Santoso',
      email: 'budi@example.com',
      phone: '',
      location: '',
      linkedin: '',
      website: 'budi.dev',
      websites: ['budi.dev', 'github.com/budi', 'linkedin.com/in/budi']
    }

    render(<ContactForm contact={contact} onChange={mockChange} />)
    fireEvent.click(screen.getByTestId('btn-remove-website-1'))

    expect(mockChange).toHaveBeenCalledWith(
      expect.objectContaining({
        websites: ['budi.dev', 'linkedin.com/in/budi'],
        website: 'budi.dev'
      })
    )
  })

  it('ContactForm menampilkan pratinjau foto dan dapat menghapusnya', () => {
    const mockChange = vi.fn()
    const contact = {
      fullName: 'Budi Santoso',
      email: 'budi@example.com',
      phone: '',
      location: '',
      linkedin: '',
      website: '',
      usePhoto: true,
      photoUrl: 'data:image/jpeg;base64,samplephotodata'
    }

    render(<ContactForm contact={contact} onChange={mockChange} />)

    expect(screen.getByTestId('photo-preview')).toBeInTheDocument()
    const btnRemove = screen.getByTestId('btn-remove-photo')

    fireEvent.click(btnRemove)
    expect(mockChange).toHaveBeenCalledWith(
      expect.objectContaining({ usePhoto: false, photoUrl: '' })
    )
  })
})
