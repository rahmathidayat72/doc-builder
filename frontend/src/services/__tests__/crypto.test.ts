import { describe, it, expect } from 'vitest'
import { ProjectCryptoService } from '../crypto'
import { type ResumeDraft, createEmptyResumeData } from '../../types/resume'

describe('ProjectCryptoService (Web Crypto AES-GCM & Project Container)', () => {
  const sampleDraft: ResumeDraft = {
    id: '33333333-3333-4333-8333-333333333333',
    title: 'CV Lead Architect',
    templateId: 'ats-modern',
    colorTheme: '#0f172a',
    fontFamily: 'serif',
    resumeLanguage: 'id',
    data: {
      ...createEmptyResumeData(),
      contact: {
        fullName: 'Hendra Wijaya',
        email: 'hendra.wijaya@example.com',
        phone: '+6281299998888',
        location: 'Bandung, Indonesia',
        linkedin: 'linkedin.com/in/hendrawijaya',
        website: 'https://hendra.dev'
      },
      summary: 'Senior Architect dengan spesialisasi sistem terdistribusi dan privasi data.'
    },
    createdAt: 1700000000000,
    updatedAt: 1700000050000,
    version: 1
  }

  it('berhasil ekspor dan impor project tanpa enkripsi (plain project)', async () => {
    const container = await ProjectCryptoService.exportProject(sampleDraft)
    expect(container.magic).toBe('DOCBUILDER_PROJECT')
    expect(container.encrypted).toBe(false)
    expect(container.payload).toBeDefined()
    expect(container.ciphertext).toBeUndefined()

    // Impor kembali
    const imported = await ProjectCryptoService.importProject(container)
    expect(imported.id).toBe(sampleDraft.id)
    expect(imported.title).toBe('CV Lead Architect')
    expect(imported.data.contact.fullName).toBe('Hendra Wijaya')
  })

  it('berhasil ekspor dan impor project terenkripsi AES-GCM dengan password yang benar', async () => {
    const password = 'SuperSecretPassword#2026!'
    const container = await ProjectCryptoService.exportProject(sampleDraft, password)

    expect(container.magic).toBe('DOCBUILDER_PROJECT')
    expect(container.encrypted).toBe(true)
    expect(container.payload).toBeUndefined()
    expect(container.ciphertext).toBeDefined()
    expect(container.crypto?.algorithm).toBe('AES-GCM')
    expect(container.crypto?.salt).toBeDefined()
    expect(container.crypto?.iv).toBeDefined()

    // Impor dengan password benar
    const imported = await ProjectCryptoService.importProject(container, password)
    expect(imported.id).toBe(sampleDraft.id)
    expect(imported.data.contact.fullName).toBe('Hendra Wijaya')
    expect(imported.data.summary).toContain('Senior Architect')
  })

  it('menolak impor project terenkripsi jika password salah', async () => {
    const password = 'CorrectPassword123'
    const wrongPassword = 'WrongPassword456'
    const container = await ProjectCryptoService.exportProject(sampleDraft, password)

    await expect(
      ProjectCryptoService.importProject(container, wrongPassword)
    ).rejects.toThrow('Kata sandi salah')
  })

  it('menolak impor jika berkas terenkripsi dibuka tanpa menyertakan password', async () => {
    const container = await ProjectCryptoService.exportProject(sampleDraft, 'Secret123')

    await expect(
      ProjectCryptoService.importProject(container)
    ).rejects.toThrow('Kata sandi dibutuhkan')
  })

  it('menolak impor jika ciphertext dimanipulasi atau rusak', async () => {
    const password = 'ValidPassword123'
    const container = await ProjectCryptoService.exportProject(sampleDraft, password)

    // Manipulasi isi ciphertext (merusak integritas auth tag AES-GCM)
    const corruptedContainer = {
      ...container,
      ciphertext: 'AAAA' + container.ciphertext?.slice(4)
    }

    await expect(
      ProjectCryptoService.importProject(corruptedContainer, password)
    ).rejects.toThrow('rusak/dimanipulasi')
  })

  it('parseProjectJson memvalidasi struktur dan menolak JSON yang bukan format Doc-builder', () => {
    const invalidJson = JSON.stringify({ foo: 'bar', random: 123 })
    expect(() => ProjectCryptoService.parseProjectJson(invalidJson)).toThrow(
      'Format berkas tidak valid'
    )
  })

  it('createProjectBlob menghasilkan objek Blob dengan tipe application/json', async () => {
    const container = await ProjectCryptoService.exportProject(sampleDraft)
    const blob = ProjectCryptoService.createProjectBlob(container)

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/json')
    expect(blob.size).toBeGreaterThan(100)
  })
})
