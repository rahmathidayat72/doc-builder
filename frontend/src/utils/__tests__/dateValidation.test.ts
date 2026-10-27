import { describe, expect, it } from 'vitest'
import {
  DATE_FORMAT_HINT,
  parseResumeDate,
  validateDateRange
} from '../dateValidation'

describe('parseResumeDate', () => {
  it('mengurai format bulan-tahun, tahun saja, dan numerik', () => {
    expect(parseResumeDate('Jan 2022')).toEqual({ year: 2022, month: 1 })
    expect(parseResumeDate('Januari 2022')).toEqual({ year: 2022, month: 1 })
    expect(parseResumeDate('2022')).toEqual({ year: 2022, month: 1 })
    expect(parseResumeDate('2022-07')).toEqual({ year: 2022, month: 7 })
    expect(parseResumeDate('Des 2024')).toEqual({ year: 2024, month: 12 })
  })

  it('menganggap label sekarang sebagai tanggal akhir terbuka', () => {
    expect(parseResumeDate('Sekarang')).toEqual({ year: 9999, month: 12 })
    expect(parseResumeDate('present')).toEqual({ year: 9999, month: 12 })
  })

  it('menolak format yang tidak dikenal', () => {
    expect(parseResumeDate('')).toBeNull()
    expect(parseResumeDate('07/2022/01')).toBeNull()
    expect(parseResumeDate('2022-13')).toBeNull()
    expect(parseResumeDate('Foo 2022')).toBeNull()
  })
})

describe('validateDateRange', () => {
  it('menerima rentang tanggal valid', () => {
    expect(validateDateRange('Jan 2020', 'Des 2021')).toEqual({})
    expect(validateDateRange('2020', '2021')).toEqual({})
  })

  it('menampilkan error format pada tanggal mulai yang salah', () => {
    expect(validateDateRange('Januari lalu', '2024')).toEqual({
      startError: DATE_FORMAT_HINT
    })
  })

  it('menolak tanggal selesai yang lebih awal', () => {
    expect(validateDateRange('Jul 2022', 'Jun 2022')).toEqual({
      endError: 'Tanggal selesai tidak boleh lebih awal daripada tanggal mulai.'
    })
    expect(validateDateRange('2023', '2021')).toEqual({
      endError: 'Tanggal selesai tidak boleh lebih awal daripada tanggal mulai.'
    })
  })

  it('mengabaikan tanggal selesai saat status masih bekerja aktif', () => {
    expect(validateDateRange('Jan 2022', 'format salah', true)).toEqual({})
  })

  it('membiarkan periode kosong untuk kompatibilitas draft lama', () => {
    expect(validateDateRange('', '')).toEqual({})
  })
})
