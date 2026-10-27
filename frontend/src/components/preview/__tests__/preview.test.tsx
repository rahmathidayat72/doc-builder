import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ResumePreview } from '../ResumePreview'
import { type ResumeDraft, createEmptyResumeData } from '../../../types/resume'

const createDraft = (): ResumeDraft => ({
  id: '33333333-3333-4333-8333-333333333333',
  title: 'CV Preview',
  templateId: 'ats-clean',
  colorTheme: '#1e293b',
  fontFamily: 'sans',
  resumeLanguage: 'id',
  data: {
    ...createEmptyResumeData(),
    contact: {
      fullName: 'Siti Rahma',
      email: 'siti@example.com',
      phone: '081234567890',
      location: 'Bandung',
      linkedin: '',
      website: '',
      websites: []
    },
    summary: 'Product designer yang berfokus pada riset pengguna dan desain sistem.'
  },
  createdAt: 1,
  updatedAt: 1,
  version: 1
})

describe('ResumePreview pagination', () => {
  it('menampilkan jumlah halaman dan penanda batas halaman untuk konten panjang', async () => {
    const onPageCountChange = vi.fn()
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight')
    Object.defineProperty(Element.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 3000
    })

    try {
      render(<ResumePreview draft={createDraft()} onPageCountChange={onPageCountChange} />)

      await waitFor(() => {
        expect(screen.getByTestId('page-count')).toHaveTextContent('3 halaman')
      })
      expect(screen.getByTestId('page-break-2')).toBeInTheDocument()
      expect(screen.getByTestId('page-break-3')).toBeInTheDocument()
      expect(onPageCountChange).toHaveBeenCalledWith(3)
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(Element.prototype, 'scrollHeight', scrollHeightDescriptor)
      } else {
        delete (Element.prototype as { scrollHeight?: number }).scrollHeight
      }
    }
  })

  it('tidak menghitung tinggi minimum A4 template full-bleed sebagai halaman kedua', async () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight')
    Object.defineProperty(Element.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 1122
    })

    try {
      render(<ResumePreview draft={{ ...createDraft(), templateId: 'visual-executive' }} />)

      await waitFor(() => {
        expect(screen.getByTestId('page-count')).toHaveTextContent('1 halaman')
      })
      expect(screen.queryByTestId('page-break-2')).not.toBeInTheDocument()
      expect(screen.getByTestId('template-visual-executive')).toBeInTheDocument()
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(Element.prototype, 'scrollHeight', scrollHeightDescriptor)
      } else {
        delete (Element.prototype as { scrollHeight?: number }).scrollHeight
      }
    }
  })
})
