import React from 'react'
import {
  type ResumeDraft,
  getExperienceDescriptionText,
  getFilledWebsites
} from '../types/resume'
import { getResumeSectionOrder } from '../types/resumeSections'
import { CustomSectionsBlock } from './CustomSectionsBlock'
import { getResumeLabels } from './resumeLabels'

interface TemplateProps {
  draft: ResumeDraft
}

export const VisualMinimalTemplate: React.FC<TemplateProps> = ({ draft }) => {
  const { contact, summary, experiences, education, skills, languages, customSections } = draft.data
  const accentColor = draft.colorTheme || '#1e293b'
  const labels = getResumeLabels(draft.resumeLanguage)
  const sectionOrder = getResumeSectionOrder(draft.data.sectionOrder)
  const orderOf = (section: (typeof sectionOrder)[number]) => sectionOrder.indexOf(section) + 1

  return (
    <div className="flex flex-col gap-6 text-slate-800" data-testid="template-visual-minimal">
      {/* Header Minimalis Terbuka */}
      <header className="flex items-center justify-between gap-4">
        <div className="space-y-2 flex-1">
          <h1
            className="text-3xl font-light tracking-wide uppercase"
            style={{ color: accentColor }}
            data-testid="preview-fullname"
          >
            {contact.fullName || labels.fullNameFallback}
          </h1>
          {contact.headline && (
            <p className="text-xs font-semibold text-slate-600" data-testid="preview-headline">
              {contact.headline}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-slate-500 font-medium">
            {contact.email && <span>{contact.email}</span>}
            {contact.phone && <span>• {contact.phone}</span>}
            {contact.location && <span>• {contact.location}</span>}
            {contact.linkedin && <span>• {contact.linkedin}</span>}
            {getFilledWebsites(contact.website, contact.websites).map((url, index) => (
              <span key={`${url}-${index}`}>• {url}</span>
            ))}
          </div>
        </div>
        {contact.usePhoto && contact.photoUrl && (
          <img
            src={contact.photoUrl}
            alt={contact.fullName || labels.fullNameFallback}
            className="w-20 h-20 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
            data-testid="preview-photo"
          />
        )}
      </header>

      {/* Ringkasan */}
      {summary && (
        <section className="space-y-1.5 pt-2" style={{ order: orderOf('summary') }}>
          <h2 className="text-3xs font-bold uppercase tracking-widest text-slate-400">
            {labels.summaryAbout}
          </h2>
          <p className="text-xs text-slate-700 leading-relaxed text-justify font-light">{summary}</p>
        </section>
      )}

      {/* Pengalaman */}
      {experiences.length > 0 && (
        <section className="space-y-4 pt-2" style={{ order: orderOf('experience') }}>
          <h2 className="text-3xs font-bold uppercase tracking-widest text-slate-400">
            {labels.experienceShort}
          </h2>
          <div className="space-y-3.5">
            {experiences.map(exp => (
              <div key={exp.id} className="text-xs space-y-1">
                <div className="flex items-baseline justify-between font-medium">
                  <span className="font-semibold text-slate-900">{exp.jobTitle}</span>
                  <span className="text-3xs text-slate-400">
                    {exp.startDate} — {exp.current ? labels.present : exp.endDate}
                  </span>
                </div>
                <div className="text-slate-500 text-2xs">
                  {exp.company} {exp.location && `, ${exp.location}`}
                </div>
                {getExperienceDescriptionText(exp) && (
                  <div className="text-slate-600 whitespace-pre-line leading-relaxed font-light pl-2">
                    {getExperienceDescriptionText(exp)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pendidikan */}
      {education.length > 0 && (
        <section className="space-y-3 pt-2" style={{ order: orderOf('education') }}>
          <h2 className="text-3xs font-bold uppercase tracking-widest text-slate-400">
            {labels.education}
          </h2>
          <div className="space-y-2">
            {education.map(edu => (
              <div key={edu.id} className="text-xs">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-slate-900">{edu.institution}</span>
                  <span className="text-3xs text-slate-400">
                    {edu.startDate && edu.endDate
                      ? `${edu.startDate} — ${edu.endDate}`
                      : edu.endDate || edu.startDate || ''}
                  </span>
                </div>
                <div className="text-slate-500 text-2xs">
                  {edu.degree} {edu.fieldOfStudy && `${labels.inField} ${edu.fieldOfStudy}`}
                  {edu.gpa && ` (${labels.gpa}: ${edu.gpa})`}
                </div>
                {edu.description && (
                  <p className="mt-0.5 whitespace-pre-line text-2xs font-light leading-relaxed text-slate-500">
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
        <section className="space-y-2 pt-2" style={{ order: orderOf('skills') }}>
          <h2 className="text-3xs font-bold uppercase tracking-widest text-slate-400">
            {labels.skillsShort}
          </h2>
          <div className="flex flex-wrap gap-2 text-2xs text-slate-700">
            {skills.map(s => (
              <span key={s.id} className="underline decoration-slate-300 underline-offset-4">
                {s.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Bahasa */}
      {languages.length > 0 && (
        <section className="space-y-1.5 pt-2" style={{ order: orderOf('languages') }}>
          <h2 className="text-3xs font-bold uppercase tracking-widest text-slate-400">
            {labels.languagesShort}
          </h2>
          <div className="text-2xs text-slate-600 flex gap-4">
            {languages.map(l => (
              <span key={l.id}>
                {l.language} ({l.proficiency})
              </span>
            ))}
          </div>
        </section>
      )}

      <div style={{ order: orderOf('custom') }}>
        <CustomSectionsBlock
          sections={customSections}
          accentColor={accentColor}
          variant="visual-minimal"
          language={draft.resumeLanguage}
        />
      </div>
    </div>
  )
}
