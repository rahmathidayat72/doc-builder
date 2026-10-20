import React from 'react'
import { type ResumeDraft } from '../types/resume'
import { AtsCleanTemplate } from './AtsClean'
import { AtsModernTemplate } from './AtsModern'
import { VisualExecutiveTemplate } from './VisualExecutive'
import { VisualMinimalTemplate } from './VisualMinimal'

export interface TemplateDefinition {
  id: string
  name: string
  category: 'ats' | 'visual'
  badge: string
  description: string
  component: React.FC<{ draft: ResumeDraft }>
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'ats-clean',
    name: 'ATS Clean',
    category: 'ats',
    badge: 'ATS Ramah Mesin',
    description: 'Format 1 kolom klasik dengan struktur heading standar, sangat dioptimalkan untuk seleksi ATS.',
    component: AtsCleanTemplate
  },
  {
    id: 'ats-modern',
    name: 'ATS Modern',
    category: 'ats',
    badge: 'ATS Kontemporer',
    description: 'Format 1 kolom dengan aksen garis kiri tegas dan layout tanggal terstruktur.',
    component: AtsModernTemplate
  },
  {
    id: 'visual-executive',
    name: 'Visual Executive',
    category: 'visual',
    badge: 'Desain Visual 2-Kolom',
    description: 'Tata letak 2 kolom profesional dengan sidebar profil berwarna dan hierarki visual kuat.',
    component: VisualExecutiveTemplate
  },
  {
    id: 'visual-minimal',
    name: 'Visual Minimal',
    category: 'visual',
    badge: 'Minimalis Elegan',
    description: 'Desain lapang dengan tipografi bersih, elegan untuk presentasi langsung ke manajer HR.',
    component: VisualMinimalTemplate
  }
]

export function getTemplateComponent(templateId: string): React.FC<{ draft: ResumeDraft }> {
  const found = TEMPLATES.find(t => t.id === templateId)
  return found ? found.component : AtsCleanTemplate
}
