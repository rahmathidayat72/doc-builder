import { apiFetch } from './apiClient'
import { type ResumeDraft, type ResumeDraftSummary } from '../types/resume'

export async function listDraftsApi(): Promise<ResumeDraftSummary[]> {
  const res = await apiFetch('/api/drafts', { method: 'GET' })
  if (!res.ok) {
    if (res.status === 401) return []
    throw new Error('Gagal memuat daftar draf akun dari server.')
  }
  return res.json()
}

export async function getDraftApi(id: string): Promise<ResumeDraft | null> {
  const res = await apiFetch(`/api/drafts/${encodeURIComponent(id)}`, { method: 'GET' })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error('Gagal memuat draf dari server.')
  }
  return res.json()
}

export async function createDraftApi(draft: ResumeDraft): Promise<ResumeDraft> {
  const res = await apiFetch('/api/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Gagal menyimpan draf ke akun.')
  }
  return res.json()
}

export async function updateDraftApi(id: string, draft: ResumeDraft): Promise<ResumeDraft> {
  const res = await apiFetch(`/api/drafts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Gagal memperbarui draf di akun.')
  }
  return res.json()
}

export async function saveDraftApi(draft: ResumeDraft): Promise<ResumeDraft> {
  // Coba update terlebih dahulu; jika belum ada di database, buat baru via POST
  try {
    return await updateDraftApi(draft.id, draft)
  } catch (err: any) {
    if (err.message && err.message.toLowerCase().includes('tidak ditemukan')) {
      return await createDraftApi(draft)
    }
    throw err
  }
}

export async function softDeleteDraftApi(id: string): Promise<void> {
  const res = await apiFetch(`/api/drafts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Gagal memindahkan draf ke tempat sampah.')
  }
}

export async function restoreDraftApi(id: string): Promise<ResumeDraft | null> {
  const res = await apiFetch(`/api/drafts/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Gagal membatalkan penghapusan draf.')
  }
  return res.json()
}

export async function hardDeleteDraftApi(id: string): Promise<void> {
  await apiFetch(`/api/drafts/${encodeURIComponent(id)}/permanent`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  })
}
