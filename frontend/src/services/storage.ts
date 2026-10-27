import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { type ResumeDraft, type ResumeDraftSummary, ResumeDraftSchema } from '../types/resume'

const DB_NAME = 'docbuilder_db'
const DB_VERSION = 1

interface TrashEntry {
  id: string
  draft: ResumeDraft
  deletedAt: number
}

interface DocBuilderDBSchema extends DBSchema {
  drafts: {
    key: string
    value: ResumeDraft
    indexes: { 'by-updated': number }
  }
  trash: {
    key: string
    value: TrashEntry
    indexes: { 'by-deleted': number }
  }
  settings: {
    key: string
    value: { key: string; value: any }
  }
}

let dbPromise: Promise<IDBPDatabase<DocBuilderDBSchema>> | null = null

export function getDB(): Promise<IDBPDatabase<DocBuilderDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<DocBuilderDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store draft utama
        if (!db.objectStoreNames.contains('drafts')) {
          const draftStore = db.createObjectStore('drafts', { keyPath: 'id' })
          draftStore.createIndex('by-updated', 'updatedAt')
        }
        // Store trash sementara (untuk 10 detik undo delete)
        if (!db.objectStoreNames.contains('trash')) {
          const trashStore = db.createObjectStore('trash', { keyPath: 'id' })
          trashStore.createIndex('by-deleted', 'deletedAt')
        }
        // Store pengaturan & status privasi lokal
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
      }
    })
  }
  return dbPromise
}

const toSummary = (draft: ResumeDraft): ResumeDraftSummary => ({
  id: draft.id,
  title: draft.title,
  templateId: draft.templateId,
  updatedAt: draft.updatedAt,
  createdAt: draft.createdAt,
  favorite: Boolean(draft.favorite),
  targetJobTitle: draft.targetJob?.title || undefined
})

const sortSummaries = (left: ResumeDraftSummary, right: ResumeDraftSummary) =>
  Number(right.favorite) - Number(left.favorite) || right.updatedAt - left.updatedAt

export class ResumeStorage {
  private static inMemoryDrafts: Map<string, ResumeDraft> = new Map()

  /** Menyimpan atau memperbarui draft CV */
  static async saveDraft(draft: ResumeDraft): Promise<void> {
    const validated = ResumeDraftSchema.parse(draft)
    
    // Jika mode privat aktif, hanya simpan di memori sesi aktif
    const privateMode = await this.isPrivateMode()
    if (privateMode) {
      this.inMemoryDrafts.set(validated.id, validated)
      return
    }

    const db = await getDB()
    await db.put('drafts', validated)
  }

  /** Mengambil satu draft berdasarkan ID */
  static async getDraft(id: string): Promise<ResumeDraft | undefined> {
    const privateMode = await this.isPrivateMode()
    if (privateMode) {
      return this.inMemoryDrafts.get(id)
    }

    const db = await getDB()
    return db.get('drafts', id)
  }

  /** Mengambil daftar ringkasan draft terurut dari yang terbaru */
  static async listDrafts(): Promise<ResumeDraftSummary[]> {
    const privateMode = await this.isPrivateMode()
    if (privateMode) {
      return Array.from(this.inMemoryDrafts.values()).map(toSummary).sort(sortSummaries)
    }

    const db = await getDB()
    const all = await db.getAll('drafts')
    return all.map(toSummary).sort(sortSummaries)
  }

  /** Menghapus draft dengan opsi pemindahan ke tempat sampah sementara untuk undo */
  static async deleteDraft(id: string, allowUndo = true): Promise<void> {
    const privateMode = await this.isPrivateMode()
    if (privateMode) {
      this.inMemoryDrafts.delete(id)
      return
    }

    const db = await getDB()
    const draft = await db.get('drafts', id)
    if (!draft) return

    const tx = db.transaction(['drafts', 'trash'], 'readwrite')
    await tx.objectStore('drafts').delete(id)
    
    if (allowUndo) {
      await tx.objectStore('trash').put({
        id,
        draft,
        deletedAt: Date.now()
      })
    }
    await tx.done
  }

  /** Memulihkan draft dari tempat sampah sementara (Undo Delete) */
  static async restoreDraft(id: string): Promise<ResumeDraft | undefined> {
    const db = await getDB()
    const entry = await db.get('trash', id)
    if (!entry) return undefined

    const tx = db.transaction(['drafts', 'trash'], 'readwrite')
    await tx.objectStore('drafts').put(entry.draft)
    await tx.objectStore('trash').delete(id)
    await tx.done

    return entry.draft
  }

  /** Membersihkan trash yang sudah kedaluwarsa */
  static async purgeExpiredTrash(maxAgeMs = 60_000): Promise<void> {
    const db = await getDB()
    const cutoff = Date.now() - maxAgeMs
    const tx = db.transaction('trash', 'readwrite')
    const store = tx.objectStore('trash')
    const all = await store.getAll()
    for (const entry of all) {
      if (entry.deletedAt < cutoff) {
        await store.delete(entry.id)
      }
    }
    await tx.done
  }

  /** Menduplikasi draft yang ada */
  static async duplicateDraft(id: string): Promise<ResumeDraft> {
    const original = await this.getDraft(id)
    if (!original) {
      throw new Error(`Draft dengan ID ${id} tidak ditemukan.`)
    }

    const newId = crypto.randomUUID()
    const now = Date.now()
    const duplicated: ResumeDraft = {
      ...original,
      id: newId,
      title: `${original.title} (Salinan)`,
      favorite: false,
      createdAt: now,
      updatedAt: now
    }

    await this.saveDraft(duplicated)
    return duplicated
  }

  /** Mengganti nama draft */
  static async renameDraft(id: string, newTitle: string): Promise<void> {
    const cleanTitle = newTitle.trim()
    if (!cleanTitle) {
      throw new Error('Judul draft tidak boleh kosong.')
    }

    const draft = await this.getDraft(id)
    if (!draft) {
      throw new Error(`Draft dengan ID ${id} tidak ditemukan.`)
    }

    draft.title = cleanTitle
    draft.updatedAt = Date.now()
    await this.saveDraft(draft)
  }

  /** Menandai atau melepas draft favorit. */
  static async toggleFavorite(id: string): Promise<boolean> {
    const draft = await this.getDraft(id)
    if (!draft) {
      throw new Error(`Draft dengan ID ${id} tidak ditemukan.`)
    }

    draft.favorite = !draft.favorite
    await this.saveDraft(draft)
    return Boolean(draft.favorite)
  }

  /** Menghapus seluruh data lokal (Clear All Data / Data Privacy Reset) */
  static async clearAllData(): Promise<void> {
    this.inMemoryDrafts.clear()
    const db = await getDB()
    const tx = db.transaction(['drafts', 'trash', 'settings'], 'readwrite')
    await tx.objectStore('drafts').clear()
    await tx.objectStore('trash').clear()
    await tx.objectStore('settings').clear()
    await tx.done
  }

  /** Mengatur status Mode Privat */
  static async setPrivateMode(enabled: boolean): Promise<void> {
    const db = await getDB()
    await db.put('settings', { key: 'private_mode', value: enabled })
    if (enabled) {
      // Hapus data memori jika beralih
      this.inMemoryDrafts.clear()
    }
  }

  /** Memeriksa apakah Mode Privat aktif */
  static async isPrivateMode(): Promise<boolean> {
    try {
      const db = await getDB()
      const record = await db.get('settings', 'private_mode')
      return Boolean(record?.value)
    } catch {
      return false
    }
  }
}
