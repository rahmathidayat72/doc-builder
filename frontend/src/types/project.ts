import { z } from 'zod'
import { ResumeDraftSchema } from './resume'

export const CryptoMetadataSchema = z.object({
  algorithm: z.literal('AES-GCM'),
  salt: z.string(), // Base64
  iv: z.string(), // Base64
  iterations: z.number().default(100_000)
})

export const ProjectContainerSchema = z.object({
  magic: z.literal('DOCBUILDER_PROJECT'),
  version: z.number().default(1),
  encrypted: z.boolean(),
  exportedAt: z.number(),
  payload: ResumeDraftSchema.optional(),
  crypto: CryptoMetadataSchema.optional(),
  ciphertext: z.string().optional() // Base64
}).refine(data => {
  if (data.encrypted) {
    return Boolean(data.crypto && data.ciphertext)
  }
  return Boolean(data.payload)
}, {
  message: 'Wadah project terenkripsi wajib memiliki metadata kripto dan ciphertext, sedangkan wadah non-terenkripsi wajib memiliki payload draft.'
})

export type CryptoMetadata = z.infer<typeof CryptoMetadataSchema>
export type ProjectContainer = z.infer<typeof ProjectContainerSchema>
