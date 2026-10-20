import React from 'react'
import { type WorkExperience } from '../../types/resume'
import { Briefcase, Plus, Trash2, Calendar, Building, MapPin } from 'lucide-react'

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
      description: '• '
    }
    onChange([newExp, ...experiences])
  }

  const handleUpdate = (id: string, field: keyof WorkExperience, value: any) => {
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

  const handleDelete = (id: string) => {
    onChange(experiences.filter(exp => exp.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="border-b pb-2 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-600" />
            Pengalaman Kerja
          </h3>
          <p className="text-xs text-slate-500">
            Tuliskan riwayat karier mulai dari posisi paling terkini.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm"
          data-testid="btn-add-experience"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah Posisi
        </button>
      </div>

      {experiences.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
          <Briefcase className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Belum ada pengalaman kerja ditambahkan.</p>
          <button
            type="button"
            onClick={handleAdd}
            className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            + Tambah Pengalaman Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {experiences.map((exp, index) => (
            <div
              key={exp.id}
              className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm space-y-3 relative group"
              data-testid={`experience-item-${index}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                  Posisi #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(exp.id)}
                  className="text-slate-400 hover:text-red-600 p-1 rounded transition"
                  title="Hapus posisi ini"
                  data-testid={`btn-delete-experience-${index}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Posisi / Jabatan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Senior Backend Engineer"
                    value={exp.jobTitle}
                    onChange={e => handleUpdate(exp.id, 'jobTitle', e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    data-testid={`input-exp-title-${index}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Perusahaan <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Contoh: PT Teknologi Indonesia"
                      value={exp.company}
                      onChange={e => handleUpdate(exp.id, 'company', e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Lokasi Perusahaan</label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Contoh: Jakarta / Remote"
                      value={exp.location}
                      onChange={e => handleUpdate(exp.id, 'location', e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Periode Waktu</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Mulai (Jan 2022)"
                        value={exp.startDate}
                        onChange={e => handleUpdate(exp.id, 'startDate', e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder={exp.current ? 'Sekarang' : 'Selesai (Des 2024)'}
                        disabled={exp.current}
                        value={exp.current ? 'Sekarang' : exp.endDate}
                        onChange={e => handleUpdate(exp.id, 'endDate', e.target.value)}
                        className={`w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${
                          exp.current ? 'bg-slate-100 text-slate-500' : ''
                        }`}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exp.current}
                      onChange={e => handleUpdate(exp.id, 'current', e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-xs text-slate-600">Saya masih bekerja di posisi ini</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Deskripsi Tanggung Jawab & Pencapaian
                </label>
                <textarea
                  rows={4}
                  placeholder="• Memimpin pengembangan modul core berkapasitas 10.000 user harian...&#10;• Mengurangi latency kueri 30% menggunakan redis caching..."
                  value={exp.description}
                  onChange={e => handleUpdate(exp.id, 'description', e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-sans leading-relaxed"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
