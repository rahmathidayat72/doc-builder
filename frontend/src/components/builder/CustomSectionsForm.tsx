import React from 'react'
import { type CustomSection, type CustomSectionItem } from '../../types/resume'
import { Layers3, Plus, Trash2 } from 'lucide-react'

interface CustomSectionsFormProps {
  sections: CustomSection[]
  onChange: (updated: CustomSection[]) => void
}

const createItem = (): CustomSectionItem => ({
  id: crypto.randomUUID(),
  title: '',
  subtitle: '',
  date: '',
  description: ''
})

export const CustomSectionsForm: React.FC<CustomSectionsFormProps> = ({ sections, onChange }) => {
  const addSection = () => {
    onChange([
      ...sections,
      {
        id: crypto.randomUUID(),
        sectionTitle: '',
        items: [createItem()]
      }
    ])
  }

  const updateSection = (sectionId: string, sectionTitle: string) => {
    onChange(
      sections.map(section =>
        section.id === sectionId ? { ...section, sectionTitle } : section
      )
    )
  }

  const deleteSection = (sectionId: string) => {
    onChange(sections.filter(section => section.id !== sectionId))
  }

  const addItem = (sectionId: string) => {
    onChange(
      sections.map(section =>
        section.id === sectionId
          ? { ...section, items: [...section.items, createItem()] }
          : section
      )
    )
  }

  const updateItem = (
    sectionId: string,
    itemId: string,
    field: keyof Omit<CustomSectionItem, 'id'>,
    value: string
  ) => {
    onChange(
      sections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map(item =>
                item.id === itemId ? { ...item, [field]: value } : item
              )
            }
          : section
      )
    )
  }

  const deleteItem = (sectionId: string, itemId: string) => {
    onChange(
      sections.map(section =>
        section.id === sectionId
          ? { ...section, items: section.items.filter(item => item.id !== itemId) }
          : section
      )
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 border-b pb-2">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
            <Layers3 className="h-5 w-5 text-indigo-600" />
            Bagian Lain
          </h3>
          <p className="text-xs text-slate-500">
            Proyek, sertifikasi, organisasi, penghargaan, atau bagian tambahan lain.
          </p>
        </div>
        <button
          type="button"
          onClick={addSection}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-700"
          data-testid="btn-add-custom-section"
        >
          <Plus className="h-3.5 w-3.5" />
          Tambah Bagian
        </button>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-center">
          <Layers3 className="mx-auto mb-2 h-8 w-8 text-slate-400" />
          <p className="text-xs font-medium text-slate-500">Belum ada bagian tambahan.</p>
          <button
            type="button"
            onClick={addSection}
            className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            + Tambah Bagian Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((section, sectionIndex) => (
            <section
              key={section.id}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              data-testid={`custom-section-${sectionIndex}`}
            >
              <div className="flex items-end gap-2">
                <label className="flex-1 text-xs font-medium text-slate-700">
                  Nama Bagian
                  <input
                    type="text"
                    value={section.sectionTitle}
                    onChange={event => updateSection(section.id, event.target.value)}
                    placeholder="Contoh: Sertifikasi atau Proyek"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    data-testid={`input-custom-section-title-${sectionIndex}`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => deleteSection(section.id)}
                  aria-label={`Hapus bagian ${section.sectionTitle || sectionIndex + 1}`}
                  className="rounded p-2 text-slate-400 transition hover:text-red-600"
                  data-testid={`btn-delete-custom-section-${sectionIndex}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                {section.items.map((item, itemIndex) => (
                  <div
                    key={item.id}
                    className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                    data-testid={`custom-item-${sectionIndex}-${itemIndex}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600">
                        Item #{itemIndex + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteItem(section.id, item.id)}
                        aria-label={`Hapus item ${itemIndex + 1}`}
                        className="rounded p-1 text-slate-400 transition hover:text-red-600"
                        data-testid={`btn-delete-custom-item-${sectionIndex}-${itemIndex}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        value={item.title}
                        onChange={event =>
                          updateItem(section.id, item.id, 'title', event.target.value)
                        }
                        placeholder="Judul item"
                        aria-label={`Judul item ${itemIndex + 1}`}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        value={item.subtitle}
                        onChange={event =>
                          updateItem(section.id, item.id, 'subtitle', event.target.value)
                        }
                        placeholder="Penerbit, organisasi, atau subjudul"
                        aria-label={`Subjudul item ${itemIndex + 1}`}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        value={item.date}
                        onChange={event =>
                          updateItem(section.id, item.id, 'date', event.target.value)
                        }
                        placeholder="Tanggal atau periode"
                        aria-label={`Tanggal item ${itemIndex + 1}`}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 sm:col-span-2"
                      />
                    </div>
                    <textarea
                      rows={3}
                      value={item.description}
                      onChange={event =>
                        updateItem(section.id, item.id, 'description', event.target.value)
                      }
                      placeholder="Deskripsi atau detail penting"
                      aria-label={`Deskripsi item ${itemIndex + 1}`}
                      className="w-full rounded-lg border border-slate-300 p-2.5 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => addItem(section.id)}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                data-testid={`btn-add-custom-item-${sectionIndex}`}
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Item
              </button>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
