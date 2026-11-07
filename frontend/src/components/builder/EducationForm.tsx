import React from 'react'
import { type Education } from '../../types/resume'
import {
  GraduationCap,
  Plus,
  Trash2,
  Calendar,
  Award,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { moveItem } from '../../utils/array'
import { validateDateRange } from '../../utils/dateValidation'

interface EducationFormProps {
  education: Education[]
  onChange: (updated: Education[]) => void
}

export const EducationForm: React.FC<EducationFormProps> = ({ education, onChange }) => {
  const handleAdd = () => {
    const newEdu: Education = {
      id: crypto.randomUUID(),
      institution: '',
      degree: '',
      fieldOfStudy: '',
      startDate: '',
      endDate: '',
      gpa: '',
      description: ''
    }
    onChange([newEdu, ...education])
  }

  const handleUpdate = (id: string, field: keyof Education, value: string) => {
    onChange(
      education.map(edu => {
        if (edu.id === id) {
          return { ...edu, [field]: value }
        }
        return edu
      })
    )
  }

  const handleMove = (index: number, direction: -1 | 1) => {
    const next = moveItem(education, index, direction)
    if (next !== education) onChange(next)
  }

  const handleDelete = (id: string) => {
    onChange(education.filter(edu => edu.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-stone-200 pb-2 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-teal-800" />
            Riwayat Pendidikan
          </h3>
          <p className="text-xs text-stone-600">
            Cantumkan jenjang pendidikan formal universitas atau sekolah terakhir.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-800 hover:bg-teal-900 rounded-lg transition shadow-2xs"
          data-testid="btn-add-education"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah Pendidikan
        </button>
      </div>

      {education.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-stone-200 rounded-xl bg-stone-50">
          <GraduationCap className="w-8 h-8 text-stone-400 mx-auto mb-2" />
          <p className="text-xs text-stone-600 font-medium">Belum ada riwayat pendidikan ditambahkan.</p>
          <button
            type="button"
            onClick={handleAdd}
            className="mt-2 text-xs text-teal-800 hover:text-teal-950 font-semibold"
          >
            + Tambah Riwayat Pendidikan
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {education.map((edu, index) => {
            const dateValidation = validateDateRange(edu.startDate, edu.endDate)

            return (
              <div
                key={edu.id}
                className="p-4 border border-stone-200 rounded-xl bg-white shadow-2xs space-y-3 relative group"
                data-testid={`education-item-${index}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 bg-stone-100 text-stone-700 rounded">
                    Pendidikan #{index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      className="text-stone-400 hover:text-teal-800 p-1 rounded transition disabled:cursor-not-allowed disabled:opacity-30"
                      title="Naikkan pendidikan ini"
                      aria-label={`Naikkan ${edu.institution || `pendidikan ${index + 1}`}`}
                      data-testid={`btn-move-education-up-${index}`}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === education.length - 1}
                      className="text-stone-400 hover:text-teal-800 p-1 rounded transition disabled:cursor-not-allowed disabled:opacity-30"
                      title="Turunkan pendidikan ini"
                      aria-label={`Turunkan ${edu.institution || `pendidikan ${index + 1}`}`}
                      data-testid={`btn-move-education-down-${index}`}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(edu.id)}
                      className="text-stone-400 hover:text-red-600 p-1 rounded transition"
                      title="Hapus pendidikan ini"
                      data-testid={`btn-delete-education-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Nama Institusi / Universitas <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Universitas Indonesia"
                      value={edu.institution}
                      onChange={e => handleUpdate(edu.id, 'institution', e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-700 outline-none"
                      data-testid={`input-edu-institution-${index}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Gelar / Jenjang</label>
                    <input
                      type="text"
                      placeholder="Contoh: S1 / Sarjana Komputer"
                      value={edu.degree}
                      onChange={e => handleUpdate(edu.id, 'degree', e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Jurusan / Program Studi</label>
                    <input
                      type="text"
                      placeholder="Contoh: Ilmu Komputer / Teknik Informatika"
                      value={edu.fieldOfStudy}
                      onChange={e => handleUpdate(edu.id, 'fieldOfStudy', e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Periode Tahun</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Calendar className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Mulai (2018)"
                          value={edu.startDate}
                          onChange={e => handleUpdate(edu.id, 'startDate', e.target.value)}
                          aria-invalid={Boolean(dateValidation.startError)}
                          className={`w-full pl-8 pr-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-teal-700 outline-none ${
                            dateValidation.startError ? 'border-red-400' : 'border-stone-300'
                          }`}
                          data-testid={`input-edu-start-${index}`}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Lulus (2022)"
                          value={edu.endDate}
                          onChange={e => handleUpdate(edu.id, 'endDate', e.target.value)}
                          aria-invalid={Boolean(dateValidation.endError)}
                          className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-teal-700 outline-none ${
                            dateValidation.endError ? 'border-red-400' : 'border-stone-300'
                          }`}
                          data-testid={`input-edu-end-${index}`}
                        />
                      </div>
                    </div>
                    {(dateValidation.startError || dateValidation.endError) && (
                      <p className="mt-1 text-2xs font-medium text-red-600" role="alert">
                        {dateValidation.startError || dateValidation.endError}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Nilai Akhir / IPK (Opsional)</label>
                    <div className="relative">
                      <Award className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Contoh: 3.82 / 4.00"
                        value={edu.gpa}
                        onChange={e => handleUpdate(edu.id, 'gpa', e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-700 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Keterangan Tambahan (Opsional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Contoh: Tugas akhir tentang sistem rekomendasi; aktif sebagai asisten dosen."
                    value={edu.description}
                    onChange={e => handleUpdate(edu.id, 'description', e.target.value)}
                    className="w-full p-2.5 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-700 outline-none leading-relaxed"
                    data-testid={`input-edu-description-${index}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
