import React from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ListOrdered, RotateCcw } from 'lucide-react'
import {
  DEFAULT_BODY_SECTION_ORDER,
  RESUME_SECTION_LABELS,
  getResumeSectionOrder,
  type ResumeBodySectionId
} from '../../types/resumeSections'
import { moveItem } from '../../utils/array'

interface SectionOrderFormProps {
  order?: string[]
  templateId?: string
  onChange: (order: ResumeBodySectionId[]) => void
}

const isSameOrder = (left: ResumeBodySectionId[], right: ResumeBodySectionId[]) =>
  left.length === right.length && left.every((value, index) => value === right[index])

export const SectionOrderForm: React.FC<SectionOrderFormProps> = ({
  order,
  templateId,
  onChange
}) => {
  const currentOrder = getResumeSectionOrder(order)

  const move = (index: number, direction: -1 | 1) => {
    onChange(moveItem(currentOrder, index, direction))
  }

  return (
    <details
      className="group mb-4 rounded-xl border border-slate-200 bg-slate-50/80 transition-colors hover:border-slate-300"
      data-testid="section-order-panel"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-xs font-semibold text-slate-700 select-none">
        <span className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          Urutan bagian CV
        </span>
        <span className="flex items-center gap-1 text-2xs font-normal text-slate-500">
          <span>Klik untuk mengatur</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>

      <div className="space-y-2 border-t border-slate-200 p-3 animate-fade-in">
        <p className="text-2xs leading-relaxed text-slate-500">
          Susun bagian sesuai prioritas lowongan. Kontak selalu berada di header.
          {templateId === 'visual-executive'
            ? ' Pada template Executive, urutan berlaku di masing-masing kolom.'
            : ''}
        </p>

        <div className="space-y-1.5">
          {currentOrder.map((section, index) => (
            <div
              key={section}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
            >
              <span className="w-5 text-center text-2xs font-bold text-slate-400">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-xs font-medium text-slate-700">
                {RESUME_SECTION_LABELS[section]}
              </span>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="rounded p-1 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30"
                title={`Naikkan bagian ${RESUME_SECTION_LABELS[section]}`}
                aria-label={`Naikkan bagian ${RESUME_SECTION_LABELS[section]}`}
                data-testid={`btn-section-order-up-${section}`}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === currentOrder.length - 1}
                className="rounded p-1 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30"
                title={`Turunkan bagian ${RESUME_SECTION_LABELS[section]}`}
                aria-label={`Turunkan bagian ${RESUME_SECTION_LABELS[section]}`}
                data-testid={`btn-section-order-down-${section}`}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onChange([...DEFAULT_BODY_SECTION_ORDER])}
          disabled={isSameOrder(currentOrder, DEFAULT_BODY_SECTION_ORDER)}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-2xs font-semibold text-slate-600 transition hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="btn-reset-section-order"
        >
          <RotateCcw className="h-3 w-3" />
          Kembalikan urutan default
        </button>
      </div>
    </details>
  )
}
