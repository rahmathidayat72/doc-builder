import { z } from 'zod'
import { DEFAULT_BODY_SECTION_ORDER } from './resumeSections'

export const MAX_WEBSITES = 3

export const ContactInfoSchema = z.object({
  fullName: z.string().default(''),
  headline: z.string().optional(),
  email: z.string().email('Format email tidak valid').or(z.literal('')),
  phone: z.string().default(''),
  location: z.string().default(''),
  linkedin: z.string().default(''),
  website: z.string().default(''),
  websites: z.array(z.string()).optional(),
  usePhoto: z.boolean().optional(),
  photoUrl: z.string().optional()
})

/**
 * Mengambil daftar website dari model baru, dengan fallback ke field legacy
 * `website` agar draft lama tetap tampil. Nilai kosong tetap dipertahankan
 * untuk kebutuhan input; pemakaian render/export harus memakai
 * `getFilledWebsites`.
 */
export const getWebsites = (website: string, websites?: string[]): string[] => {
  const hasWebsiteValue = websites?.some(item => item.trim())
  const source =
    websites && websites.length > 0 && hasWebsiteValue ? websites : website ? [website] : []
  return source.slice(0, MAX_WEBSITES)
}

/** Daftar website yang benar-benar terisi dan aman untuk render/export. */
export const getFilledWebsites = (website: string, websites?: string[]): string[] =>
  getWebsites(website, websites)
    .map(item => item.trim())
    .filter(Boolean)

export const WorkExperienceSchema = z.object({
  id: z.string(),
  jobTitle: z.string().default(''),
  company: z.string().default(''),
  location: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  current: z.boolean().default(false),
  description: z.string().default(''),
  /**
   * Pencapaian terstruktur per butir. `description` tetap dipertahankan untuk
   * draft lama dan impor bebas; bila `achievements` ada, nilai inilah yang
   * dirender.
   */
  achievements: z.array(z.string()).optional()
})

/**
 * Mengambil butir pencapaian tanpa bullet. Draft lama yang hanya memiliki
 * `description` dipecah per baris agar dapat diedit sebagai butir terstruktur.
 */
export const getExperienceAchievements = (exp: WorkExperience): string[] => {
  if (exp.achievements !== undefined) {
    return exp.achievements.map(item => item.trim()).filter(Boolean)
  }
  return exp.description
    .split(/\r?\n/)
    .map(line => line.replace(/^[\s•\-*]+/, '').trim())
    .filter(Boolean)
}

/**
 * Nilai mentah untuk editor. Berbeda dari `getExperienceAchievements`,
 * fungsi ini mempertahankan butir kosong agar pengguna dapat menambah baris
 * baru sebelum mengetik.
 */
export const getEditableExperienceAchievements = (exp: WorkExperience): string[] => {
  if (exp.achievements !== undefined) return exp.achievements
  return exp.description
    .split(/\r?\n/)
    .map(line => line.replace(/^[\s•\-*]+/, '').trim())
    .filter(Boolean)
}

/** Teks deskripsi pengalaman yang siap dirender oleh template dan ekspor. */
export const getExperienceDescriptionText = (exp: WorkExperience): string => {
  if (exp.achievements === undefined) return exp.description
  return exp.achievements
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => (item.startsWith('•') ? item : `• ${item}`))
    .join('\n')
}

export const EducationSchema = z.object({
  id: z.string(),
  institution: z.string().default(''),
  degree: z.string().default(''),
  fieldOfStudy: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  gpa: z.string().default(''),
  description: z.string().default('')
})

export const SkillItemSchema = z.object({
  id: z.string(),
  name: z.string().default(''),
  category: z.string().default('General')
})

export const LanguageItemSchema = z.object({
  id: z.string(),
  language: z.string().default(''),
  proficiency: z.string().default('Professional')
})

export const CustomSectionItemSchema = z.object({
  id: z.string(),
  title: z.string().default(''),
  subtitle: z.string().default(''),
  date: z.string().default(''),
  description: z.string().default('')
})

export const CustomSectionSchema = z.object({
  id: z.string(),
  sectionTitle: z.string().default(''),
  items: z.array(CustomSectionItemSchema).default([])
})

export const ResumeDataSchema = z.object({
  contact: ContactInfoSchema,
  summary: z.string().default(''),
  experiences: z.array(WorkExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  skills: z.array(SkillItemSchema).default([]),
  languages: z.array(LanguageItemSchema).default([]),
  customSections: z.array(CustomSectionSchema).default([]),
  /** Urutan bagian isi CV. Draft lama memakai urutan default. */
  sectionOrder: z.array(z.string()).optional()
})

export const ResumeLanguageSchema = z.enum(['id', 'en']).default('id')

export const TargetJobSchema = z.object({
  title: z.string().default(''),
  company: z.string().default(''),
  description: z.string().default(''),
  matchedSkills: z.array(z.string()).default([]),
  createdAt: z.number()
})

export const ResumeDraftSchema = z.object({
  id: z.string().uuid(),
  title: z.string().default('CV Tanpa Judul'),
  templateId: z.string().default('ats-clean'),
  colorTheme: z.string().default('#1e293b'),
  fontFamily: z.string().default('sans'),
  resumeLanguage: ResumeLanguageSchema,
  data: ResumeDataSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  version: z.number().default(1),
  favorite: z.boolean().optional(),
  targetJob: TargetJobSchema.optional()
})

export type ResumeLanguage = z.infer<typeof ResumeLanguageSchema>
export type ContactInfo = z.infer<typeof ContactInfoSchema>
export type WorkExperience = z.infer<typeof WorkExperienceSchema>
export type Education = z.infer<typeof EducationSchema>
export type SkillItem = z.infer<typeof SkillItemSchema>
export type LanguageItem = z.infer<typeof LanguageItemSchema>
export type CustomSectionItem = z.infer<typeof CustomSectionItemSchema>
export type CustomSection = z.infer<typeof CustomSectionSchema>
export type ResumeData = z.infer<typeof ResumeDataSchema>
export type TargetJob = z.infer<typeof TargetJobSchema>
export type ResumeDraft = z.infer<typeof ResumeDraftSchema>

export interface ResumeDraftSummary {
  id: string
  title: string
  templateId: string
  updatedAt: number
  createdAt: number
  favorite: boolean
  targetJobTitle?: string
}

export const createEmptyResumeData = (): ResumeData => ({
  contact: {
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    website: '',
    websites: [],
    usePhoto: false,
    photoUrl: ''
  },
  summary: '',
  experiences: [],
  education: [],
  skills: [],
  languages: [],
  customSections: [],
  sectionOrder: [...DEFAULT_BODY_SECTION_ORDER]
})
