import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ContactForm } from '../ContactForm'
import { EducationForm } from '../EducationForm'
import { ExperienceForm } from '../ExperienceForm'
import { SectionOrderForm } from '../SectionOrderForm'
import { type Education, type WorkExperience } from '../../../types/resume'
import { DEFAULT_BODY_SECTION_ORDER } from '../../../types/resumeSections'

const contact = {
  fullName: 'Budi Santoso',
  headline: '',
  email: 'budi@example.com',
  phone: '08123456789',
  location: 'Jakarta',
  linkedin: '',
  website: '',
  websites: []
}

const makeExperience = (id: string, jobTitle: string): WorkExperience => ({
  id,
  jobTitle,
  company: 'PT Contoh',
  location: 'Jakarta',
  startDate: 'Jan 2022',
  endDate: 'Sekarang',
  current: true,
  description: '',
  achievements: ['']
})

const makeEducation = (id: string, institution: string): Education => ({
  id,
  institution,
  degree: 'S1',
  fieldOfStudy: 'Informatika',
  startDate: '2016',
  endDate: '2020',
  gpa: '3.8',
  description: ''
})

describe('Peningkatan editor CV', () => {
  it('ContactForm menyimpan headline profesional opsional', () => {
    const onChange = vi.fn()
    render(<ContactForm contact={contact} onChange={onChange} />)

    fireEvent.change(screen.getByTestId('input-headline'), {
      target: { value: 'Senior Backend Engineer' }
    })

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ headline: 'Senior Backend Engineer' })
    )
  })

  it('ExperienceForm menampilkan butir kosong agar pencapaian baru dapat diketik', () => {
    const onChange = vi.fn()
    const exp = makeExperience('exp-1', 'Backend Engineer')
    render(<ExperienceForm experiences={[exp]} onChange={onChange} />)

    const bullet = screen.getByTestId('input-exp-achievement-0-0') as HTMLTextAreaElement
    expect(bullet.value).toBe('')

    fireEvent.change(bullet, {
      target: { value: 'Meningkatkan performa API 35%' }
    })

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'exp-1',
        achievements: ['Meningkatkan performa API 35%'],
        description: ''
      })
    ])
  })

  it('ExperienceForm dapat menambah dan mengurutkan ulang butir pencapaian', () => {
    const onChange = vi.fn()
    const exp = makeExperience('exp-1', 'Backend Engineer')
    exp.achievements = ['Butir pertama', 'Butir kedua']
    const { rerender } = render(<ExperienceForm experiences={[exp]} onChange={onChange} />)

    fireEvent.click(screen.getByText('Butir'))
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        achievements: ['Butir pertama', 'Butir kedua', '']
      })
    ])

    const withNewBullet = {
      ...exp,
      achievements: ['Butir pertama', 'Butir kedua', '']
    }
    rerender(<ExperienceForm experiences={[withNewBullet]} onChange={onChange} />)

    const downButtons = screen.getAllByLabelText('Turunkan butir pencapaian')
    fireEvent.click(downButtons[0])
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        achievements: ['Butir kedua', 'Butir pertama', '']
      })
    ])
  })

  it('ExperienceForm mengurutkan pengalaman dan menandai tanggal tidak valid', () => {
    const onChange = vi.fn()
    const first = makeExperience('exp-1', 'Backend Engineer')
    const second = makeExperience('exp-2', 'Senior Engineer')
    second.startDate = 'Jan 2024'
    second.endDate = 'Des 2023'
    second.current = false

    render(<ExperienceForm experiences={[first, second]} onChange={onChange} />)

    fireEvent.click(screen.getByTestId('btn-move-experience-up-1'))
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 'exp-2' }),
      expect.objectContaining({ id: 'exp-1' })
    ])

    expect(
      screen.getByText(/Tanggal selesai tidak boleh lebih awal/i)
    ).toBeInTheDocument()
  })

  it('EducationForm menyimpan deskripsi dan dapat mengurutkan institusi', () => {
    const onChange = vi.fn()
    const first = makeEducation('edu-1', 'Universitas Pertama')
    const second = makeEducation('edu-2', 'Universitas Kedua')

    render(<EducationForm education={[first, second]} onChange={onChange} />)

    fireEvent.change(screen.getByTestId('input-edu-description-0'), {
      target: { value: 'Fokus pada rekayasa perangkat lunak dan riset.' }
    })
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        id: 'edu-1',
        description: 'Fokus pada rekayasa perangkat lunak dan riset.'
      }),
      expect.objectContaining({ id: 'edu-2' })
    ])

    fireEvent.click(screen.getByTestId('btn-move-education-up-1'))
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 'edu-2' }),
      expect.objectContaining({ id: 'edu-1' })
    ])
  })

  it('SectionOrderForm menggeser urutan bagian dan menyediakan reset', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <SectionOrderForm order={[...DEFAULT_BODY_SECTION_ORDER]} onChange={onChange} />
    )

    fireEvent.click(screen.getByTestId('btn-section-order-down-summary'))
    expect(onChange).toHaveBeenCalledWith([
      'experience',
      'summary',
      'education',
      'skills',
      'languages',
      'custom'
    ])

    rerender(
      <SectionOrderForm
        order={['experience', 'summary', 'education', 'skills', 'languages', 'custom']}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByTestId('btn-reset-section-order'))
    expect(onChange).toHaveBeenLastCalledWith([...DEFAULT_BODY_SECTION_ORDER])
  })
})
