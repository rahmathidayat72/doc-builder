import {
  type ResumeDraft,
  getExperienceDescriptionText,
  getFilledWebsites
} from '../types/resume'
import { type ResumeSectionId, RESUME_SECTION_LABELS } from '../types/resumeSections'

export const DEFAULT_MAX_RECOMMENDED_PAGES = 2

export type ResumeQualitySeverity = 'error' | 'warning'

export interface ResumeQualityIssue {
  id: string
  severity: ResumeQualitySeverity
  section: ResumeSectionId
  title: string
  message: string
}

export interface ResumeQualityReport {
  score: number
  pageCount: number
  errors: ResumeQualityIssue[]
  warnings: ResumeQualityIssue[]
  checkedAt: number
}

interface AnalyzeResumeQualityOptions {
  pageCount?: number
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MEASURABLE_PATTERN = /(\d|%|rp|idr|usd|\$|€|£)/i
const YEAR_PATTERN = /(19|20)\d{2}/

const isBlank = (value?: string | null) => !value || !value.trim()

const hasContent = (draft: ResumeDraft) => {
  const { contact, summary, experiences, education, skills, languages, customSections } = draft.data
  return Boolean(
    !isBlank(contact.fullName) ||
      !isBlank(contact.email) ||
      !isBlank(summary) ||
      experiences.length > 0 ||
      education.length > 0 ||
      skills.length > 0 ||
      languages.length > 0 ||
      customSections.length > 0
  )
}

const parseStartYear = (value: string): number | null => {
  const match = value.match(YEAR_PATTERN)
  return match ? Number(match[0]) : null
}

/**
 * Pemeriksaan kualitas lokal sebelum ekspor. Fungsi ini sengaja tidak memakai
 * backend agar dapat dipakai saat offline dan hasilnya deterministik untuk test.
 */
export function analyzeResumeQuality(
  draft: ResumeDraft | null,
  options: AnalyzeResumeQualityOptions = {}
): ResumeQualityReport {
  const errors: ResumeQualityIssue[] = []
  const warnings: ResumeQualityIssue[] = []
  const pageCount = Math.max(1, Math.min(99, Math.round(options.pageCount ?? 1)))

  if (!draft || !hasContent(draft)) {
    return {
      score: 0,
      pageCount,
      errors: [
        {
          id: 'draft-empty',
          severity: 'error',
          section: 'contact',
          title: 'CV masih kosong',
          message: 'Isi minimal nama lengkap dan salah satu bagian CV sebelum mengunduh.'
        }
      ],
      warnings,
      checkedAt: Date.now()
    }
  }

  const { contact, summary, experiences, education, skills, languages, customSections } = draft.data

  const add = (
    severity: ResumeQualitySeverity,
    section: ResumeSectionId,
    id: string,
    title: string,
    message: string
  ) => {
    const issue: ResumeQualityIssue = { id, severity, section, title, message }
    if (severity === 'error') errors.push(issue)
    else warnings.push(issue)
  }

  if (isBlank(contact.fullName)) {
    add(
      'error',
      'contact',
      'required-full-name',
      'Nama lengkap belum diisi',
      'Nama lengkap wajib ada agar rekruter mengenali pemilik CV.'
    )
  } else if (contact.fullName.trim().split(/\s+/).length < 2) {
    add(
      'warning',
      'contact',
      'short-full-name',
      'Nama terlihat terlalu singkat',
      'Gunakan nama lengkap agar CV lebih mudah diverifikasi.'
    )
  }

  if (contact.headline && contact.headline.trim().length > 100) {
    add(
      'warning',
      'contact',
      'headline-too-long',
      'Headline profesional terlalu panjang',
      'Ringkas headline menjadi maksimal sekitar 100 karakter agar mudah dipindai.'
    )
  }

  if (isBlank(contact.email)) {
    add(
      'warning',
      'contact',
      'missing-email',
      'Email belum diisi',
      'Email profesional membantu rekruter menghubungi Anda.'
    )
  } else if (!EMAIL_PATTERN.test(contact.email.trim())) {
    add(
      'error',
      'contact',
      'invalid-email',
      'Format email tidak valid',
      'Periksa kembali alamat email sebelum mengunduh CV.'
    )
  }

  if (isBlank(contact.phone)) {
    add(
      'warning',
      'contact',
      'missing-phone',
      'Nomor telepon belum diisi',
      'Cantumkan nomor telepon atau WhatsApp yang aktif.'
    )
  } else if (contact.phone.replace(/\D/g, '').length < 9) {
    add(
      'warning',
      'contact',
      'short-phone',
      'Nomor telepon terlalu pendek',
      'Pastikan nomor telepon dapat dihubungi dan memiliki kode wilayah.'
    )
  }

  if (isBlank(contact.location)) {
    add(
      'warning',
      'contact',
      'missing-location',
      'Lokasi belum diisi',
      'Lokasi membantu rekruter menilai kesesuaian kerja onsite atau hybrid.'
    )
  }

  for (const [index, website] of getFilledWebsites(contact.website, contact.websites).entries()) {
    if (!website.includes('.') || /\s/.test(website)) {
      add(
        'warning',
        'contact',
        `invalid-website-${index}`,
        'Alamat website perlu diperiksa',
        `“${website}” tidak terlihat seperti alamat website yang valid.`
      )
    }
  }

  if (isBlank(summary)) {
    add(
      'warning',
      'summary',
      'missing-summary',
      'Ringkasan profesional belum diisi',
      'Ringkasan 2–4 kalimat membantu rekruter memahami posisi dan nilai Anda.'
    )
  } else {
    const wordCount = summary.trim().split(/\s+/).length
    if (wordCount < 20) {
      add(
        'warning',
        'summary',
        'summary-too-short',
        'Ringkasan terlalu singkat',
        `Ringkasan berisi ${wordCount} kata. Pertimbangkan 30–80 kata untuk konteks yang cukup.`
      )
    } else if (wordCount > 120) {
      add(
        'warning',
        'summary',
        'summary-too-long',
        'Ringkasan terlalu panjang',
        `Ringkasan berisi ${wordCount} kata. Ringkas menjadi maksimal sekitar 120 kata.`
      )
    }
  }

  if (experiences.length === 0) {
    add(
      'warning',
      'experience',
      'missing-experience',
      'Belum ada pengalaman kerja',
      'Jika Anda fresh graduate, pastikan pendidikan, proyek, atau organisasi mengisi bagian ini.'
    )
  }

  const measurableExperience = experiences.some(exp =>
    MEASURABLE_PATTERN.test(getExperienceDescriptionText(exp))
  )

  experiences.forEach((exp, index) => {
    const label = exp.jobTitle || exp.company || `Pengalaman #${index + 1}`
    if (isBlank(exp.jobTitle) && isBlank(exp.company)) {
      add(
        'error',
        'experience',
        `empty-experience-${exp.id}`,
        `Pengalaman #${index + 1} kosong`,
        'Lengkapi jabatan dan perusahaan, atau hapus entri kosong tersebut.'
      )
    } else {
      if (isBlank(exp.jobTitle)) {
        add(
          'warning',
          'experience',
          `missing-job-title-${exp.id}`,
          'Jabatan belum diisi',
          `Lengkapi jabatan untuk ${label}.`
        )
      }
      if (isBlank(exp.company)) {
        add(
          'warning',
          'experience',
          `missing-company-${exp.id}`,
          'Nama perusahaan belum diisi',
          `Lengkapi nama perusahaan untuk ${label}.`
        )
      }
    }

    if (!exp.current && !isBlank(exp.startDate) && !isBlank(exp.endDate)) {
      const startYear = parseStartYear(exp.startDate)
      const endYear = parseStartYear(exp.endDate)
      if (startYear !== null && endYear !== null && endYear < startYear) {
        add(
          'warning',
          'experience',
          `invalid-experience-date-${exp.id}`,
          'Periode pengalaman tidak konsisten',
          `Tanggal selesai ${label} lebih awal daripada tanggal mulai.`
        )
      }
    }

    if (!exp.current && !isBlank(exp.startDate) && isBlank(exp.endDate)) {
      add(
        'warning',
        'experience',
        `missing-experience-end-${exp.id}`,
        'Tanggal selesai belum diisi',
        `Lengkapi tanggal selesai ${label} atau centang “masih bekerja di posisi ini”.`
      )
    }

    if (isBlank(getExperienceDescriptionText(exp))) {
      add(
        'warning',
        'experience',
        `missing-experience-description-${exp.id}`,
        'Pencapaian pengalaman belum diisi',
        `Tambahkan tanggung jawab atau pencapaian terukur untuk ${label}.`
      )
    }
  })

  if (experiences.length > 0 && !measurableExperience) {
    add(
      'warning',
      'experience',
      'missing-measurable-impact',
      'Belum ada pencapaian terukur',
      'Tambahkan angka, persentase, atau dampak bisnis pada minimal satu pengalaman.'
    )
  }

  if (education.length === 0) {
    add(
      'warning',
      'education',
      'missing-education',
      'Pendidikan belum diisi',
      'Cantumkan pendidikan terakhir atau bagian lain yang relevan.'
    )
  }

  education.forEach((edu, index) => {
    if (isBlank(edu.institution)) {
      add(
        'warning',
        'education',
        `missing-institution-${edu.id}`,
        'Institusi pendidikan belum diisi',
        `Lengkapi nama institusi pendidikan #${index + 1}.`
      )
    }

    const startYear = parseStartYear(edu.startDate)
    const endYear = parseStartYear(edu.endDate)
    if (startYear !== null && endYear !== null && endYear < startYear) {
      add(
        'warning',
        'education',
        `invalid-education-date-${edu.id}`,
        'Periode pendidikan tidak konsisten',
        `Tahun selesai pendidikan #${index + 1} lebih awal daripada tahun mulai.`
      )
    }
  })

  if (skills.length < 3) {
    add(
      'warning',
      'skills',
      'few-skills',
      'Keahlian masih sedikit',
      'Tambahkan minimal tiga keahlian yang paling relevan dengan target posisi.'
    )
  }

  const skillNames = new Set<string>()
  for (const skill of skills) {
    const key = skill.name.trim().toLowerCase()
    if (!key) continue
    if (skillNames.has(key)) {
      add(
        'warning',
        'skills',
        `duplicate-skill-${skill.id}`,
        'Keahlian duplikat',
        `“${skill.name}” muncul lebih dari sekali.`
      )
    }
    skillNames.add(key)
  }

  if (languages.length === 0) {
    add(
      'warning',
      'languages',
      'missing-languages',
      'Kemampuan bahasa belum diisi',
      'Cantumkan bahasa yang dikuasai jika relevan untuk posisi target.'
    )
  }

  customSections.forEach((section, sectionIndex) => {
    const hasVisibleItem = section.items.some(item =>
      Boolean(item.title.trim() || item.subtitle.trim() || item.date.trim() || item.description.trim())
    )
    if (isBlank(section.sectionTitle) && !hasVisibleItem) {
      add(
        'warning',
        'custom',
        `empty-custom-section-${section.id}`,
        'Bagian tambahan kosong',
        `Bagian tambahan #${sectionIndex + 1} belum memiliki judul atau isi.`
      )
    } else if (isBlank(section.sectionTitle)) {
      add(
        'warning',
        'custom',
        `untitled-custom-section-${section.id}`,
        'Judul bagian tambahan belum diisi',
        `Beri nama bagian tambahan #${sectionIndex + 1} agar mudah dipahami.`
      )
    }
  })

  if (draft.templateId.startsWith('ats-') && contact.usePhoto && contact.photoUrl) {
    add(
      'warning',
      'contact',
      'ats-photo',
      'Foto profil pada template ATS',
      'Banyak sistem ATS tidak membaca foto. Pertimbangkan mematikan foto untuk template ATS.'
    )
  }

  if (pageCount > DEFAULT_MAX_RECOMMENDED_PAGES) {
    add(
      'warning',
      'experience',
      'too-many-pages',
      `CV diperkirakan ${pageCount} halaman`,
      'CV yang lebih ringkas biasanya lebih mudah dipindai. Pertimbangkan memangkas isi yang tidak relevan.'
    )
  }

  const penalty = errors.length * 15 + warnings.length * 4
  const score = Math.max(0, Math.min(100, 100 - penalty))

  return {
    score,
    pageCount,
    errors,
    warnings,
    checkedAt: Date.now()
  }
}

export function getQualitySectionLabel(section: ResumeSectionId): string {
  return RESUME_SECTION_LABELS[section]
}
