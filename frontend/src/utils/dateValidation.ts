interface ParsedResumeDate {
  year: number
  month: number
}

const MONTHS: Record<string, number> = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  february: 2,
  mar: 3,
  maret: 3,
  march: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  agu: 8,
  agt: 8,
  agustus: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  des: 12,
  desember: 12,
  dec: 12,
  december: 12
}

const PRESENT_VALUES = new Set(['sekarang', 'present', 'current', 'saat ini'])

export const DATE_FORMAT_HINT = 'Gunakan format seperti Jan 2022, 2022, atau 2022-01.'

/**
 * Mengurai tanggal yang umum diketik pengguna. Mengembalikan null jika format
 * tidak dikenali. Tanggal "Sekarang" hanya valid sebagai akhir periode.
 */
export function parseResumeDate(value: string): ParsedResumeDate | null {
  const clean = value.trim().replace(/\s+/g, ' ')
  if (!clean) return null

  if (PRESENT_VALUES.has(clean.toLowerCase())) {
    return { year: 9999, month: 12 }
  }

  const numeric = clean.match(/^((?:19|20)\d{2})[-/](\d{1,2})$/)
  if (numeric) {
    const month = Number(numeric[2])
    if (month >= 1 && month <= 12) {
      return { year: Number(numeric[1]), month }
    }
    return null
  }

  const withMonth = clean.match(/^([A-Za-z]+)[\s,.-]+((?:19|20)\d{2})$/)
  if (withMonth) {
    const month = MONTHS[withMonth[1].toLowerCase()]
    if (month) return { year: Number(withMonth[2]), month }
    return null
  }

  const yearOnly = clean.match(/^((?:19|20)\d{2})$/)
  if (yearOnly) {
    return { year: Number(yearOnly[1]), month: 1 }
  }

  return null
}

export interface DateRangeValidation {
  startError?: string
  endError?: string
}

/**
 * Memvalidasi format dan urutan tanggal. Tanggal kosong tidak dianggap error
 * karena sebagian pengguna memang tidak mencantumkan periode.
 */
export function validateDateRange(
  startDate: string,
  endDate: string,
  current = false
): DateRangeValidation {
  const start = parseResumeDate(startDate)
  const end = parseResumeDate(endDate)

  if (startDate.trim() && !start) {
    return { startError: DATE_FORMAT_HINT }
  }
  if (current) return {}
  if (endDate.trim() && !end) {
    return { endError: DATE_FORMAT_HINT }
  }
  if (start && end && end.year < start.year) {
    return { endError: 'Tanggal selesai tidak boleh lebih awal daripada tanggal mulai.' }
  }
  if (start && end && end.year === start.year && end.month < start.month) {
    return { endError: 'Tanggal selesai tidak boleh lebih awal daripada tanggal mulai.' }
  }
  return {}
}
