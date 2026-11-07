import React, { useState } from 'react'
import { type SkillItem } from '../../types/resume'
import { Wrench, Plus, X, Tag } from 'lucide-react'

interface SkillsFormProps {
  skills: SkillItem[]
  onChange: (updated: SkillItem[]) => void
}

const COMMON_PRESETS = [
  'Python', 'TypeScript', 'React', 'FastAPI', 'Docker', 'PostgreSQL',
  'Git', 'Tailwind CSS', 'Figma', 'REST API', 'Linux', 'SQL'
]

export const SkillsForm: React.FC<SkillsFormProps> = ({ skills, onChange }) => {
  const [inputVal, setInputVal] = useState('')

  const handleAdd = (nameToAdd?: string) => {
    const text = (nameToAdd || inputVal).trim()
    if (!text) return

    // Cegah duplikasi
    if (skills.some(s => s.name.toLowerCase() === text.toLowerCase())) {
      setInputVal('')
      return
    }

    const newSkill: SkillItem = {
      id: crypto.randomUUID(),
      name: text,
      category: 'General'
    }

    onChange([...skills, newSkill])
    setInputVal('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  const handleDelete = (id: string) => {
    onChange(skills.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-stone-200 pb-2">
        <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-teal-800" />
          Keahlian & Kompetensi (Skills)
        </h3>
        <p className="text-xs text-stone-600">
          Masukkan kata kunci keahlian teknis, perangkat lunak, maupun keahlian interpersonal.
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Ketik keahlian lalu tekan Enter (misal: Python, React, SQL)..."
            aria-label="Nama Keahlian"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-700 outline-none"
            data-testid="input-skill"
          />
        </div>

        <button
          type="button"
          onClick={() => handleAdd()}
          className="px-4 py-2 text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition flex items-center justify-center gap-1 shrink-0"
          data-testid="btn-add-skill"
        >
          <Plus className="w-4 h-4" />
          Tambah
        </button>
      </div>

      {/* Preset Suggestions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-stone-500 font-medium">Saran Cepat:</span>
        {COMMON_PRESETS.map(preset => {
          const isAdded = skills.some(s => s.name.toLowerCase() === preset.toLowerCase())
          return (
            <button
              key={preset}
              type="button"
              disabled={isAdded}
              onClick={() => handleAdd(preset)}
              className={`text-xs px-2 py-0.5 rounded-full border transition ${
                isAdded
                  ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
                  : 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100'
              }`}
            >
              + {preset}
            </button>
          )
        })}
      </div>

      {/* Current Skills List */}
      <div className="pt-2">
        <label className="block text-xs font-medium text-stone-700 mb-2">
          Keahlian Tersimpan ({skills.length})
        </label>
        {skills.length === 0 ? (
          <p className="text-xs text-stone-400 italic">Belum ada keahlian ditambahkan.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map(skill => (
              <span
                key={skill.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-stone-300 hover:border-teal-600 rounded-full text-xs font-medium text-stone-800 shadow-2xs transition-colors animate-pop-in"
              >
                {skill.name}
                <button
                  type="button"
                  onClick={() => handleDelete(skill.id)}
                  aria-label={`Hapus ${skill.name}`}
                  className="text-stone-400 hover:text-red-500 rounded-full transition"
                  title="Hapus skill ini"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
