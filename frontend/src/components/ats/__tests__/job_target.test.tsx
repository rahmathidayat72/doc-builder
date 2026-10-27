import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { JobMatchModal } from '../JobMatchModal'
import { matchResumeToJob } from '../../../services/ats'
import { createEmptyResumeData, type ResumeDraft } from '../../../types/resume'

vi.mock('../../../services/ats', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../services/ats')>()
  return {
    ...actual,
    matchResumeToJob: vi.fn()
  }
})

const sampleDraft: ResumeDraft = {
  id: '88888888-8888-4888-8888-888888888888',
  title: 'CV Backend',
  templateId: 'ats-clean',
  colorTheme: '#1e293b',
  fontFamily: 'sans',
  resumeLanguage: 'id',
  data: {
    ...createEmptyResumeData(),
    contact: {
      fullName: 'Hadi Gunawan',
      email: 'hadi@example.com',
      phone: '08123456789',
      location: 'Jakarta',
      linkedin: '',
      website: ''
    },
    skills: [
      { id: 'skill-1', name: 'Python', category: 'Technical' },
      { id: 'skill-2', name: 'FastAPI', category: 'Technical' }
    ]
  },
  createdAt: 1,
  updatedAt: 1,
  version: 1
}

describe('Pembuatan CV target dari job matching', () => {
  it('membuat draft target dengan posisi, perusahaan, dan keahlian yang cocok', async () => {
    vi.mocked(matchResumeToJob).mockResolvedValue({
      match_score: 85,
      bm25_score: 3.2,
      matched_skills: ['python', 'fastapi'],
      missing_skills: ['docker'],
      matched_count: 2,
      total_job_skills: 3,
      advice: ['Tambahkan Docker bila relevan.']
    })

    const onCreateTargetedDraft = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <JobMatchModal
        draft={sampleDraft}
        isOpen={true}
        onClose={onClose}
        onCreateTargetedDraft={onCreateTargetedDraft}
      />
    )

    fireEvent.click(screen.getByText(/\+ Masukkan Contoh Lowongan/i))
    fireEvent.click(screen.getByTestId('btn-run-match'))

    await waitFor(() => expect(screen.getByTestId('target-draft-panel')).toBeInTheDocument())
    const titleInput = screen.getByTestId('input-target-title') as HTMLInputElement
    expect(titleInput.value).toBe('Senior Backend Engineer')

    fireEvent.change(titleInput, { target: { value: 'Staff Backend Engineer' } })
    fireEvent.change(screen.getByTestId('input-target-company'), {
      target: { value: 'PT Maju Digital' }
    })
    fireEvent.click(screen.getByTestId('btn-create-targeted-draft'))

    await waitFor(() => {
      expect(onCreateTargetedDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Staff Backend Engineer',
          company: 'PT Maju Digital',
          matchedSkills: ['python', 'fastapi']
        })
      )
    })
    expect(onCreateTargetedDraft.mock.calls[0][0].description).toContain(
      'Senior Backend Engineer'
    )
    expect(onClose).toHaveBeenCalled()
  })
})
