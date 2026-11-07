import React from 'react'
import { type LanguageItem } from '../../types/resume'
import { Languages, Plus, Trash2 } from 'lucide-react'

interface LanguagesFormProps {
  languages: LanguageItem[]
  onChange: (updated: LanguageItem[]) => void
}

export const LanguagesForm: React.FC<LanguagesFormProps> = ({ languages, onChange }) => {
  const handleAdd = () => {
    const newLang: LanguageItem = {
      id: crypto.randomUUID(),
      language: '',
      proficiency: 'Professional'
    }
    onChange([...languages, newLang])
  }

  const handleUpdate = (id: string, field: keyof LanguageItem, value: string) => {
    onChange(
      languages.map(lang => {
        if (lang.id === id) {
          return { ...lang, [field]: value }
        }
        return lang
      })
    )
  }

  const handleDelete = (id: string) => {
    onChange(languages.filter(l => l.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-stone-200 pb-2 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <Languages className="w-5 h-5 text-teal-800" />
            Kemampuan Bahasa
          </h3>
          <p className="text-xs text-stone-600">
            Cantumkan bahasa yang dikuasai beserta tingkat kemahiran.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah Bahasa
        </button>
      </div>

      {languages.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-stone-200 rounded-xl bg-stone-50">
          <p className="text-xs text-stone-500 font-medium">Belum ada bahasa ditambahkan.</p>
          <button
            type="button"
            onClick={handleAdd}
            className="mt-1 text-xs text-teal-800 hover:text-teal-950 font-semibold"
          >
            + Tambah Bahasa
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {languages.map(lang => (
            <div
              key={lang.id}
              className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 p-3 bg-white border border-stone-200 rounded-lg shadow-2xs transition-colors hover:border-stone-300 animate-fade-up"
            >
              <input
                type="text"
                placeholder="Contoh: Bahasa Indonesia / English"
                aria-label="Nama Bahasa"
                value={lang.language}
                onChange={e => handleUpdate(lang.id, 'language', e.target.value)}
                className="min-w-44 flex-1 px-3 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-700 outline-none transition"
              />

              <select
                value={lang.proficiency}
                aria-label="Tingkat Kemahiran Bahasa"
                onChange={e => handleUpdate(lang.id, 'proficiency', e.target.value)}
                className="flex-1 sm:flex-none px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-700 outline-none transition"
              >
                <option value="Native / Bilingual">Penutur Asli (Native)</option>
                <option value="Professional">Tingkat Profesional (Fluent)</option>
                <option value="Intermediate">Menengah (Intermediate)</option>
                <option value="Elementary">Dasar (Elementary)</option>
              </select>

              <button
                type="button"
                onClick={() => handleDelete(lang.id)}
                aria-label="Hapus Bahasa"
                className="text-stone-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
