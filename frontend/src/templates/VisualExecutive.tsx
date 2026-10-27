import React from 'react'
import {
  type ResumeDraft,
  getExperienceDescriptionText,
  getFilledWebsites
} from '../types/resume'
import { getResumeSectionOrder } from '../types/resumeSections'
import { Mail, Phone, MapPin, Link as LinkIcon, Globe } from 'lucide-react'
import { CustomSectionsBlock } from './CustomSectionsBlock'
import { getResumeLabels } from './resumeLabels'

interface TemplateProps {
  draft: ResumeDraft
}

export const VisualExecutiveTemplate: React.FC<TemplateProps> = ({ draft }) => {
  const { contact, summary, experiences, education, skills, languages, customSections } = draft.data
  const accentColor = draft.colorTheme || '#1e293b'
  const labels = getResumeLabels(draft.resumeLanguage)
  const sectionOrder = getResumeSectionOrder(draft.data.sectionOrder)
  const orderOf = (section: (typeof sectionOrder)[number]) => sectionOrder.indexOf(section) + 1

  return (
    <div className="flex h-full min-h-[297mm] text-slate-800 -m-10" data-testid="template-visual-executive">
      {/* Kolom Kiri: Sidebar Profil & Kompetensi (~35%) */}
      <aside
        className="w-[35%] p-7 space-y-6 flex flex-col justify-between"
        style={{ backgroundColor: `${accentColor}12`, borderRight: `2px solid ${accentColor}30` }}
      >
        <div className="flex flex-col gap-6">
          {/* Avatar / Inisial */}
          <div className="text-center pt-2">
            {contact.usePhoto && contact.photoUrl ? (
              <img
                src={contact.photoUrl}
                alt={contact.fullName || labels.fullNameFallback}
                className="w-20 h-20 rounded-full mx-auto object-cover shadow-md border-2"
                style={{ borderColor: accentColor }}
                data-testid="preview-photo"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-white font-bold text-xl shadow-md"
                style={{ backgroundColor: accentColor }}
              >
                {contact.fullName
                  ? contact.fullName
                      .split(' ')
                      .map(w => w[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'CV'}
              </div>
            )}
          </div>

          {/* Kontak */}
          <section className="space-y-2">
            <h3
              className="text-xs font-bold uppercase tracking-wider border-b pb-1"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}
            >
              {labels.contact}
            </h3>
            <div className="space-y-1.5 text-2xs text-slate-700">
              {contact.email && (
                <div className="flex items-start gap-1.5 break-all">
                  <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: accentColor }} />
                  <span>{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
                  <span>{contact.location}</span>
                </div>
              )}
              {contact.linkedin && (
                <div className="flex items-start gap-1.5 break-all">
                  <LinkIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: accentColor }} />
                  <span>{contact.linkedin}</span>
                </div>
              )}
              {getFilledWebsites(contact.website, contact.websites).map((url, index) => (
                <div key={`${url}-${index}`} className="flex items-start gap-1.5 break-all">
                  <Globe className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: accentColor }} />
                  <span>{url}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Pendidikan */}
          {education.length > 0 && (
            <section className="space-y-2" style={{ order: orderOf('education') }}>
              <h3
                className="text-xs font-bold uppercase tracking-wider border-b pb-1"
                style={{ color: accentColor, borderColor: `${accentColor}40` }}
              >
                {labels.education}
              </h3>
              <div className="space-y-2 text-2xs">
                {education.map(edu => (
                  <div key={edu.id} className="space-y-0.5">
                    <div className="font-bold text-slate-900">{edu.degree || edu.institution}</div>
                    <div className="text-slate-600">{edu.institution}</div>
                    <div className="text-3xs text-slate-500 font-medium">
                      {edu.startDate && edu.endDate
                        ? `${edu.startDate} - ${edu.endDate}`
                        : edu.endDate || edu.startDate || ''}{' '}
                      {edu.gpa && `(${labels.gpa}: ${edu.gpa})`}
                    </div>
                    {edu.description && (
                      <p className="whitespace-pre-line text-3xs leading-relaxed text-slate-500">
                        {edu.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Keahlian */}
          {skills.length > 0 && (
            <section className="space-y-2" style={{ order: orderOf('skills') }}>
              <h3
                className="text-xs font-bold uppercase tracking-wider border-b pb-1"
                style={{ color: accentColor, borderColor: `${accentColor}40` }}
              >
                {labels.skillsShort}
              </h3>
              <div className="flex flex-wrap gap-1">
                {skills.map(s => (
                  <span
                    key={s.id}
                    className="px-2 py-0.5 rounded text-3xs font-semibold bg-white border border-slate-200 text-slate-800 shadow-2xs"
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Bahasa */}
          {languages.length > 0 && (
            <section className="space-y-1.5" style={{ order: orderOf('languages') }}>
              <h3
                className="text-xs font-bold uppercase tracking-wider border-b pb-1"
                style={{ color: accentColor, borderColor: `${accentColor}40` }}
              >
                {labels.languagesShort}
              </h3>
              <div className="space-y-1 text-2xs text-slate-700">
                {languages.map(l => (
                  <div key={l.id} className="flex justify-between">
                    <span className="font-semibold">{l.language}</span>
                    <span className="text-3xs text-slate-500">{l.proficiency}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="text-center text-3xs text-slate-400 pt-4">Doc-builder Executive</div>
      </aside>

      {/* Kolom Kanan: Pengalaman & Narasi Utama (~65%) */}
      <main className="w-[65%] p-8 space-y-6 flex flex-col justify-between">
        <div className="flex flex-col gap-6">
          {/* Header Nama */}
          <header className="border-b pb-4" style={{ borderColor: accentColor }}>
            <h1
              className="text-3xl font-black tracking-tight uppercase"
              style={{ color: accentColor }}
              data-testid="preview-fullname"
            >
              {contact.fullName || labels.fullNameFallback}
            </h1>
            {contact.headline && (
              <p className="mt-1 text-xs font-semibold text-slate-600" data-testid="preview-headline">
                {contact.headline}
              </p>
            )}
          </header>

          {/* Ringkasan Profesional */}
          {summary && (
            <section className="space-y-1.5" style={{ order: orderOf('summary') }}>
              <h2
                className="text-xs font-bold uppercase tracking-wider border-b pb-1"
                style={{ color: accentColor, borderColor: '#e2e8f0' }}
              >
                {labels.summaryProfile}
              </h2>
              <p className="text-xs text-slate-700 leading-relaxed text-justify pt-0.5">{summary}</p>
            </section>
          )}

          {/* Pengalaman Kerja */}
          {experiences.length > 0 && (
            <section className="space-y-3.5" style={{ order: orderOf('experience') }}>
              <h2
                className="text-xs font-bold uppercase tracking-wider border-b pb-1"
                style={{ color: accentColor, borderColor: '#e2e8f0' }}
              >
                {labels.experience}
              </h2>
              <div className="space-y-3.5">
                {experiences.map(exp => (
                  <div key={exp.id} className="text-xs space-y-1">
                    <div className="flex items-baseline justify-between font-bold text-slate-900">
                      <span className="text-sm font-bold text-slate-900">{exp.jobTitle}</span>
                      <span className="text-2xs font-normal text-slate-500">
                        {exp.startDate} - {exp.current ? labels.present : exp.endDate}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-600">
                      {exp.company} {exp.location && `| ${exp.location}`}
                    </div>
                    {getExperienceDescriptionText(exp) && (
                      <div className="text-slate-700 whitespace-pre-line leading-relaxed pl-1 pt-0.5">
                        {getExperienceDescriptionText(exp)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <div style={{ order: orderOf('custom') }}>
            <CustomSectionsBlock
              sections={customSections}
              accentColor={accentColor}
              variant="visual-executive"
              language={draft.resumeLanguage}
            />
          </div>
        </div>

        <footer className="text-right text-3xs text-slate-300">
          Dihasilkan secara aman dengan Doc-builder
        </footer>
      </main>
    </div>
  )
}
