import { type ResumeLanguage } from '../types/resume'

export interface ResumeLabels {
  fullNameFallback: string
  summary: string
  summaryProfile: string
  summaryAbout: string
  experience: string
  experienceShort: string
  education: string
  skills: string
  skillsTechnical: string
  skillsShort: string
  languages: string
  languagesShort: string
  contact: string
  present: string
  inField: string
  gpa: string
  customDefault: string
}

const ID_LABELS: ResumeLabels = {
  fullNameFallback: 'Nama Lengkap',
  summary: 'Ringkasan Profesional',
  summaryProfile: 'Profil Profesional',
  summaryAbout: 'Tentang Saya',
  experience: 'Pengalaman Kerja',
  experienceShort: 'Pengalaman',
  education: 'Pendidikan',
  skills: 'Keahlian & Kompetensi',
  skillsTechnical: 'Keahlian Teknis',
  skillsShort: 'Keahlian',
  languages: 'Kemampuan Bahasa',
  languagesShort: 'Bahasa',
  contact: 'Kontak',
  present: 'Sekarang',
  inField: 'dalam',
  gpa: 'IPK',
  customDefault: 'Bagian Tambahan',
}

const EN_LABELS: ResumeLabels = {
  fullNameFallback: 'Full Name',
  summary: 'Professional Summary',
  summaryProfile: 'Professional Profile',
  summaryAbout: 'About Me',
  experience: 'Work Experience',
  experienceShort: 'Experience',
  education: 'Education',
  skills: 'Skills & Competencies',
  skillsTechnical: 'Technical Skills',
  skillsShort: 'Skills',
  languages: 'Language Proficiency',
  languagesShort: 'Languages',
  contact: 'Contact',
  present: 'Present',
  inField: 'in',
  gpa: 'GPA',
  customDefault: 'Additional Section',
}

export function getResumeLabels(language?: ResumeLanguage): ResumeLabels {
  return language === 'en' ? EN_LABELS : ID_LABELS
}
