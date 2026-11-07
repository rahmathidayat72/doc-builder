import React from 'react'
import {
  Briefcase,
  Plus,
  Trash2,
  Calendar,
  Building,
  MapPin,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import {
  getEditableExperienceAchievements,
  type WorkExperience
} from '../../types/resume'
import { moveItem } from '../../utils/array'
import { validateDateRange } from '../../utils/dateValidation'

interface ExperienceFormProps {
  experiences: WorkExperience[]
  onChange: (updated: WorkExperience[]) => void
}

export const ExperienceForm: React.FC<ExperienceFormProps> = ({ experiences, onChange }) => {
  const handleAdd = () => {
    const newExp: WorkExperience = {
      id: crypto.randomUUID(),
      jobTitle: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      description: '',
      achievements: ['']
    }
    onChange([newExp, ...experiences])
  }

  const handleUpdate = (id: string, field: keyof WorkExperience, value: unknown) => {
    onChange(
      experiences.map(exp => {
        if (exp.id === id) {
          const updated = { ...exp, [field]: value }
          if (field === 'current' && value === true) {
            updated.endDate = 'Sekarang'
          }
          return updated
        }
        return exp
      })
    )
  }

  const setAchievements = (exp: WorkExperience, achievements: string[]) => {
    onChange(
      experiences.map(item =>
        item.id === exp.id ? { ...item, achievements, description: '' } : item
      )
    )
  }

  const handleMove = (index: number, direction: -1 | 1) => {
    const next = moveItem(experiences, index, direction)
    if (next !== experiences) onChange(next)
  }

  const handleDelete = (id: string) => {
    onChange(experiences.filter(exp => exp.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-stone-200 pb-2 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-teal-800" />
            Pengalaman Kerja
          </h3>
          <p className="text-xs text-stone-600">
            Tuliskan riwayat karier mulai dari posisi paling terkini.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition shadow-2xs"
          data-testid="btn-add-experience"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah Posisi
        </button>
      </div>

      {experiences.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-stone-200 rounded-xl bg-stone-50">
          <Briefcase className="w-8 h-8 text-stone-400 mx-auto mb-2" />
          <p className="text-xs text-stone-600 font-medium">Belum ada pengalaman kerja ditambahkan.</p>
          <button
            type="button"
            onClick={handleAdd}
            className="mt-2 text-xs text-teal-800 hover:text-teal-950 font-semibold"
          >
            + Tambah Pengalaman Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {experiences.map((exp, index) => {
            const achievements = getEditableExperienceAchievements(exp)
            const dateValidation = validateDateRange(exp.startDate, exp.endDate, exp.current)

            return (
              <div
                key={exp.id}
                className="p-4 border border-stone-200 rounded-xl bg-white shadow-2xs space-y-3 relative group"
                data-testid={`experience-item-${index}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 bg-stone-100 text-stone-700 rounded">
                    Posisi #{index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      className="text-stone-400 hover:text-teal-800 p-1 rounded transition disabled:cursor-not-allowed disabled:opacity-30"
                      title="Naikkan posisi ini"
                      aria-label={`Naikkan ${exp.jobTitle || `posisi ${index + 1}`}`}
                      data-testid={`btn-move-experience-up-${index}`}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === experiences.length - 1}
                      className="text-stone-400 hover:text-teal-800 p-1 rounded transition disabled:cursor-not-allowed disabled:opacity-30"
                      title="Turunkan posisi ini"
                      aria-label={`Turunkan ${exp.jobTitle || `posisi ${index + 1}`}`}
                      data-testid={`btn-move-experience-down-${index}`}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(exp.id)}
                      className="text-stone-400 hover:text-red-600 p-1 rounded transition"
                      title="Hapus posisi ini"
                      data-testid={`btn-delete-experience-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Posisi / Jabatan <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Senior Backend Engineer"
                      value={exp.jobTitle}
                      onChange={e => handleUpdate(exp.id, 'jobTitle', e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-700 outline-none"
                      data-testid={`input-exp-title-${index}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Nama Perusahaan <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Contoh: PT Teknologi Indonesia"
                        value={exp.company}
                        onChange={e => handleUpdate(exp.id, 'company', e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-700 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Lokasi Perusahaan</label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Contoh: Jakarta / Remote"
                        value={exp.location}
                        onChange={e => handleUpdate(exp.id, 'location', e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-700 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Periode Waktu</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Calendar className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Mulai (Jan 2022)"
                          value={exp.startDate}
                          onChange={e => handleUpdate(exp.id, 'startDate', e.target.value)}
                          aria-invalid={Boolean(dateValidation.startError)}
                          className={`w-full pl-8 pr-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-teal-700 outline-none ${
                            dateValidation.startError ? 'border-red-400' : 'border-stone-300'
                          }`}
                          data-testid={`input-exp-start-${index}`}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder={exp.current ? 'Sekarang' : 'Selesai (Des 2024)'}
                          disabled={exp.current}
                          value={exp.current ? 'Sekarang' : exp.endDate}
                          onChange={e => handleUpdate(exp.id, 'endDate', e.target.value)}
                          aria-invalid={Boolean(dateValidation.endError)}
                          className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-teal-700 outline-none ${
                            exp.current ? 'bg-stone-100 text-stone-500 border-stone-300' : ''
                          } ${dateValidation.endError ? 'border-red-400' : 'border-stone-300'}`}
                          data-testid={`input-exp-end-${index}`}
                        />
                      </div>
                    </div>
                    {(dateValidation.startError || dateValidation.endError) && (
                      <p className="mt-1 text-2xs font-medium text-red-600" role="alert">
                        {dateValidation.startError || dateValidation.endError}
                      </p>
                    )}
                    <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exp.current}
                        onChange={e => handleUpdate(exp.id, 'current', e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-teal-800 focus:ring-teal-700 border-stone-300 accent-teal-800"
                        data-testid={`checkbox-exp-current-${index}`}
                      />
                      <span className="text-xs text-stone-600">Saya masih bekerja di posisi ini</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-medium text-stone-700">
                        Pencapaian & Tanggung Jawab
                      </label>
                      <p className="text-2xs text-stone-600">
                        Tulis satu pencapaian per butir, utamakan angka dan dampak.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAchievements(exp, [...achievements, ''])}
                      className="flex shrink-0 items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-2xs font-semibold text-teal-900 transition hover:bg-teal-100"
                      data-testid={`btn-add-achievement-${index}`}
                    >
                      <Plus className="w-3 h-3" />
                      Butir
                    </button>
                  </div>

                  {achievements.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-2 text-2xs text-stone-500">
                      Belum ada butir pencapaian. Klik “Butir” untuk menambahkan.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {achievements.map((achievement, achievementIndex) => (
                        <div key={achievementIndex} className="flex items-start gap-1.5">
                          <span className="mt-2 text-stone-400" aria-hidden="true">
                            •
                          </span>
                          <textarea
                            rows={2}
                            value={achievement}
                            onChange={event => {
                              const next = [...achievements]
                              next[achievementIndex] = event.target.value
                              setAchievements(exp, next)
                            }}
                            placeholder="Contoh: Meningkatkan performa API 35% melalui optimasi query"
                            className="min-w-0 flex-1 resize-y rounded-lg border border-stone-300 p-2 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-teal-700"
                            data-testid={`input-exp-achievement-${index}-${achievementIndex}`}
                          />
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() =>
                                setAchievements(exp, moveItem(achievements, achievementIndex, -1))
                              }
                              disabled={achievementIndex === 0}
                              className="rounded p-1 text-stone-400 transition hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-30"
                              title="Naikkan butir"
                              aria-label="Naikkan butir pencapaian"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setAchievements(exp, moveItem(achievements, achievementIndex, 1))
                              }
                              disabled={achievementIndex === achievements.length - 1}
                              className="rounded p-1 text-stone-400 transition hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-30"
                              title="Turunkan butir"
                              aria-label="Turunkan butir pencapaian"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setAchievements(
                                  exp,
                                  achievements.filter((_, itemIndex) => itemIndex !== achievementIndex)
                                )
                              }
                              className="rounded p-1 text-stone-400 transition hover:text-red-600"
                              title="Hapus butir"
                              aria-label="Hapus butir pencapaian"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
