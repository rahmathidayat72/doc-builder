export const RESUME_SECTION_IDS = [
  'contact',
  'summary',
  'experience',
  'education',
  'skills',
  'languages',
  'custom'
] as const

export type ResumeSectionId = (typeof RESUME_SECTION_IDS)[number]

/** Bagian isi CV yang dapat diurutkan. Bagian kontak selalu berada di header. */
export const RESUME_BODY_SECTION_IDS = [
  'summary',
  'experience',
  'education',
  'skills',
  'languages',
  'custom'
] as const

export type ResumeBodySectionId = (typeof RESUME_BODY_SECTION_IDS)[number]

export const DEFAULT_BODY_SECTION_ORDER: ResumeBodySectionId[] = [
  ...RESUME_BODY_SECTION_IDS
]

export const RESUME_SECTION_LABELS: Record<ResumeSectionId, string> = {
  contact: 'Kontak',
  summary: 'Ringkasan',
  experience: 'Pengalaman',
  education: 'Pendidikan',
  skills: 'Keahlian',
  languages: 'Bahasa',
  custom: 'Bagian Lain'
}

const isBodySectionId = (value: string): value is ResumeBodySectionId =>
  (RESUME_BODY_SECTION_IDS as readonly string[]).includes(value)

/**
 * Menormalkan urutan bagian dari draft lama atau data impor. Nilai yang tidak
 * dikenal dibuang dan bagian yang belum tercantum ditambahkan di akhir agar
 * tidak ada konten yang hilang.
 */
export function getResumeSectionOrder(order?: string[]): ResumeBodySectionId[] {
  const normalized: ResumeBodySectionId[] = []
  for (const value of order ?? []) {
    if (isBodySectionId(value) && !normalized.includes(value)) {
      normalized.push(value)
    }
  }
  for (const value of RESUME_BODY_SECTION_IDS) {
    if (!normalized.includes(value)) {
      normalized.push(value)
    }
  }
  return normalized
}
