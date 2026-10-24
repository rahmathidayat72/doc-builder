import { type ResumeDraft } from '../types/resume'
import { apiFetch } from './apiClient'

export interface AtsChecklistItem {
  category: string
  item: string
  passed: boolean
  impact: number
  tip: string
}

export interface AtsScoreBreakdown {
  contact: number
  structure: number
  summary: number
  quantified_impact: number
  integrity: number
}

export interface AtsAnalysisResult {
  score: number
  grade: string
  gradeCode: string
  breakdown: AtsScoreBreakdown
  checklist: AtsChecklistItem[]
  recommendations: string[]
  passedChecksCount: number
  totalChecksCount: number
  disclaimer: string
}

export interface JobMatchResult {
  match_score: number
  bm25_score: number
  matched_skills: string[]
  missing_skills: string[]
  matched_count: number
  total_job_skills: number
  advice: string[]
}

const DEFAULT_DISCLAIMER =
  'Skor ATS bersifat heuristik untuk mengevaluasi keterbacaan format mesin dan bukan jaminan penerimaan kerja.'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Evaluasi fallback client-side murni jika backend offline
 */
export function evaluateAtsClientFallback(draft: ResumeDraft): AtsAnalysisResult {
  const { contact, summary, experiences, education, skills } = draft.data
  const checklist: AtsChecklistItem[] = []
  const recommendations: string[] = []
  const breakdown: AtsScoreBreakdown = {
    contact: 0,
    structure: 0,
    summary: 0,
    quantified_impact: 0,
    integrity: 10
  }

  // 1. Kontak
  const hasEmail = Boolean(contact.email && /[\w\.-]+@[\w\.-]+\.\w+/.test(contact.email))
  if (hasEmail) {
    breakdown.contact += 10
    checklist.push({
      category: 'Kontak',
      item: 'Alamat Email Terdeteksi Valid',
      passed: true,
      impact: 10,
      tip: 'Email profesional memudahkan recruiter menghubungi Anda.'
    })
  } else {
    checklist.push({
      category: 'Kontak',
      item: 'Alamat Email Belum Lengkap / Valid',
      passed: false,
      impact: 10,
      tip: 'Tambahkan alamat email profesional di bagian atas CV.'
    })
    recommendations.push('Lengkapi alamat email profesional yang valid.')
  }

  const hasPhone = Boolean(contact.phone && contact.phone.replace(/\D/g, '').length >= 9)
  if (hasPhone) {
    breakdown.contact += 10
    checklist.push({
      category: 'Kontak',
      item: 'Nomor Telepon Terdeteksi',
      passed: true,
      impact: 10,
      tip: 'Nomor kontak siap dihubungi.'
    })
  } else {
    checklist.push({
      category: 'Kontak',
      item: 'Nomor Telepon Belum Lengkap',
      passed: false,
      impact: 10,
      tip: 'Cantumkan nomor telepon/WhatsApp aktif (minimal 9 digit).'
    })
    recommendations.push('Cantumkan nomor telepon aktif dengan format yang jelas.')
  }

  if (contact.location && contact.location.trim()) {
    breakdown.contact += 5
    checklist.push({
      category: 'Kontak',
      item: 'Lokasi Domisili Tercantum',
      passed: true,
      impact: 5,
      tip: 'Lokasi kota membantu filter rekrutmen regional.'
    })
  } else {
    checklist.push({
      category: 'Kontak',
      item: 'Lokasi Domisili Kosong',
      passed: false,
      impact: 5,
      tip: "Tuliskan kota domisili (misal: 'Jakarta, Indonesia')."
    })
    recommendations.push('Sertakan informasi kota dan negara domisili.')
  }

  // 2. Struktur
  if (experiences.length >= 1) {
    breakdown.structure += 10
    checklist.push({
      category: 'Struktur',
      item: 'Bagian Pengalaman Kerja Tersedia',
      passed: true,
      impact: 10,
      tip: `Terdapat ${experiences.length} riwayat pekerjaan terdaftar.`
    })
  } else {
    checklist.push({
      category: 'Struktur',
      item: 'Pengalaman Kerja Belum Ditambahkan',
      passed: false,
      impact: 10,
      tip: 'Sistem ATS memprioritaskan CV yang memiliki riwayat pekerjaan terstruktur.'
    })
    recommendations.push('Tambahkan minimal satu riwayat pengalaman kerja atau proyek.')
  }

  if (education.length >= 1) {
    breakdown.structure += 5
    checklist.push({
      category: 'Struktur',
      item: 'Riwayat Pendidikan Tersedia',
      passed: true,
      impact: 5,
      tip: `Terdapat ${education.length} riwayat institusi pendidikan.`
    })
  } else {
    checklist.push({
      category: 'Struktur',
      item: 'Riwayat Pendidikan Belum Ditambahkan',
      passed: false,
      impact: 5,
      tip: 'Cantumkan nama institusi, jurusan, dan tahun kelulusan.'
    })
    recommendations.push('Tambahkan riwayat pendidikan formal terakhir Anda.')
  }

  if (skills.length >= 3) {
    breakdown.structure += 10
    checklist.push({
      category: 'Struktur',
      item: 'Bagian Keahlian Memadai (>= 3 keahlian)',
      passed: true,
      impact: 10,
      tip: `Terdapat ${skills.length} kata kunci keahlian terdaftar.`
    })
  } else {
    checklist.push({
      category: 'Struktur',
      item: 'Jumlah Keahlian Kurang dari 3',
      passed: false,
      impact: 5,
      tip: 'Disarankan mencantumkan minimal 4-8 keahlian spesifik.'
    })
    recommendations.push('Perbanyak daftar keahlian teknis (minimal 4 keahlian).')
  }

  // 3. Ringkasan
  const words = summary.trim() ? summary.trim().split(/\s+/).length : 0
  if (words >= 30 && words <= 80) {
    breakdown.summary += 20
    checklist.push({
      category: 'Ringkasan',
      item: `Panjang Ringkasan Ideal (${words} kata)`,
      passed: true,
      impact: 20,
      tip: 'Rentang 30-80 kata memberikan impresi cepat dan efisien bagi perekrut.'
    })
  } else if (words > 0) {
    breakdown.summary += 10
    checklist.push({
      category: 'Ringkasan',
      item: `Panjang Ringkasan Kurang Optimal (${words} kata)`,
      passed: false,
      impact: 10,
      tip: 'Panjang ideal adalah 40-70 kata.'
    })
    recommendations.push('Sesuaikan panjang ringkasan profesional Anda hingga 40-70 kata.')
  } else {
    checklist.push({
      category: 'Ringkasan',
      item: 'Ringkasan Profesional Belum Diisi',
      passed: false,
      impact: 20,
      tip: 'Ringkasan profesional memberikan konteks cepat tentang profil karier Anda.'
    })
    recommendations.push('Tuliskan 2-3 kalimat ringkasan profesional di bagian atas CV.')
  }

  // 4. Kuantifikasi Dampak
  let quantifiedCount = 0
  for (const exp of experiences) {
    if (/(\d+[\s%kKmMBb]+|\d+\s*persen|\b\d{2,}\b|\$\d+|rp\s*\d+)/i.test(exp.description)) {
      quantifiedCount++
    }
  }

  if (quantifiedCount >= 2) {
    breakdown.quantified_impact += 20
    checklist.push({
      category: 'Dampak Terukur',
      item: `Pencapaian Berbasis Angka/Metrik (${quantifiedCount} posisi)`,
      passed: true,
      impact: 20,
      tip: 'Deskripsi berbasis bukti terukur sangat disukai recruiter dan ATS.'
    })
  } else if (quantifiedCount === 1) {
    breakdown.quantified_impact += 10
    checklist.push({
      category: 'Dampak Terukur',
      item: 'Pencapaian Terukur Terbatas (hanya 1 posisi)',
      passed: false,
      impact: 10,
      tip: 'Tambahkan metrik angka/persentase pada posisi pekerjaan lainnya.'
    })
    recommendations.push('Sertakan angka, persentase, atau metrik hasil pada butir pengalaman kerja.')
  } else {
    checklist.push({
      category: 'Dampak Terukur',
      item: 'Belum Ada Hasil Terukur Berbasis Angka',
      passed: false,
      impact: 20,
      tip: "Gunakan formula 'Mencapai X diukur dengan Y melakukan Z'."
    })
    recommendations.push('Tuliskan pencapaian dengan angka terukur (misal: persentase, efisiensi).')
  }

  // 5. Integritas
  checklist.push({
    category: 'Integritas',
    item: 'Distribusi Kata Natural & Bebas Keyword Stuffing',
    passed: true,
    impact: 10,
    tip: 'Kepadatan kata kunci seimbang dan profesional.'
  })

  const totalScore = Math.min(
    100,
    Math.max(
      0,
      breakdown.contact +
        breakdown.structure +
        breakdown.summary +
        breakdown.quantified_impact +
        breakdown.integrity
    )
  )

  let grade = 'D (Perlu Perbaikan Mendalam)'
  let gradeCode = 'D'
  if (totalScore >= 85) {
    grade = 'A (Sangat Ramah ATS)'
    gradeCode = 'A'
  } else if (totalScore >= 70) {
    grade = 'B (Baik - Perlu Sedikit Penyempurnaan)'
    gradeCode = 'B'
  } else if (totalScore >= 50) {
    grade = 'C (Cukup - Perlu Penyesuaian Format)'
    gradeCode = 'C'
  }

  return {
    score: totalScore,
    grade,
    gradeCode,
    breakdown,
    checklist,
    recommendations,
    passedChecksCount: checklist.filter(c => c.passed).length,
    totalChecksCount: checklist.length,
    disclaimer: DEFAULT_DISCLAIMER
  }
}

/**
 * Mengambil analisis struktur ATS dari backend FastAPI lokal,
 * dengan fallback otomatis ke perhitungan lokal jika backend tidak terhubung.
 */
export async function analyzeAtsStructure(draft: ResumeDraft): Promise<AtsAnalysisResult> {
  try {
    const sanitizedDraft = {
      ...draft,
      data: {
        ...draft.data,
        contact: {
          ...draft.data.contact,
          photoUrl: undefined
        }
      }
    }

    const response = await apiFetch('/api/ats/analyze-structure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sanitizedDraft)
    })

    if (response.ok) {
      const data: AtsAnalysisResult = await response.json()
      return data
    }
  } catch (err) {
    console.warn('Backend ATS API tidak terhubung, menggunakan evaluasi lokal:', err)
  }

  return evaluateAtsClientFallback(draft)
}

/**
 * Fallback komparasi lowongan murni di browser jika backend offline
 */
export function matchResumeToJobClientFallback(draft: ResumeDraft, jobText: string): JobMatchResult {
  const normJob = jobText.toLowerCase()
  const cvSkills = new Set<string>()

  for (const s of draft.data.skills) {
    if (s.name.trim()) cvSkills.add(s.name.trim().toLowerCase())
  }

  const fullCvText = (
    draft.data.summary + ' ' +
    draft.data.experiences.map(e => e.description + ' ' + e.jobTitle).join(' ')
  ).toLowerCase()

  const commonTaxonomy = [
    'python', 'fastapi', 'django', 'typescript', 'javascript', 'react', 'next.js',
    'vue', 'angular', 'tailwind css', 'html', 'css', 'docker', 'kubernetes', 'git',
    'sql', 'postgresql', 'mysql', 'redis', 'rest api', 'graphql', 'figma', 'power bi',
    'tableau', 'pandas', 'linux', 'aws', 'gcp', 'pytest', 'vitest', 'playwright', 'excel'
  ]

  const detectedJobSkills = new Set<string>()
  for (const item of commonTaxonomy) {
    if (normJob.includes(item)) {
      detectedJobSkills.add(item)
    }
  }

  for (const cs of cvSkills) {
    if (normJob.includes(cs)) {
      detectedJobSkills.add(cs)
    }
  }

  const matched = new Set<string>()
  const missing = new Set<string>()

  for (const js of detectedJobSkills) {
    if (cvSkills.has(js) || fullCvText.includes(js)) {
      matched.add(js)
    } else {
      missing.add(js)
    }
  }

  const matchScore = detectedJobSkills.size > 0
    ? Math.round((matched.size / detectedJobSkills.size) * 100)
    : 100

  const advice: string[] = []
  if (missing.size > 0) {
    const sample = Array.from(missing).slice(0, 3).join(', ')
    advice.push(`Lowongan meminta: ${sample}. Cantumkan di CV jika Anda memiliki pengalaman terkait.`)
  }

  if (matchScore >= 80) {
    advice.push('Tingkat kecocokan sangat tinggi! Profil Anda relevan dengan kualifikasi lowongan.')
  } else if (matchScore >= 50) {
    advice.push('Kecocokan moderat. Anda dapat menyelaraskan kata kunci keahlian dengan deskripsi pekerjaan.')
  } else {
    advice.push('Kecocokan rendah. Pastikan Anda menyertakan keahlian inti yang dicari perusahaan.')
  }

  return {
    match_score: matchScore,
    bm25_score: Math.min(100, Math.round(matchScore * 0.9)),
    matched_skills: Array.from(matched).sort(),
    missing_skills: Array.from(missing).sort(),
    matched_count: matched.size,
    total_job_skills: detectedJobSkills.size,
    advice
  }
}

/**
 * Memanggil API backend /api/ats/match-job untuk komparasi lowongan
 * dengan fallback client-side otomatis jika backend tidak terhubung.
 */
export async function matchResumeToJob(draft: ResumeDraft, jobText: string): Promise<JobMatchResult> {
  try {
    const response = await apiFetch('/api/ats/match-job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        resume: draft,
        job_text: jobText
      })
    })

    if (response.ok) {
      const data: JobMatchResult = await response.json()
      return data
    }
  } catch (err) {
    console.warn('Backend match-job API tidak terhubung, menggunakan evaluasi lokal:', err)
  }

  return matchResumeToJobClientFallback(draft, jobText)
}

/**
 * Mengekspor laporan evaluasi ATS ke berkas Microsoft Word (.docx)
 */
export async function exportAtsReportDocx(analysis: AtsAnalysisResult, resumeTitle: string): Promise<void> {
  const filename = `Laporan_ATS_${resumeTitle.replace(/\s+/g, '_') || 'Resume'}.docx`

  const response = await apiFetch('/api/ats/export-report-docx', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      analysis,
      resume_title: resumeTitle
    })
  })

  if (!response.ok) {
    throw new Error(`Gagal mengunduh laporan DOCX (${response.status})`)
  }

  const blob = await response.blob()
  downloadBlob(blob, filename)
}

/**
 * Mengekspor laporan evaluasi ATS ke berkas PDF melalui LibreOffice headless
 * atau fallback ke cetak jendela browser jika LibreOffice tidak tersedia.
 */
export async function exportAtsReportPdf(
  analysis: AtsAnalysisResult,
  resumeTitle: string
): Promise<{ fallbackToPrint: boolean; message?: string }> {
  const filename = `Laporan_ATS_${resumeTitle.replace(/\s+/g, '_') || 'Resume'}.pdf`

  try {
    const response = await apiFetch('/api/ats/export-report-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        analysis,
        resume_title: resumeTitle
      })
    })

    if (response.ok) {
      const blob = await response.blob()
      downloadBlob(blob, filename)
      return { fallbackToPrint: false }
    }

    if (response.status === 422) {
      window.print()
      return {
        fallbackToPrint: true,
        message: 'LibreOffice tidak ditemukan. Menggunakan cetak browser.'
      }
    }

    throw new Error(`Gagal respon server: ${response.status}`)
  } catch {
    window.print()
    return {
      fallbackToPrint: true,
      message: 'Server backend tidak terhubung. Menggunakan pencetakan PDF browser langsung.'
    }
  }
}
