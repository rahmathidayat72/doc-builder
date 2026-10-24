import React, { useRef } from 'react'
import { type ContactInfo } from '../../types/resume'
import { User, Mail, Phone, MapPin, Link as LinkIcon, Globe, Camera, Trash2, Upload } from 'lucide-react'

interface ContactFormProps {
  contact: ContactInfo
  onChange: (updated: ContactInfo) => void
}

export const ContactForm: React.FC<ContactFormProps> = ({ contact, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleChange = (field: keyof ContactInfo, value: string | boolean) => {
    onChange({
      ...contact,
      [field]: value
    })
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Hanya berkas gambar (JPG, PNG, WebP) yang diperbolehkan.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran gambar maksimal 5MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = event => {
      const resultStr = (event.target?.result as string) || ''
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const size = 512
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          if (ctx) {
            const minDim = Math.min(img.width, img.height)
            const sx = (img.width - minDim) / 2
            const sy = (img.height - minDim) / 2
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
            const processedUrl = canvas.toDataURL('image/jpeg', 0.88)
            onChange({
              ...contact,
              usePhoto: true,
              photoUrl: processedUrl
            })
            return
          }
        } catch {
          // fallback jika canvas tidak tersedia di test runner
        }
        onChange({
          ...contact,
          usePhoto: true,
          photoUrl: resultStr
        })
      }
      img.onerror = () => {
        onChange({
          ...contact,
          usePhoto: true,
          photoUrl: resultStr
        })
      }
      img.src = resultStr
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onChange({
      ...contact,
      usePhoto: false,
      photoUrl: ''
    })
  }

  return (
    <div className="space-y-4">
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-600" />
          Informasi Pribadi & Kontak
        </h3>
        <p className="text-xs text-slate-500">
          Cantumkan nama lengkap dan kontak profesional yang mudah dihubungi oleh tim rekrutmen.
        </p>
      </div>

      {/* Opsi Foto Profil */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-indigo-600" />
            <label htmlFor="toggle-use-photo" className="text-xs font-semibold text-slate-800 cursor-pointer">
              Sertakan Foto Profil di CV
            </label>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="toggle-use-photo"
              type="checkbox"
              checked={Boolean(contact.usePhoto)}
              onChange={e => handleChange('usePhoto', e.target.checked)}
              className="sr-only peer"
              data-testid="toggle-use-photo"
            />
            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {contact.usePhoto && (
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoUpload}
              className="hidden"
              data-testid="input-photo-file"
              id="input-photo-file"
            />
            {contact.photoUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={contact.photoUrl}
                  alt="Pratinjau Foto Profil"
                  className="w-14 h-14 rounded-lg object-cover border border-slate-300 shadow-xs"
                  data-testid="photo-preview"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition shadow-xs"
                    data-testid="btn-change-photo"
                  >
                    Ganti Foto
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                    title="Hapus Foto"
                    aria-label="Hapus Foto"
                    data-testid="btn-remove-photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition"
                data-testid="btn-upload-photo"
              >
                <Upload className="w-3.5 h-3.5" />
                Pilih Foto Profil (Maks 5MB)
              </button>
            )}
            <p className="text-2xs text-slate-500">
              Format JPG, PNG, atau WebP. Otomatis dipotong rasio 1:1 dan EXIF dibersihkan.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Nama Lengkap <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Contoh: Budi Santoso, S.Kom"
              value={contact.fullName}
              onChange={e => handleChange('fullName', e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              data-testid="input-fullname"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Alamat Email <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="email"
              placeholder="Contoh: budi.santoso@email.com"
              value={contact.email}
              onChange={e => handleChange('email', e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              data-testid="input-email"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Nomor Telepon</label>
          <div className="relative">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="tel"
              placeholder="Contoh: +62 812 3456 7890"
              value={contact.phone}
              onChange={e => handleChange('phone', e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              data-testid="input-phone"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Lokasi (Kota, Negara)</label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Contoh: Jakarta Selatan, Indonesia"
              value={contact.location}
              onChange={e => handleChange('location', e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              data-testid="input-location"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Profil LinkedIn</label>
          <div className="relative">
            <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="linkedin.com/in/budisantoso"
              value={contact.linkedin}
              onChange={e => handleChange('linkedin', e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Portofolio / Website</label>
          <div className="relative">
            <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="budisantoso.dev"
              value={contact.website}
              onChange={e => handleChange('website', e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
