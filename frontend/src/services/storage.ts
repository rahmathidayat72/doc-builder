import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { type ResumeDraft, type ResumeDraftSummary, ResumeDraftSchema } from '../types/resume'

const DB_NAME = 'satukit_db'
const LEGACY_DB_NAME = 'docbuilder_db'
const DB_VERSION = 1

interface TrashEntry {
  id: string
  draft: ResumeDraft
  deletedAt: number
}

export interface SatukitDBSchema extends DBSchema {
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

/** Tipe alias untuk kompatibilitas kode lama */
export type DocBuilderDBSchema = SatukitDBSchema

let dbPromise: Promise<IDBPDatabase<SatukitDBSchema>> | null = null

/** Reset dan tutup koneksi DB untuk keperluan testing migrasi */
export async function resetDBPromise(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise
      db.close()
    } catch {
      // Abaikan
    }
  }
  dbPromise = null
}

/**
 * Melakukan migrasi salin draf secara aman (dual-read non-destructive)
 * dari IndexedDB legacy `docbuilder_db` ke `satukit_db` jika `satukit_db` masih kosong.
 */
async function migrateFromLegacyDB(targetDb: IDBPDatabase<SatukitDBSchema>): Promise<void> {
  const migrationRecord = await targetDb.get('settings', 'migrated_from_docbuilder')
  if (migrationRecord?.value) {
    return
  }

  const existingCount = await targetDb.count('drafts')
  if (existingCount > 0) {
    await targetDb.put('settings', { key: 'migrated_from_docbuilder', value: true })
    return
  }

  try {
    const legacyDb = await openDB(LEGACY_DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('drafts')) {
          const draftStore = db.createObjectStore('drafts', { keyPath: 'id' })
          draftStore.createIndex('by-updated', 'updatedAt')
        }
      }
    })
    if (legacyDb.objectStoreNames.contains('drafts')) {
      const legacyDrafts = await legacyDb.getAll('drafts')
      if (legacyDrafts.length > 0) {
        const tx = targetDb.transaction(['drafts', 'settings'], 'readwrite')
        for (const draft of legacyDrafts) {
          await tx.objectStore('drafts').put(draft)
        }
        await tx.objectStore('settings').put({ key: 'migrated_from_docbuilder', value: true })
        await tx.done
      }
    }
    legacyDb.close()
  } catch {
    // Database legacy tidak ada di browser pengguna baru
  }
}

export function getDB(): Promise<IDBPDatabase<SatukitDBSchema>> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDB<SatukitDBSchema>(DB_NAME, DB_VERSION, {
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

      try {
        await migrateFromLegacyDB(db)
      } catch (err) {
        console.warn('Gagal memigrasikan draf dari docbuilder_db:', err)
      }

      return db
    })()
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
  targetJobTitle: draft.targetJob?.title || undefined,
  expiresAt: draft.expiresAt,
  ownerId: draft.ownerId || 'anonymous'
})

const sortSummaries = (left: ResumeDraftSummary, right: ResumeDraftSummary) =>
  Number(right.favorite) - Number(left.favorite) || right.updatedAt - left.updatedAt

export class ResumeStorage {
  private static inMemoryDrafts: Map<string, ResumeDraft> = new Map()

  /** Menyimpan atau memperbarui draft CV */
  static async saveDraft(draft: ResumeDraft, ownerId = 'anonymous'): Promise<void> {
    const validated = ResumeDraftSchema.parse({
      ...draft,
      ownerId: draft.ownerId || ownerId,
    })
    
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
  static async getDraft(id: string, ownerId = 'anonymous'): Promise<ResumeDraft | undefined> {
    const privateMode = await this.isPrivateMode()
    if (privateMode) {
      const mem = this.inMemoryDrafts.get(id)
      if (mem && (mem.ownerId || 'anonymous') !== ownerId) return undefined
      return mem
    }

    const db = await getDB()
    const draft = await db.get('drafts', id)
    if (draft && (draft.ownerId || 'anonymous') !== ownerId) {
      return undefined
    }
    return draft
  }

  /** Mengambil daftar ringkasan draft terurut dari yang terbaru */
  static async listDrafts(ownerId = 'anonymous'): Promise<ResumeDraftSummary[]> {
    const privateMode = await this.isPrivateMode()
    if (privateMode) {
      return Array.from(this.inMemoryDrafts.values())
        .filter(d => (d.ownerId || 'anonymous') === ownerId)
        .map(toSummary)
        .sort(sortSummaries)
    }

    const db = await getDB()
    const all = await db.getAll('drafts')
    return all
      .filter(d => (d.ownerId || 'anonymous') === ownerId)
      .map(toSummary)
      .sort(sortSummaries)
  }

  /** Menghapus draft dengan opsi pemindahan ke tempat sampah sementara untuk undo */
  static async deleteDraft(id: string, allowUndo = true, ownerId = 'anonymous'): Promise<void> {
    const privateMode = await this.isPrivateMode()
    if (privateMode) {
      const mem = this.inMemoryDrafts.get(id)
      if (mem && (mem.ownerId || 'anonymous') === ownerId) {
        this.inMemoryDrafts.delete(id)
      }
      return
    }

    const db = await getDB()
    const draft = await db.get('drafts', id)
    if (!draft || (draft.ownerId || 'anonymous') !== ownerId) return

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
  static async restoreDraft(id: string, ownerId = 'anonymous'): Promise<ResumeDraft | undefined> {
    const db = await getDB()
    const entry = await db.get('trash', id)
    if (!entry || (entry.draft.ownerId || 'anonymous') !== ownerId) return undefined

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
  static async duplicateDraft(id: string, ownerId = 'anonymous'): Promise<ResumeDraft> {
    const original = await this.getDraft(id, ownerId)
    if (!original) {
      throw new Error(`Draft dengan ID ${id} tidak ditemukan.`)
    }

    const newId = crypto.randomUUID()
    const now = Date.now()
    const duplicated: ResumeDraft = {
      ...original,
      id: newId,
      ownerId,
      title: `${original.title} (Salinan)`,
      favorite: false,
      createdAt: now,
      updatedAt: now
    }

    await this.saveDraft(duplicated, ownerId)
    return duplicated
  }

  /** Mengganti nama draft */
  static async renameDraft(id: string, newTitle: string, ownerId = 'anonymous'): Promise<void> {
    const cleanTitle = newTitle.trim()
    if (!cleanTitle) {
      throw new Error('Judul draft tidak boleh kosong.')
    }

    const draft = await this.getDraft(id, ownerId)
    if (!draft) {
      throw new Error(`Draft dengan ID ${id} tidak ditemukan.`)
    }

    draft.title = cleanTitle
    draft.updatedAt = Date.now()
    await this.saveDraft(draft, ownerId)
  }

  /** Menandai atau melepas draft favorit. */
  static async toggleFavorite(id: string, ownerId = 'anonymous'): Promise<boolean> {
    const draft = await this.getDraft(id, ownerId)
    if (!draft) {
      throw new Error(`Draft dengan ID ${id} tidak ditemukan.`)
    }

    draft.favorite = !draft.favorite
    await this.saveDraft(draft, ownerId)
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

    // Bersihkan juga legacy database jika ada agar reset privasi menyeluruh
    try {
      const legacyDb = await openDB(LEGACY_DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('drafts')) {
            db.createObjectStore('drafts', { keyPath: 'id' })
          }
        }
      })
      if (legacyDb.objectStoreNames.contains('drafts')) {
        const txLegacy = legacyDb.transaction('drafts', 'readwrite')
        await txLegacy.objectStore('drafts').clear()
        await txLegacy.done
      }
      legacyDb.close()
    } catch {
      // Abaikan jika legacy DB tidak ada
    }
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
