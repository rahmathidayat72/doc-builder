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
    resumeLanguage: 'id',
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

  it('mempertahankan website legacy pada draft lama tanpa field websites', async () => {
    const draft = createSampleDraft(
      '33333333-3333-4333-8333-333333333333',
      'Draft Website Legacy'
    )
    draft.data.contact.website = 'legacy.dev'
    delete draft.data.contact.websites

    await ResumeStorage.saveDraft(draft)
    const retrieved = await ResumeStorage.getDraft(draft.id)

    expect(retrieved?.data.contact.website).toBe('legacy.dev')
    expect(retrieved?.data.contact.websites).toBeUndefined()
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

  it('berhasil menyimpan draft kosong baru (createEmptyResumeData) tanpa error validasi', async () => {
    const emptyDraft: ResumeDraft = {
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Resume Baru',
      templateId: 'ats-clean',
      colorTheme: '#1e293b',
      fontFamily: 'sans',
      resumeLanguage: 'id',
      data: createEmptyResumeData(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    }

    await expect(ResumeStorage.saveDraft(emptyDraft)).resolves.not.toThrow()
    const loaded = await ResumeStorage.getDraft(emptyDraft.id)
    expect(loaded).toBeDefined()
    expect(loaded?.data.contact.fullName).toBe('')
  })

  it('berhasil menyimpan draft saat item pengalaman, pendidikan, dan bahasa masih kosong', async () => {
    const incompleteDraft: ResumeDraft = {
      id: '44444444-4444-4444-8444-444444444444',
      title: 'Draft Dalam Pengerjaan',
      templateId: 'ats-clean',
      colorTheme: '#1e293b',
      fontFamily: 'sans',
      resumeLanguage: 'id',
      data: {
        ...createEmptyResumeData(),
        experiences: [
          {
            id: 'exp-1',
            jobTitle: '',
            company: '',
            location: '',
            startDate: '',
            endDate: '',
            current: false,
            description: ''
          }
        ],
        education: [
          {
            id: 'edu-1',
            institution: '',
            degree: '',
            fieldOfStudy: '',
            startDate: '',
            endDate: '',
            gpa: '',
            description: ''
          }
        ],
        languages: [
          {
            id: 'lang-1',
            language: '',
            proficiency: 'Professional'
          }
        ]
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    }

    await expect(ResumeStorage.saveDraft(incompleteDraft)).resolves.not.toThrow()
    const loaded = await ResumeStorage.getDraft(incompleteDraft.id)
    expect(loaded?.data.experiences).toHaveLength(1)
    expect(loaded?.data.education).toHaveLength(1)
    expect(loaded?.data.languages).toHaveLength(1)
  })

  it('menyimpan favorit, menaruhnya di atas daftar, dan mempertahankan target lowongan', async () => {
    const older = createSampleDraft(
      '55555555-5555-4555-8555-555555555555',
      'Draft Lama'
    )
    older.updatedAt = 100
    older.targetJob = {
      title: 'Backend Engineer',
      company: 'PT Target',
      description: 'Python dan FastAPI',
      matchedSkills: ['python'],
      createdAt: 1
    }

    const newer = createSampleDraft(
      '66666666-6666-4666-8666-666666666666',
      'Draft Baru'
    )
    newer.updatedAt = 200

    await ResumeStorage.saveDraft(older)
    await ResumeStorage.saveDraft(newer)

    expect((await ResumeStorage.listDrafts())[0].title).toBe('Draft Baru')

    await ResumeStorage.toggleFavorite(older.id)
    const list = await ResumeStorage.listDrafts()
    expect(list[0]).toMatchObject({
      title: 'Draft Lama',
      favorite: true,
      targetJobTitle: 'Backend Engineer'
    })

    await ResumeStorage.toggleFavorite(older.id)
    expect((await ResumeStorage.listDrafts())[0].title).toBe('Draft Baru')
  })

  it('duplikasi draft mereset favorit dan menolak judul kosong', async () => {
    const draft = createSampleDraft(
      '77777777-7777-4777-8777-777777777777',
      'Draft Utama'
    )
    draft.favorite = true
    await ResumeStorage.saveDraft(draft)

    const duplicated = await ResumeStorage.duplicateDraft(draft.id)
    expect(duplicated.title).toBe('Draft Utama (Salinan)')
    expect(duplicated.favorite).toBe(false)

    await expect(ResumeStorage.renameDraft(draft.id, '   ')).rejects.toThrow(
      'Judul draft tidak boleh kosong.'
    )
  })
})
