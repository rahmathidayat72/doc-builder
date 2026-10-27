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
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-indigo-600" />
          Keahlian & Kompetensi (Skills)
        </h3>
        <p className="text-xs text-slate-500">
          Masukkan kata kunci keahlian teknis, perangkat lunak, maupun keahlian interpersonal.
        </p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Ketik keahlian lalu tekan Enter (misal: Python, React, SQL)..."
            aria-label="Nama Keahlian"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            data-testid="input-skill"
          />
        </div>

        <button
          type="button"
          onClick={() => handleAdd()}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition flex items-center justify-center gap-1 shrink-0"
          data-testid="btn-add-skill"
        >
          <Plus className="w-4 h-4" />
          Tambah
        </button>
      </div>

      {/* Preset Suggestions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-slate-400 font-medium">Saran Cepat:</span>
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
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              + {preset}
            </button>
          )
        })}
      </div>

      {/* Current Skills List */}
      <div className="pt-2">
        <label className="block text-xs font-medium text-slate-700 mb-2">
          Keahlian Tersimpan ({skills.length})
        </label>
        {skills.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Belum ada keahlian ditambahkan.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map(skill => (
              <span
                key={skill.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 hover:border-indigo-300 rounded-full text-xs font-medium text-slate-800 shadow-xs transition-colors animate-pop-in"
              >
                {skill.name}
                <button
                  type="button"
                  onClick={() => handleDelete(skill.id)}
                  aria-label={`Hapus ${skill.name}`}
                  className="text-slate-400 hover:text-red-500 rounded-full transition"
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
