import { type ResumeData } from '../types/resume'

export const IMPORT_SECTION_IDS = [
  'contact',
  'summary',
  'experiences',
  'education',
  'skills',
  'languages',
  'customSections'
] as const

export type ImportSectionId = (typeof IMPORT_SECTION_IDS)[number]
export type ImportMode = 'merge' | 'replace'

export const DEFAULT_IMPORT_SECTIONS: ImportSectionId[] = [...IMPORT_SECTION_IDS]

const nonEmpty = (value: string | undefined): value is string =>
  Boolean(value && value.trim())

const normalize = (value: string) => value.trim().toLowerCase()

const uniqueAppend = <T>(
  current: T[],
  imported: T[],
  keyOf: (item: T) => string
): T[] => {
  const seen = new Set(current.map(keyOf).filter(Boolean))
  const additions = imported.filter(item => {
    const key = keyOf(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return [...current, ...additions]
}

const mergeContact = (current: ResumeData, imported: ResumeData): ResumeData['contact'] => {
  const next = {
    ...current.contact,
    usePhoto: current.contact.usePhoto,
    photoUrl: current.contact.photoUrl
  }

  if (nonEmpty(imported.contact.fullName)) next.fullName = imported.contact.fullName
  if (nonEmpty(imported.contact.headline)) next.headline = imported.contact.headline
  if (nonEmpty(imported.contact.email)) next.email = imported.contact.email
  if (nonEmpty(imported.contact.phone)) next.phone = imported.contact.phone
  if (nonEmpty(imported.contact.location)) next.location = imported.contact.location
  if (nonEmpty(imported.contact.linkedin)) next.linkedin = imported.contact.linkedin
  if (nonEmpty(imported.contact.website)) next.website = imported.contact.website

  if (imported.contact.websites?.some(item => item.trim())) {
    next.websites = [...imported.contact.websites]
    next.website = imported.contact.website || imported.contact.websites[0] || ''
  }

  return next
}

const mergeCustomSections = (
  current: ResumeData['customSections'],
  imported: ResumeData['customSections']
): ResumeData['customSections'] => {
  const next = current.map(section => ({
    ...section,
    items: [...section.items]
  }))

  for (const importedSection of imported) {
    const existingIndex = importedSection.sectionTitle.trim()
      ? next.findIndex(
          section =>
            normalize(section.sectionTitle) === normalize(importedSection.sectionTitle)
        )
      : -1

    if (existingIndex === -1) {
      next.push({
        ...importedSection,
        items: [...importedSection.items]
      })
      continue
    }

    const existing = next[existingIndex]
    existing.items = uniqueAppend(
      existing.items,
      importedSection.items,
      item => normalize(`${item.title}|${item.subtitle}|${item.date}|${item.description}`)
    )
  }

  return next
}

/**
 * Menggabungkan hasil impor secara selektif tanpa menghapus data yang tidak
 * dipilih. Mode `merge` menambahkan item baru dan mengisi kontak kosong,
 * sedangkan `replace` menimpa bagian terpilih saja.
 */
export function applyImportedResumeData(
  current: ResumeData,
  imported: ResumeData,
  selectedSections: ImportSectionId[] = DEFAULT_IMPORT_SECTIONS,
  mode: ImportMode = 'merge'
): ResumeData {
  const selected = new Set(selectedSections)
  const next: ResumeData = {
    ...current,
    contact: { ...current.contact },
    experiences: [...current.experiences],
    education: [...current.education],
    skills: [...current.skills],
    languages: [...current.languages],
    customSections: current.customSections.map(section => ({
      ...section,
      items: [...section.items]
    })),
    sectionOrder: current.sectionOrder
  }

  if (selected.has('contact')) {
    next.contact =
      mode === 'replace'
        ? {
            ...imported.contact,
            usePhoto: current.contact.usePhoto,
            photoUrl: current.contact.photoUrl
          }
        : mergeContact(current, imported)
  }

  if (selected.has('summary')) {
    if (mode === 'replace' || imported.summary.trim()) {
      next.summary = imported.summary
    }
  }

  if (mode === 'replace') {
    if (selected.has('experiences')) next.experiences = [...imported.experiences]
    if (selected.has('education')) next.education = [...imported.education]
    if (selected.has('skills')) next.skills = [...imported.skills]
    if (selected.has('languages')) next.languages = [...imported.languages]
    if (selected.has('customSections')) {
      next.customSections = imported.customSections.map(section => ({
        ...section,
        items: [...section.items]
      }))
    }
  } else {
    if (selected.has('experiences')) {
      next.experiences = uniqueAppend(
        current.experiences,
        imported.experiences,
        item =>
          normalize(`${item.jobTitle}|${item.company}|${item.startDate}|${item.endDate}`)
      )
    }
    if (selected.has('education')) {
      next.education = uniqueAppend(
        current.education,
        imported.education,
        item => normalize(`${item.institution}|${item.degree}|${item.fieldOfStudy}`)
      )
    }
    if (selected.has('skills')) {
      next.skills = uniqueAppend(current.skills, imported.skills, item =>
        normalize(item.name)
      )
    }
    if (selected.has('languages')) {
      next.languages = uniqueAppend(current.languages, imported.languages, item =>
        normalize(item.language)
      )
    }
    if (selected.has('customSections')) {
      next.customSections = mergeCustomSections(current.customSections, imported.customSections)
    }
  }

  return next
}
