import React from 'react'
import { type ResumeDraft } from '../types/resume'
import { Mail, Phone, MapPin, Link as LinkIcon, Globe } from 'lucide-react'
import { CustomSectionsBlock } from './CustomSectionsBlock'

interface TemplateProps {
  draft: ResumeDraft
}

export const VisualExecutiveTemplate: React.FC<TemplateProps> = ({ draft }) => {
  const { contact, summary, experiences, education, skills, languages, customSections } = draft.data
  const accentColor = draft.colorTheme || '#1e293b'

  return (
    <div className="flex h-full min-h-[297mm] text-slate-800 -m-10" data-testid="template-visual-executive">
      {/* Kolom Kiri: Sidebar Profil & Kompetensi (~35%) */}
      <aside
        className="w-[35%] p-7 space-y-6 flex flex-col justify-between"
        style={{ backgroundColor: `${accentColor}12`, borderRight: `2px solid ${accentColor}30` }}
      >
        <div className="space-y-6">
          {/* Avatar / Inisial */}
          <div className="text-center pt-2">
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
          </div>

          {/* Kontak */}
          <section className="space-y-2">
            <h3
              className="text-xs font-bold uppercase tracking-wider border-b pb-1"
              style={{ color: accentColor, borderColor: `${accentColor}40` }}
            >
              Kontak
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
              {contact.website && (
                <div className="flex items-start gap-1.5 break-all">
                  <Globe className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: accentColor }} />
                  <span>{contact.website}</span>
                </div>
              )}
            </div>
          </section>

          {/* Pendidikan */}
          {education.length > 0 && (
            <section className="space-y-2">
              <h3
                className="text-xs font-bold uppercase tracking-wider border-b pb-1"
                style={{ color: accentColor, borderColor: `${accentColor}40` }}
              >
                Pendidikan
              </h3>
              <div className="space-y-2 text-2xs">
                {education.map(edu => (
                  <div key={edu.id} className="space-y-0.5">
                    <div className="font-bold text-slate-900">{edu.degree || edu.institution}</div>
                    <div className="text-slate-600">{edu.institution}</div>
                    <div className="text-3xs text-slate-500 font-medium">
                      {edu.startDate} - {edu.endDate} {edu.gpa && `(IPK: ${edu.gpa})`}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Keahlian */}
          {skills.length > 0 && (
            <section className="space-y-2">
              <h3
                className="text-xs font-bold uppercase tracking-wider border-b pb-1"
                style={{ color: accentColor, borderColor: `${accentColor}40` }}
              >
                Keahlian
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
            <section className="space-y-1.5">
              <h3
                className="text-xs font-bold uppercase tracking-wider border-b pb-1"
                style={{ color: accentColor, borderColor: `${accentColor}40` }}
              >
                Bahasa
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
        <div className="space-y-6">
          {/* Header Nama */}
          <header className="border-b pb-4" style={{ borderColor: accentColor }}>
            <h1
              className="text-3xl font-black tracking-tight uppercase"
              style={{ color: accentColor }}
              data-testid="preview-fullname"
            >
              {contact.fullName || 'Nama Lengkap'}
            </h1>
          </header>

          {/* Ringkasan Profesional */}
          {summary && (
            <section className="space-y-1.5">
              <h2
                className="text-xs font-bold uppercase tracking-wider border-b pb-1"
                style={{ color: accentColor, borderColor: '#e2e8f0' }}
              >
                Profil Profesional
              </h2>
              <p className="text-xs text-slate-700 leading-relaxed text-justify pt-0.5">{summary}</p>
            </section>
          )}

          {/* Pengalaman Kerja */}
          {experiences.length > 0 && (
            <section className="space-y-3.5">
              <h2
                className="text-xs font-bold uppercase tracking-wider border-b pb-1"
                style={{ color: accentColor, borderColor: '#e2e8f0' }}
              >
                Pengalaman Kerja
              </h2>
              <div className="space-y-3.5">
                {experiences.map(exp => (
                  <div key={exp.id} className="text-xs space-y-1">
                    <div className="flex items-baseline justify-between font-bold text-slate-900">
                      <span className="text-sm font-bold text-slate-900">{exp.jobTitle}</span>
                      <span className="text-2xs font-normal text-slate-500">
                        {exp.startDate} - {exp.current ? 'Sekarang' : exp.endDate}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-600">
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

          <CustomSectionsBlock
            sections={customSections}
            accentColor={accentColor}
            variant="visual-executive"
          />
        </div>

        <footer className="text-right text-3xs text-slate-300">
          Dihasilkan secara aman dengan Doc-builder
        </footer>
      </main>
    </div>
  )
}
