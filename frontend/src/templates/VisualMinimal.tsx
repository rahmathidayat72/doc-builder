import React from 'react'
import { type ResumeDraft } from '../types/resume'
import { CustomSectionsBlock } from './CustomSectionsBlock'

interface TemplateProps {
  draft: ResumeDraft
}

export const VisualMinimalTemplate: React.FC<TemplateProps> = ({ draft }) => {
  const { contact, summary, experiences, education, skills, languages, customSections } = draft.data
  const accentColor = draft.colorTheme || '#1e293b'

  return (
    <div className="space-y-6 text-slate-800" data-testid="template-visual-minimal">
      {/* Header Minimalis Terbuka */}
      <header className="space-y-2">
        <h1
          className="text-3xl font-light tracking-wide uppercase"
          style={{ color: accentColor }}
          data-testid="preview-fullname"
        >
          {contact.fullName || 'Nama Lengkap'}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-slate-500 font-medium">
          {contact.email && <span>{contact.email}</span>}
          {contact.phone && <span>• {contact.phone}</span>}
          {contact.location && <span>• {contact.location}</span>}
          {contact.linkedin && <span>• {contact.linkedin}</span>}
          {contact.website && <span>• {contact.website}</span>}
        </div>
      </header>

      {/* Ringkasan */}
      {summary && (
        <section className="space-y-1.5 pt-2">
          <h2 className="text-3xs font-bold uppercase tracking-widest text-slate-400">
            Tentang Saya
          </h2>
          <p className="text-xs text-slate-700 leading-relaxed text-justify font-light">{summary}</p>
        </section>
      )}

      {/* Pengalaman */}
      {experiences.length > 0 && (
        <section className="space-y-4 pt-2">
          <h2 className="text-3xs font-bold uppercase tracking-widest text-slate-400">
            Pengalaman
          </h2>
          <div className="space-y-3.5">
            {experiences.map(exp => (
              <div key={exp.id} className="text-xs space-y-1">
                <div className="flex items-baseline justify-between font-medium">
                  <span className="font-semibold text-slate-900">{exp.jobTitle}</span>
                  <span className="text-3xs text-slate-400">
                    {exp.startDate} — {exp.current ? 'Sekarang' : exp.endDate}
                  </span>
                </div>
                <div className="text-slate-500 text-2xs">
                  {exp.company} {exp.location && `, ${exp.location}`}
                </div>
                {exp.description && (
                  <div className="text-slate-600 whitespace-pre-line leading-relaxed font-light pl-2">
                    {exp.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pendidikan */}
      {education.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-3xs font-bold uppercase tracking-widest text-slate-400">
            Pendidikan
          </h2>
          <div className="space-y-2">
            {education.map(edu => (
              <div key={edu.id} className="text-xs">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-slate-900">{edu.institution}</span>
                  <span className="text-3xs text-slate-400">
                    {edu.startDate} — {edu.endDate}
                  </span>
                </div>
                <div className="text-slate-500 text-2xs">
                  {edu.degree} {edu.fieldOfStudy && `dalam ${edu.fieldOfStudy}`}
                  {edu.gpa && ` (IPK: ${edu.gpa})`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Keahlian */}
      {skills.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="text-3xs font-bold uppercase tracking-widest text-slate-400">
            Keahlian
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
        <section className="space-y-1.5 pt-2">
          <h2 className="text-3xs font-bold uppercase tracking-widest text-slate-400">
            Bahasa
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

      <CustomSectionsBlock
        sections={customSections}
        accentColor={accentColor}
        variant="visual-minimal"
      />
    </div>
  )
}
