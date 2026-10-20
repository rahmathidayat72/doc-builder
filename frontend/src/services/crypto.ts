import {
  type ProjectContainer,
  ProjectContainerSchema
} from '../types/project'
import {
  type ResumeDraft,
  ResumeDraftSchema
} from '../types/resume'

const PBKDF2_ITERATIONS = 100_000

// Helper konversi biner ke Base64 dan sebaliknya
function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// Derivasi kunci AES-GCM dari kata sandi via PBKDF2
async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password) as unknown as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export class ProjectCryptoService {
  /**
   * Mengemas draft CV ke dalam ProjectContainer (.docbuilder).
   * Jika parameter password diberikan, muatan dienkripsi dengan AES-GCM 256-bit.
   */
  static async exportProject(draft: ResumeDraft, password?: string): Promise<ProjectContainer> {
    const validatedDraft = ResumeDraftSchema.parse(draft)
    const now = Date.now()

    if (!password || password.trim() === '') {
      // Wadah polos tanpa enkripsi
      const container: ProjectContainer = {
        magic: 'DOCBUILDER_PROJECT',
        version: 1,
        encrypted: false,
        exportedAt: now,
        payload: validatedDraft
      }
      return ProjectContainerSchema.parse(container)
    }

    // Wadah terenkripsi
    const enc = new TextEncoder()
    const rawData = enc.encode(JSON.stringify(validatedDraft))

    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const key = await deriveKey(password, salt, PBKDF2_ITERATIONS)

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource
      },
      key,
      rawData as unknown as BufferSource
    )

    const container: ProjectContainer = {
      magic: 'DOCBUILDER_PROJECT',
      version: 1,
      encrypted: true,
      exportedAt: now,
      crypto: {
        algorithm: 'AES-GCM',
        salt: bufferToBase64(salt),
        iv: bufferToBase64(iv),
        iterations: PBKDF2_ITERATIONS
      },
      ciphertext: bufferToBase64(encryptedBuffer)
    }

    return ProjectContainerSchema.parse(container)
  }

  /**
   * Membuka dan mengekstrak draft CV dari ProjectContainer (.docbuilder).
   * Mengharuskan kata sandi jika berkas terenkripsi.
   */
  static async importProject(container: ProjectContainer, password?: string): Promise<ResumeDraft> {
    const validatedContainer = ProjectContainerSchema.parse(container)

    if (!validatedContainer.encrypted) {
      if (!validatedContainer.payload) {
        throw new Error('Berkas project tidak memuat data draft yang valid.')
      }
      return ResumeDraftSchema.parse(validatedContainer.payload)
    }

    // Berkas terenkripsi
    if (!password || password.trim() === '') {
      throw new Error('Kata sandi dibutuhkan untuk membuka berkas project terenkripsi ini.')
    }

    if (!validatedContainer.crypto || !validatedContainer.ciphertext) {
      throw new Error('Metadata enkripsi pada berkas project tidak lengkap.')
    }

    const salt = base64ToBuffer(validatedContainer.crypto.salt)
    const iv = base64ToBuffer(validatedContainer.crypto.iv)
    const ciphertext = base64ToBuffer(validatedContainer.ciphertext)

    const key = await deriveKey(
      password,
      salt,
      validatedContainer.crypto.iterations || PBKDF2_ITERATIONS
    )

    try {
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as unknown as BufferSource
        },
        key,
        ciphertext as unknown as BufferSource
      )

      const dec = new TextDecoder()
      const jsonString = dec.decode(decryptedBuffer)
      const parsed = JSON.parse(jsonString)
      return ResumeDraftSchema.parse(parsed)
    } catch {
      throw new Error('Gagal membuka project: Kata sandi salah atau berkas telah rusak/dimanipulasi.')
    }
  }

  /** Membuat Blob berkas .docbuilder untuk unduhan lokal */
  static createProjectBlob(container: ProjectContainer): Blob {
    const jsonStr = JSON.stringify(container, null, 2)
    return new Blob([jsonStr], { type: 'application/json' })
  }

  /** Mem-parsing teks JSON mentah dari input file menjadi ProjectContainer yang tervalidasi */
  static parseProjectJson(text: string): ProjectContainer {
    try {
      const parsed = JSON.parse(text)
      return ProjectContainerSchema.parse(parsed)
    } catch (err: any) {
      throw new Error(`Format berkas tidak valid sebagai berkas Doc-builder: ${err.message}`)
    }
  }
}
