#!/usr/bin/env node
/**
 * Script Cadangan Snapshot SQLite D1 Bergulir (Rolling D1 Backup)
 * Menegakkan standar FR-048 poin 5:
 * - Cadangan Mingguan (weekly): retensi 8 minggu (maks 8 snapshot)
 * - Cadangan Bulanan (monthly): retensi 12 bulan (maks 12 snapshot)
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export const RETENTION_LIMITS = {
  weekly: 8,
  monthly: 12,
}

export function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const min = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`
}

export function verifySnapshotContent(content) {
  if (!content || typeof content !== 'string') return false
  if (content.trim().length === 0) return false

  const lower = content.toLowerCase()
  // Validasi minimal ada elemen SQL
  return (
    lower.includes('create table') ||
    lower.includes('insert into') ||
    lower.includes('sqlite_sequence') ||
    lower.includes('pragma') ||
    content.startsWith('--')
  )
}

export async function rotateSnapshots(dirPath, maxRetention) {
  await fs.mkdir(dirPath, { recursive: true })

  const entries = await fs.readdir(dirPath)
  const snapshotFiles = entries
    .filter((f) => /^d1_snapshot_\d{8}_\d{6}\.sql$/.test(f))
    .sort() // Urutan leksikografis menempatkan snapshot terlama di awal

  const deletedFiles = []
  if (snapshotFiles.length > maxRetention) {
    const excessCount = snapshotFiles.length - maxRetention
    const filesToRemove = snapshotFiles.slice(0, excessCount)

    for (const f of filesToRemove) {
      await fs.unlink(path.join(dirPath, f))
      deletedFiles.push(f)
    }
  }

  return {
    remaining: snapshotFiles.length - deletedFiles.length,
    deleted: deletedFiles,
  }
}

/**
 * @param {object} [options]
 * @param {'weekly'|'monthly'} [options.tier]
 * @param {string} [options.baseDir]
 * @param {string} [options.databaseName]
 * @param {string|null} [options.mockContent]
 */
export async function executeD1Backup({
  tier = 'weekly',
  baseDir = path.resolve(process.cwd(), 'backups'),
  databaseName = 'docbuilder_shortener_db',
  mockContent = null,
} = {}) {
  const maxRetention = RETENTION_LIMITS[tier] || RETENTION_LIMITS.weekly
  const tierDir = path.join(baseDir, tier)
  await fs.mkdir(tierDir, { recursive: true })

  const timestamp = formatTimestamp()
  const filename = `d1_snapshot_${timestamp}.sql`
  const targetPath = path.join(tierDir, filename)

  if (mockContent !== null) {
    // Mode simulasi/testing
    await fs.writeFile(targetPath, mockContent, 'utf-8')
  } else {
    // Mode produksi via Wrangler CLI
    const cmd = `npx wrangler d1 export ${databaseName} --remote --output="${targetPath}"`
    console.log(`[D1 Backup] Menjalankan: ${cmd}`)
    try {
      await execAsync(cmd)
    } catch (err) {
      throw new Error(`Gagal mengeksekusi wrangler d1 export: ${err.message}`)
    }
  }

  // Verifikasi integritas snapshot
  const content = await fs.readFile(targetPath, 'utf-8')
  if (!verifySnapshotContent(content)) {
    await fs.unlink(targetPath).catch(() => {})
    throw new Error('Integritas snapshot SQL tidak valid atau file kosong.')
  }

  // Terapkan rotasi retensi
  const rotation = await rotateSnapshots(tierDir, maxRetention)

  return {
    success: true,
    tier,
    filePath: targetPath,
    filename,
    remainingSnapshots: rotation.remaining,
    deletedSnapshots: rotation.deleted,
  }
}

// Eksekusi CLI langsung jika file dijalankan sebagai script utama
if (process.argv[1] && process.argv[1].endsWith('backup-d1.mjs')) {
  const args = process.argv.slice(2)
  const tierArg = args.find((a) => a.startsWith('--tier='))
  const tier = tierArg ? tierArg.split('=')[1] : 'weekly'

  executeD1Backup({ tier })
    .then((res) => {
      console.log(`✅ [D1 Backup] Sukses membuat snapshot ${res.tier}: ${res.filename}`)
      console.log(`   Tersimpan: ${res.remainingSnapshots} snapshot`)
      if (res.deletedSnapshots.length > 0) {
        console.log(`   Rotasi menghapus: ${res.deletedSnapshots.join(', ')}`)
      }
    })
    .catch((err) => {
      console.error(`❌ [D1 Backup] Gagal:`, err.message)
      process.exit(1)
    })
}
