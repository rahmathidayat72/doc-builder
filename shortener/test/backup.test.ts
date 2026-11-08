import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {
  verifySnapshotContent,
  rotateSnapshots,
  executeD1Backup,
  RETENTION_LIMITS,
} from '../scripts/backup-d1.mjs'

describe('D1 Rolling Backup & Retention Suite (FR-048 / TASK-12.3)', () => {
  let tempBaseDir: string

  beforeEach(async () => {
    tempBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'd1-backup-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempBaseDir, { recursive: true, force: true })
  })

  it('verifySnapshotContent memvalidasi keabsahan format SQL dump', () => {
    const validDumps = [
      '-- D1 Database Export\nCREATE TABLE urls (id INTEGER);',
      'INSERT INTO urls VALUES (1, "slug", "https://example.com");',
      'PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;',
    ]

    for (const dump of validDumps) {
      expect(verifySnapshotContent(dump)).toBe(true)
    }

    const invalidDumps = ['', '   ', 'Bukan format SQL', 'ERROR 500: Database failed']

    for (const dump of invalidDumps) {
      expect(verifySnapshotContent(dump)).toBe(false)
    }
  })

  it('menegakkan retensi mingguan: mempertahankan maks 8 snapshot dan menghapus yang berlebih', async () => {
    const weeklyDir = path.join(tempBaseDir, 'weekly')
    await fs.mkdir(weeklyDir, { recursive: true })

    // Buat 10 file snapshot dummy (20261101 s/d 20261110)
    for (let i = 1; i <= 10; i++) {
      const day = String(i).padStart(2, '0')
      const filename = `d1_snapshot_202611${day}_000000.sql`
      await fs.writeFile(
        path.join(weeklyDir, filename),
        `-- Snapshot day ${day}\nCREATE TABLE t (id INT);`
      )
    }

    // Jalankan rotasi dengan batas weekly (8)
    const result = await rotateSnapshots(weeklyDir, RETENTION_LIMITS.weekly)

    expect(result.remaining).toBe(8)
    expect(result.deleted.length).toBe(2)
    // Dua file tertua harus terhapus
    expect(result.deleted).toEqual([
      'd1_snapshot_20261101_000000.sql',
      'd1_snapshot_20261102_000000.sql',
    ])

    // Periksa file yang tersisa di disk
    const remainingFiles = await fs.readdir(weeklyDir)
    expect(remainingFiles.length).toBe(8)
    expect(remainingFiles).not.toContain('d1_snapshot_20261101_000000.sql')
    expect(remainingFiles).not.toContain('d1_snapshot_20261102_000000.sql')
    expect(remainingFiles).toContain('d1_snapshot_20261110_000000.sql')
  })

  it('menegakkan retensi bulanan: mempertahankan maks 12 snapshot dan menghapus yang berlebih', async () => {
    const monthlyDir = path.join(tempBaseDir, 'monthly')
    await fs.mkdir(monthlyDir, { recursive: true })

    // Buat 15 file snapshot bulanan dummy
    for (let i = 1; i <= 15; i++) {
      const num = String(i).padStart(2, '0')
      const filename = `d1_snapshot_2025${num}01_000000.sql`
      await fs.writeFile(
        path.join(monthlyDir, filename),
        `-- Snapshot month ${num}\nCREATE TABLE t (id INT);`
      )
    }

    // Jalankan rotasi dengan batas monthly (12)
    const result = await rotateSnapshots(monthlyDir, RETENTION_LIMITS.monthly)

    expect(result.remaining).toBe(12)
    expect(result.deleted.length).toBe(3)
    expect(result.deleted).toEqual([
      'd1_snapshot_20250101_000000.sql',
      'd1_snapshot_20250201_000000.sql',
      'd1_snapshot_20250301_000000.sql',
    ])

    const remainingFiles = await fs.readdir(monthlyDir)
    expect(remainingFiles.length).toBe(12)
    expect(remainingFiles).toContain('d1_snapshot_20251501_000000.sql')
  })

  it('executeD1Backup berhasil mengekspor snapshot baru dan memverifikasi integritasnya', async () => {
    const validMockSql = `-- D1 SQL Backup Export\nCREATE TABLE urls (id INT PRIMARY KEY);\nINSERT INTO urls VALUES (1);`

    const res = await executeD1Backup({
      tier: 'weekly',
      baseDir: tempBaseDir,
      databaseName: 'test_db',
      mockContent: validMockSql,
    })

    expect(res.success).toBe(true)
    expect(res.tier).toBe('weekly')
    expect(res.remainingSnapshots).toBe(1)
    expect(res.deletedSnapshots.length).toBe(0)

    // Periksa file ada di disk dan kontennya sesuai
    const fileContent = await fs.readFile(res.filePath, 'utf-8')
    expect(fileContent).toContain('CREATE TABLE urls')
  })

  it('executeD1Backup membatalkan dan menghapus file jika konten snapshot korup / tidak valid', async () => {
    const brokenSql = 'ERROR: could not dump database'

    await expect(
      executeD1Backup({
        tier: 'weekly',
        baseDir: tempBaseDir,
        databaseName: 'test_db',
        mockContent: brokenSql,
      })
    ).rejects.toThrow('Integritas snapshot SQL tidak valid')

    // Direktori weekly harus kosong (file yang gagal harus sudah dibersihkan)
    const weeklyFiles = await fs.readdir(path.join(tempBaseDir, 'weekly'))
    expect(weeklyFiles.length).toBe(0)
  })
})
