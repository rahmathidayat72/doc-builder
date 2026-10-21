import { z } from 'zod'

export const ContactInfoSchema = z.object({
  fullName: z.string().default(''),
  email: z.string().email('Format email tidak valid').or(z.literal('')),
  phone: z.string().default(''),
  location: z.string().default(''),
  linkedin: z.string().default(''),
  website: z.string().default(''),
  photoUrl: z.string().optional()
})

export const WorkExperienceSchema = z.object({
  id: z.string(),
  jobTitle: z.string().default(''),
  company: z.string().default(''),
  location: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  current: z.boolean().default(false),
  description: z.string().default('')
})

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
  category: z.string().default('Technical')
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
  customSections: z.array(CustomSectionSchema).default([])
})

export const ResumeDraftSchema = z.object({
  id: z.string().uuid(),
  title: z.string().default('CV Tanpa Judul'),
  templateId: z.string().default('ats-clean'),
  colorTheme: z.string().default('#1e293b'),
  fontFamily: z.string().default('sans'),
  data: ResumeDataSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  version: z.number().default(1)
})

export type ContactInfo = z.infer<typeof ContactInfoSchema>
export type WorkExperience = z.infer<typeof WorkExperienceSchema>
export type Education = z.infer<typeof EducationSchema>
export type SkillItem = z.infer<typeof SkillItemSchema>
export type LanguageItem = z.infer<typeof LanguageItemSchema>
export type CustomSectionItem = z.infer<typeof CustomSectionItemSchema>
export type CustomSection = z.infer<typeof CustomSectionSchema>
export type ResumeData = z.infer<typeof ResumeDataSchema>
export type ResumeDraft = z.infer<typeof ResumeDraftSchema>

export interface ResumeDraftSummary {
  id: string
  title: string
  templateId: string
  updatedAt: number
  createdAt: number
}

export const createEmptyResumeData = (): ResumeData => ({
  contact: {
    fullName: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    website: ''
  },
  summary: '',
  experiences: [],
  education: [],
  skills: [],
  languages: [],
  customSections: []
})
