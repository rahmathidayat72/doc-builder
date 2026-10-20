import { describe, it, expect, beforeEach } from 'vitest'
import { ResumeStorage } from '../storage'
import { type ResumeDraft, createEmptyResumeData } from '../../types/resume'

describe('ResumeStorage Service (IndexedDB & Local Persistence)', () => {
  beforeEach(async () => {
    await ResumeStorage.clearAllData()
    await ResumeStorage.setPrivateMode(false)
  })

  const createSampleDraft = (id: string, title: string): ResumeDraft => ({
    id,
    title,
    templateId: 'ats-clean',
    colorTheme: '#1e293b',
    fontFamily: 'sans',
    data: {
      ...createEmptyResumeData(),
      contact: {
        fullName: 'Budi Santoso',
        email: 'budi@example.com',
        phone: '08123456789',
        location: 'Jakarta',
        linkedin: '',
        website: ''
      }
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1
  })

  it('berhasil menyimpan dan mengambil draft CV dari IndexedDB', async () => {
    const draft = createSampleDraft('11111111-1111-4111-8111-111111111111', 'CV Software Engineer')
    await ResumeStorage.saveDraft(draft)

    const retrieved = await ResumeStorage.getDraft(draft.id)
    expect(retrieved).toBeDefined()
    expect(retrieved?.id).toBe(draft.id)
    expect(retrieved?.title).toBe('CV Software Engineer')
    expect(retrieved?.data.contact.fullName).toBe('Budi Santoso')
  })

  it('mengembalikan daftar draft terurut berdasarkan updatedAt terbaru', async () => {
    const draft1 = createSampleDraft('11111111-1111-4111-8111-111111111111', 'Draft Pertama')
    draft1.updatedAt = 1000
    const draft2 = createSampleDraft('22222222-2222-4222-8222-222222222222', 'Draft Kedua')
    draft2.updatedAt = 2000

    await ResumeStorage.saveDraft(draft1)
    await ResumeStorage.saveDraft(draft2)

    const list = await ResumeStorage.listDrafts()
    expect(list).toHaveLength(2)
    expect(list[0].id).toBe(draft2.id) // Draft terbaru di posisi teratas
    expect(list[1].id).toBe(draft1.id)
  })

  it('dapat mengganti nama draft dan menduplikasi draft dengan ID baru', async () => {
    const draft = createSampleDraft('11111111-1111-4111-8111-111111111111', 'Draft Asli')
    await ResumeStorage.saveDraft(draft)

    await ResumeStorage.renameDraft(draft.id, 'Draft Ganti Nama')
    const renamed = await ResumeStorage.getDraft(draft.id)
    expect(renamed?.title).toBe('Draft Ganti Nama')

    const dup = await ResumeStorage.duplicateDraft(draft.id)
    expect(dup.id).not.toBe(draft.id)
    expect(dup.title).toBe('Draft Ganti Nama (Salinan)')
    expect(dup.data.contact.fullName).toBe('Budi Santoso')

    const list = await ResumeStorage.listDrafts()
    expect(list).toHaveLength(2)
  })

  it('dapat menghapus draft dan memulihkannya kembali (Undo Delete)', async () => {
    const draft = createSampleDraft('11111111-1111-4111-8111-111111111111', 'Draft Untuk Dihapus')
    await ResumeStorage.saveDraft(draft)

    // Hapus dengan allowUndo = true
    await ResumeStorage.deleteDraft(draft.id, true)

    let list = await ResumeStorage.listDrafts()
    expect(list).toHaveLength(0)

    // Pulihkan draft (Undo)
    const restored = await ResumeStorage.restoreDraft(draft.id)
    expect(restored).toBeDefined()
    expect(restored?.id).toBe(draft.id)

    list = await ResumeStorage.listDrafts()
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('Draft Untuk Dihapus')
  })

  it('mode privat tidak menyimpan data secara persisten ke IndexedDB', async () => {
    await ResumeStorage.setPrivateMode(true)
    const draft = createSampleDraft('11111111-1111-4111-8111-111111111111', 'Draft Rahasia')
    await ResumeStorage.saveDraft(draft)

    // Tersedia di sesi aktif
    const retrieved = await ResumeStorage.getDraft(draft.id)
    expect(retrieved?.title).toBe('Draft Rahasia')

    // Beralih mematikan mode privat harus membuktikan IndexedDB kosong
    await ResumeStorage.setPrivateMode(false)
    const fromDB = await ResumeStorage.getDraft(draft.id)
    expect(fromDB).toBeUndefined()
  })

  it('clearAllData menghapus seluruh data dan pengaturan lokal', async () => {
    const draft = createSampleDraft('11111111-1111-4111-8111-111111111111', 'Draft Sample')
    await ResumeStorage.saveDraft(draft)

    await ResumeStorage.clearAllData()
    const list = await ResumeStorage.listDrafts()
    expect(list).toHaveLength(0)
  })
})
