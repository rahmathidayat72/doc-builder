import { type CustomSection } from '../types/resume'

interface CustomSectionsBlockProps {
  sections: CustomSection[]
  accentColor: string
  variant: 'ats-clean' | 'ats-modern' | 'visual-executive' | 'visual-minimal'
}

const hasItemContent = (item: CustomSection['items'][number]) =>
  Boolean(item.title.trim() || item.subtitle.trim() || item.date.trim() || item.description.trim())

export function CustomSectionsBlock({
  sections,
  accentColor,
  variant
}: CustomSectionsBlockProps) {
  const visibleSections = sections
    .map(section => ({ ...section, items: section.items.filter(hasItemContent) }))
    .filter(section => section.sectionTitle.trim() || section.items.length > 0)

  if (visibleSections.length === 0) return null

  const minimal = variant === 'visual-minimal'
  const modern = variant === 'ats-modern'
  const executive = variant === 'visual-executive'

  return (
    <>
      {visibleSections.map(section => (
        <section
          key={section.id}
          className={minimal ? 'space-y-3 pt-2' : executive ? 'space-y-2.5' : 'space-y-2'}
          data-testid="custom-section-preview"
        >
          <h2
            className={
              minimal
                ? 'text-3xs font-bold uppercase tracking-widest text-slate-400'
                : modern
                  ? 'border-l-4 pl-2 text-xs font-bold uppercase tracking-wider'
                  : 'border-b pb-0.5 text-xs font-bold uppercase tracking-wider'
            }
            style={
              minimal
                ? undefined
                : modern
                  ? { color: accentColor, borderColor: accentColor }
                  : { color: accentColor, borderColor: executive ? '#e2e8f0' : '#cbd5e1' }
            }
          >
            {section.sectionTitle.trim() || 'Bagian Tambahan'}
          </h2>
          {section.items.length > 0 && (
            <div className={minimal ? 'space-y-2' : 'space-y-2.5 pt-0.5'}>
              {section.items.map(item => (
                <div key={item.id} className="space-y-0.5 text-xs">
                  {(item.title || item.date) && (
                    <div className="flex items-baseline justify-between gap-3">
                      {item.title && <strong className="text-slate-900">{item.title}</strong>}
                      {item.date && (
                        <span className="shrink-0 text-3xs text-slate-500">{item.date}</span>
                      )}
                    </div>
                  )}
                  {item.subtitle && <div className="text-2xs font-medium text-slate-600">{item.subtitle}</div>}
                  {item.description && (
                    <div className="whitespace-pre-line text-slate-700 leading-relaxed">
                      {item.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  )
}
