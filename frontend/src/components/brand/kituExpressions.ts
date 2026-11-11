import kituSenyum from '../../assets/kitu/kitu-senyum.webp'
import kituSemangat from '../../assets/kitu/kitu-semangat.webp'
import kituHore from '../../assets/kitu/kitu-hore.webp'
import kituSelesai from '../../assets/kitu/kitu-selesai.webp'
import kituFokus from '../../assets/kitu/kitu-fokus.webp'
import kituBerpikir from '../../assets/kitu/kitu-berpikir.webp'
import kituPenasaran from '../../assets/kitu/kitu-penasaran.webp'
import kituIde from '../../assets/kitu/kitu-ide.webp'
import kituKaget from '../../assets/kitu/kitu-kaget.webp'
import kituBingung from '../../assets/kitu/kitu-bingung.webp'
import kituKecewa from '../../assets/kitu/kitu-kecewa.webp'
import kituSedih from '../../assets/kitu/kitu-sedih.webp'
import kituTerimaKasih from '../../assets/kitu/kitu-terimakasih.webp'
import kituSiapMembantu from '../../assets/kitu/kitu-siapmembantu.webp'
import kituBuatCv from '../../assets/kitu/kitu-buatcv.webp'
import kituEditFoto from '../../assets/kitu/kitu-editfoto.webp'
import kituKonversi from '../../assets/kitu/kitu-konversi.webp'
import kituPendekkanUrl from '../../assets/kitu/kitu-pendekkanurl.webp'

/**
 * Aset ekspresi Kitu (transparan, dipotong dari Kitu_Expression_Sticker_Sheet.png
 * lewat scripts/extract_kitu_expressions.py). Nama mengikuti lembar stiker resmi.
 */
export const KITU_EXPRESSIONS = {
  senyum: kituSenyum,
  semangat: kituSemangat,
  hore: kituHore,
  selesai: kituSelesai,
  fokus: kituFokus,
  berpikir: kituBerpikir,
  penasaran: kituPenasaran,
  ide: kituIde,
  kaget: kituKaget,
  bingung: kituBingung,
  kecewa: kituKecewa,
  sedih: kituSedih,
  terimakasih: kituTerimaKasih,
  siapmembantu: kituSiapMembantu,
  buatcv: kituBuatCv,
  editfoto: kituEditFoto,
  konversi: kituKonversi,
  pendekkanurl: kituPendekkanUrl,
} as const

export type KituExpression = keyof typeof KITU_EXPRESSIONS
