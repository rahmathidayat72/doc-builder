import React from 'react'
import { type ResumeDraft } from '../types/resume'
import { Mail, Phone, MapPin, Link as LinkIcon, Globe } from 'lucide-react'
import { CustomSectionsBlock } from './CustomSectionsBlock'
import { getResumeLabels } from './resumeLabels'

interface TemplateProps {
  draft: ResumeDraft
}

export const AtsCleanTemplate: React.FC<TemplateProps> = ({ draft }) => {
  const { contact, summary, experiences, education, skills, languages, customSections } = draft.data
  const accentColor = draft.colorTheme || '#1e293b'
  const labels = getResumeLabels(draft.resumeLanguage)

  return (
    <div className="space-y-5 text-slate-800" data-testid="template-ats-clean">
      {/* Header Klasik Rata Tengah */}
      <header className="text-center border-b pb-3" style={{ borderColor: accentColor }}>
        {contact.usePhoto && contact.photoUrl && (
          <div className="mb-2 flex justify-center">
            <img
              src={contact.photoUrl}
              alt={contact.fullName || labels.fullNameFallback}
              className="w-20 h-20 rounded-lg object-cover border border-slate-300 shadow-xs"
              data-testid="preview-photo"
            />
          </div>
        )}
        <h1
          className="text-2xl font-bold tracking-tight uppercase"
          style={{ color: accentColor }}
          data-testid="preview-fullname"
        >
          {contact.fullName || labels.fullNameFallback}
        </h1>
        <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-xs text-slate-600 mt-1.5">
          {contact.email && (
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              {contact.email}
            </span>
          )}
          {contact.phone && (
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {contact.phone}
            </span>
          )}
          {contact.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {contact.location}
            </span>
          )}
          {contact.linkedin && (
            <span className="flex items-center gap-1">
              <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
              {contact.linkedin}
            </span>
          )}
          {contact.website && (
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              {contact.website}
            </span>
          )}
        </div>
      </header>

      {/* Ringkasan */}
      {summary && (
        <section className="space-y-1">
          <h2
            className="text-xs font-bold uppercase tracking-wider border-b pb-0.5"
            style={{ color: accentColor, borderColor: '#cbd5e1' }}
          >
            {labels.summary}
          </h2>
          <p className="text-xs text-slate-700 leading-relaxed text-justify pt-1">{summary}</p>
        </section>
      )}

      {/* Pengalaman Kerja */}
      {experiences.length > 0 && (
        <section className="space-y-2.5">
          <h2
            className="text-xs font-bold uppercase tracking-wider border-b pb-0.5"
            style={{ color: accentColor, borderColor: '#cbd5e1' }}
          >
            {labels.experience}
          </h2>
          <div className="space-y-2.5 pt-0.5">
            {experiences.map(exp => (
              <div key={exp.id} className="text-xs space-y-1">
                <div className="flex items-baseline justify-between font-bold text-slate-900">
                  <span>{exp.jobTitle}</span>
                  <span className="text-2xs font-normal text-slate-500">
                    {exp.startDate} - {exp.current ? labels.present : exp.endDate}
                  </span>
                </div>
                <div className="text-slate-600 font-medium italic">
                  {exp.company} {exp.location && `| ${exp.location}`}
                </div>
                {exp.description && (
                  <div className="text-slate-700 whitespace-pre-line leading-relaxed pl-1 pt-0.5">
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
        <section className="space-y-2">
          <h2
            className="text-xs font-bold uppercase tracking-wider border-b pb-0.5"
            style={{ color: accentColor, borderColor: '#cbd5e1' }}
          >
            {labels.education}
          </h2>
          <div className="space-y-2 pt-0.5">
            {education.map(edu => (
              <div key={edu.id} className="text-xs space-y-0.5">
                <div className="flex items-baseline justify-between font-bold text-slate-900">
                  <span>{edu.institution}</span>
                  <span className="text-2xs font-normal text-slate-500">
                    {edu.startDate && edu.endDate
                      ? `${edu.startDate} - ${edu.endDate}`
                      : edu.endDate || edu.startDate || ''}
                  </span>
                </div>
                <div className="text-slate-600">
                  {edu.degree} {edu.fieldOfStudy && `${labels.inField} ${edu.fieldOfStudy}`}
                  {edu.gpa && ` | ${labels.gpa}: ${edu.gpa}`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Keahlian */}
      {skills.length > 0 && (
        <section className="space-y-1.5">
          <h2
            className="text-xs font-bold uppercase tracking-wider border-b pb-0.5"
            style={{ color: accentColor, borderColor: '#cbd5e1' }}
          >
            {labels.skills}
          </h2>
          <div className="text-xs text-slate-700 pt-0.5 leading-relaxed">
            {skills.map(s => s.name).join(' • ')}
          </div>
        </section>
      )}

      {/* Bahasa */}
      {languages.length > 0 && (
        <section className="space-y-1.5">
          <h2
            className="text-xs font-bold uppercase tracking-wider border-b pb-0.5"
            style={{ color: accentColor, borderColor: '#cbd5e1' }}
          >
            {labels.languages}
          </h2>
          <div className="text-xs text-slate-700 pt-0.5 grid grid-cols-2 gap-2">
            {languages.map(l => (
              <div key={l.id}>
                <strong>{l.language}</strong>: {l.proficiency}
              </div>
            ))}
          </div>
        </section>
      )}

      <CustomSectionsBlock
        sections={customSections}
        accentColor={accentColor}
        variant="ats-clean"
        language={draft.resumeLanguage}
      />
    </div>
  )
}
