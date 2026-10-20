import React from 'react'
import { type ContactInfo } from '../../types/resume'
import { User, Mail, Phone, MapPin, Link as LinkIcon, Globe } from 'lucide-react'

interface ContactFormProps {
  contact: ContactInfo
  onChange: (updated: ContactInfo) => void
}

export const ContactForm: React.FC<ContactFormProps> = ({ contact, onChange }) => {
  const handleChange = (field: keyof ContactInfo, value: string) => {
    onChange({
      ...contact,
      [field]: value
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
