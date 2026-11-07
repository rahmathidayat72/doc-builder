export type MascotEmotion =
  | 'senang'
  | 'sangat_senang'
  | 'tertawa'
  | 'berkedip'
  | 'semangat'
  | 'bangga'
  | 'terkejut'
  | 'bingung'
  | 'sedih'
  | 'kecewa'
  | 'marah'
  | 'cemas'
  | 'takut'
  | 'lelah'
  | 'sakit'
  | 'penasaran'
  | 'siap_membantu'
  | 'sapa_salam'

export interface EmotionMeta {
  row: number
  label: string
  durationMs: number
}

export const MASCOT_EMOTIONS: Record<MascotEmotion, EmotionMeta> = {
  senang: { row: 0, label: 'Senang', durationMs: 750 },
  sangat_senang: { row: 1, label: 'Sangat Senang', durationMs: 650 },
  tertawa: { row: 2, label: 'Tertawa', durationMs: 550 },
  berkedip: { row: 3, label: 'Berkedip', durationMs: 800 },
  semangat: { row: 4, label: 'Semangat', durationMs: 600 },
  bangga: { row: 5, label: 'Bangga', durationMs: 1100 },
  terkejut: { row: 6, label: 'Terkejut', durationMs: 700 },
  bingung: { row: 7, label: 'Bingung', durationMs: 1100 },
  sedih: { row: 8, label: 'Sedih', durationMs: 1400 },
  kecewa: { row: 9, label: 'Kecewa', durationMs: 1200 },
  marah: { row: 10, label: 'Marah', durationMs: 400 },
  cemas: { row: 11, label: 'Cemas', durationMs: 500 },
  takut: { row: 12, label: 'Takut', durationMs: 420 },
  lelah: { row: 13, label: 'Lelah', durationMs: 1500 },
  sakit: { row: 14, label: 'Sakit', durationMs: 1300 },
  penasaran: { row: 15, label: 'Penasaran', durationMs: 950 },
  siap_membantu: { row: 16, label: 'Siap Membantu', durationMs: 850 },
  sapa_salam: { row: 17, label: 'Sapa/Salam', durationMs: 750 },
}

export const ALL_MASCOT_EMOTIONS: MascotEmotion[] = Object.keys(
  MASCOT_EMOTIONS
) as MascotEmotion[]
