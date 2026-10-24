import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AtsScorePanel } from '../AtsScorePanel'
import { evaluateAtsClientFallback } from '../../../services/ats'
import { type ResumeDraft, createEmptyResumeData } from '../../../types/resume'

describe('AtsReport Export Functionality Suite', () => {
  const sampleDraft: ResumeDraft = {
    id: '99999999-9999-4999-8999-999999999999',
    title: 'Resume Software Lead',
    templateId: 'ats-clean',
    colorTheme: '#1e293b',
    fontFamily: 'sans',
    resumeLanguage: 'id',
    data: createEmptyResumeData(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1
  }

  it('AtsScorePanel merender tombol ekspor laporan PDF dan laporan Word', () => {
    const analysis = evaluateAtsClientFallback(sampleDraft)
    render(
      <AtsScorePanel
        analysis={analysis}
        resumeTitle="Resume Software Lead"
        isOpen={true}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByTestId('btn-export-report-pdf')).toBeInTheDocument()
    expect(screen.getByTestId('btn-export-report-docx')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Laporan PDF/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Laporan Word/i })).toBeInTheDocument()
  })
})
