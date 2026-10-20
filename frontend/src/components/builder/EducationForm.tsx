import React from 'react'
import { type Education } from '../../types/resume'
import { GraduationCap, Plus, Trash2, Calendar, Award } from 'lucide-react'

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

  const handleDelete = (id: string) => {
    onChange(education.filter(edu => edu.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="border-b pb-2 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            Riwayat Pendidikan
          </h3>
          <p className="text-xs text-slate-500">
            Cantumkan jenjang pendidikan formal universitas atau sekolah terakhir.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm"
          data-testid="btn-add-education"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah Pendidikan
        </button>
      </div>

      {education.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
          <GraduationCap className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Belum ada riwayat pendidikan ditambahkan.</p>
          <button
            type="button"
            onClick={handleAdd}
            className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            + Tambah Riwayat Pendidikan
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {education.map((edu, index) => (
            <div
              key={edu.id}
              className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3 relative group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                  Pendidikan #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(edu.id)}
                  className="text-slate-400 hover:text-red-600 p-1 rounded transition"
                  title="Hapus pendidikan ini"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Institusi / Universitas <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Universitas Indonesia"
                    value={edu.institution}
                    onChange={e => handleUpdate(edu.id, 'institution', e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Gelar / Jenjang</label>
                  <input
                    type="text"
                    placeholder="Contoh: S1 / Sarjana Komputer"
                    value={edu.degree}
                    onChange={e => handleUpdate(edu.id, 'degree', e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Jurusan / Program Studi</label>
                  <input
                    type="text"
                    placeholder="Contoh: Ilmu Komputer / Teknik Informatika"
                    value={edu.fieldOfStudy}
                    onChange={e => handleUpdate(edu.id, 'fieldOfStudy', e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Periode Tahun</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Mulai (2018)"
                        value={edu.startDate}
                        onChange={e => handleUpdate(edu.id, 'startDate', e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Lulus (2022)"
                        value={edu.endDate}
                        onChange={e => handleUpdate(edu.id, 'endDate', e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nilai Akhir / IPK (Opsional)</label>
                  <div className="relative">
                    <Award className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Contoh: 3.82 / 4.00"
                      value={edu.gpa}
                      onChange={e => handleUpdate(edu.id, 'gpa', e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
