import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CustomSectionsForm } from '../CustomSectionsForm'
import { type CustomSection } from '../../../types/resume'

const sections: CustomSection[] = [
  {
    id: 'section-1',
    sectionTitle: 'Sertifikasi',
    items: [
      {
        id: 'item-1',
        title: 'AWS Certified Developer',
        subtitle: 'Amazon Web Services',
        date: '2025',
        description: 'Validasi kompetensi cloud.'
      }
    ]
  }
]

describe('CustomSectionsForm', () => {
  it('menambah bagian dan item dengan struktur kosong yang dapat diedit', () => {
    const onChange = vi.fn()
    const { rerender } = render(<CustomSectionsForm sections={[]} onChange={onChange} />)

    fireEvent.click(screen.getByTestId('btn-add-custom-section'))
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        sectionTitle: '',
        items: [expect.objectContaining({ title: '', description: '' })]
      })
    ])

    rerender(<CustomSectionsForm sections={sections} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('btn-add-custom-item-0'))
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        sectionTitle: 'Sertifikasi',
        items: expect.arrayContaining([
          expect.objectContaining({ title: 'AWS Certified Developer' }),
          expect.objectContaining({ title: '', description: '' })
        ])
      })
    ])
  })

  it('mengubah judul dan menghapus item atau bagian', () => {
    const onChange = vi.fn()
    render(<CustomSectionsForm sections={sections} onChange={onChange} />)

    fireEvent.change(screen.getByTestId('input-custom-section-title-0'), {
      target: { value: 'Lisensi dan Sertifikasi' }
    })
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ sectionTitle: 'Lisensi dan Sertifikasi' })
    ])

    fireEvent.click(screen.getByTestId('btn-delete-custom-item-0-0'))
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ sectionTitle: 'Sertifikasi', items: [] })
    ])

    fireEvent.click(screen.getByTestId('btn-delete-custom-section-0'))
    expect(onChange).toHaveBeenLastCalledWith([])
  })
})
