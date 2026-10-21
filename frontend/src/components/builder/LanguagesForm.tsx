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
      <div className="border-b pb-2 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Languages className="w-5 h-5 text-indigo-600" />
            Kemampuan Bahasa
          </h3>
          <p className="text-xs text-slate-500">
            Cantumkan bahasa yang dikuasai beserta tingkat kemahiran.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah Bahasa
        </button>
      </div>

      {languages.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
          <p className="text-xs text-slate-400 font-medium">Belum ada bahasa ditambahkan.</p>
          <button
            type="button"
            onClick={handleAdd}
            className="mt-1 text-xs text-indigo-600 font-semibold"
          >
            + Tambah Bahasa
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {languages.map(lang => (
            <div
              key={lang.id}
              className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg shadow-2xs"
            >
              <input
                type="text"
                placeholder="Contoh: Bahasa Indonesia / English"
                aria-label="Nama Bahasa"
                value={lang.language}
                onChange={e => handleUpdate(lang.id, 'language', e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />

              <select
                value={lang.proficiency}
                aria-label="Tingkat Kemahiran Bahasa"
                onChange={e => handleUpdate(lang.id, 'proficiency', e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
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
                className="text-slate-400 hover:text-red-500 p-1.5 rounded transition"
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
