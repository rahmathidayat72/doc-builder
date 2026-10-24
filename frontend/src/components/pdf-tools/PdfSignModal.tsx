import React, { useState, useRef, useEffect } from 'react'
import {
  PenTool,
  Upload,
  Type,
  Calendar,
  User,
  Users,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Download,
  Info,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
  Settings,
  Layers,
  FileText,
} from 'lucide-react'
import {
  getPdfEditorPages,
  applyPdfEditor,
  type PdfEditorPageInfo,
  type PdfEditorTextOverlay,
  type PdfEditorImageOverlay,
  type PdfEditorPageSpec,
} from '../../services/pdfTools'

export interface SignerItem {
  id: string
  name: string
  color: string
}

export interface SignOverlayItem {
  id: string
  kind: 'signature' | 'initial' | 'name' | 'date'
  label: string
  x_ratio: number // 0.0 - 1.0
  y_ratio: number // 0.0 - 1.0
  width_ratio: number // 0.0 - 1.0
  height_ratio: number // 0.0 - 1.0
  // For images (signature & initial)
  image_base64?: string
  // For text (name & date)
  text?: string
  font_size?: number
  color?: string
  signer_id?: string
  signer_name?: string
  signer_color?: string
}

export const SIGNER_PALETTE: { color: string; label: string }[] = [
  { color: '#2563eb', label: 'Biru' },
  { color: '#047857', label: 'Hijau' },
  { color: '#6d28d9', label: 'Ungu' },
  { color: '#b45309', label: 'Jingga' },
  { color: '#be123c', label: 'Merah Muda' },
]

interface SignPageItem {
  id: string
  sourceIndex: number
  rotation: number
  width: number
  height: number
  thumbnail: string
  overlays: SignOverlayItem[]
}

interface PdfSignModalProps {
  isOpen: boolean
  onClose: () => void
}

export function parseTargetPages(
  targetMode: 'current' | 'all' | 'range',
  rangeStr: string,
  currentIndex: number,
  totalPages: number
): number[] {
  if (targetMode === 'current') {
    return [currentIndex]
  }
  if (targetMode === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i)
  }
  const result = new Set<number>()
  const parts = rangeStr.split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-')
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)
      if (!isNaN(start) && !isNaN(end)) {
        const minP = Math.max(1, Math.min(start, end))
        const maxP = Math.min(totalPages, Math.max(start, end))
        for (let p = minP; p <= maxP; p++) {
          result.add(p - 1)
        }
      }
    } else {
      const p = parseInt(trimmed, 10)
      if (!isNaN(p) && p >= 1 && p <= totalPages) {
        result.add(p - 1)
      }
    }
  }
  const sorted = Array.from(result).sort((a, b) => a - b)
  return sorted.length > 0 ? sorted : [currentIndex]
}

export function renderCursiveTextToDataUrl(text: string, isInitial: boolean = false): string {
  // 1x1 transparent PNG fallback for headless / jsdom test environments
  const fallbackPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAA'
  try {
    const canvas = document.createElement('canvas')
    const width = isInitial ? 200 : 400
    const height = isInitial ? 150 : 160
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return fallbackPng
    ctx.clearRect(0, 0, width, height)
    ctx.font = isInitial
      ? 'bold 56px "Segoe Script", "Brush Script MT", cursive'
      : '42px "Segoe Script", "Brush Script MT", cursive'
    ctx.fillStyle = '#0f172a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text.trim(), width / 2, height / 2)
    const dataUrl = canvas.toDataURL('image/png')
    return dataUrl && dataUrl.startsWith('data:image/png') ? dataUrl : fallbackPng
  } catch {
    return fallbackPng
  }
}

export const PdfSignModal: React.FC<PdfSignModalProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<SignPageItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isApplying, setIsApplying] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Creation panel tab: 'signature' | 'initial' | 'text'
  const [activeAssetTab, setActiveAssetTab] = useState<'signature' | 'initial' | 'text'>('signature')

  // Signature creation mode: 'draw' | 'type' | 'upload'
  const [sigMode, setSigMode] = useState<'draw' | 'type' | 'upload'>('draw')
  const [sigTypedName, setSigTypedName] = useState<string>('')
  const [sigDataUrl, setSigDataUrl] = useState<string | null>(null)
  const [isDrawingSig, setIsDrawingSig] = useState<boolean>(false)
  const [hasDrawnSig, setHasDrawnSig] = useState<boolean>(false)
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Initial (paraf) creation mode: 'draw' | 'type' | 'upload'
  const [initMode, setInitMode] = useState<'draw' | 'type' | 'upload'>('draw')
  const [initTypedText, setInitTypedText] = useState<string>('')
  const [initDataUrl, setInitDataUrl] = useState<string | null>(null)
  const [isDrawingInit, setIsDrawingInit] = useState<boolean>(false)
  const [hasDrawnInit, setHasDrawnInit] = useState<boolean>(false)
  const initCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Text inputs: Signer Name & Date
  const [signerName, setSignerName] = useState<string>('')
  const [signerDate, setSignerDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  // Target page placement
  const [targetMode, setTargetMode] = useState<'current' | 'range' | 'all'>('current')
  const [targetRange, setTargetRange] = useState<string>('1')

  // Signing scenario & Multi-signer states
  const [signingMode, setSigningMode] = useState<'only_me' | 'several'>('only_me')
  const [showChooser, setShowChooser] = useState<boolean>(false)
  const [signers, setSigners] = useState<SignerItem[]>([
    { id: 'signer-1', name: 'Pihak 1', color: '#2563eb' },
    { id: 'signer-2', name: 'Pihak 2', color: '#047857' },
  ])
  const [activeSignerId, setActiveSignerId] = useState<string>('signer-1')
  const [isManagingSigners, setIsManagingSigners] = useState<boolean>(false)

  // Overlay selection & manipulation on active page
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const isDraggingRef = useRef<boolean>(false)
  const isResizingRef = useRef<boolean>(false)
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number; startW: number; startH: number }>({
    clientX: 0,
    clientY: 0,
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
  })

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setFile(null)
      setPages([])
      setSelectedIndex(0)
      setIsLoading(false)
      setIsApplying(false)
      setErrorMessage(null)
      setSuccessMessage(null)
      setSigDataUrl(null)
      setSigTypedName('')
      setHasDrawnSig(false)
      setInitDataUrl(null)
      setInitTypedText('')
      setHasDrawnInit(false)
      setSelectedOverlayId(null)
      setShowChooser(false)
      setSigningMode('only_me')
      setSigners([
        { id: 'signer-1', name: 'Pihak 1', color: '#2563eb' },
        { id: 'signer-2', name: 'Pihak 2', color: '#047857' },
      ])
      setActiveSignerId('signer-1')
      setIsManagingSigners(false)
    }
  }, [isOpen])

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // File loading
  const handleFileSelected = async (selectedFile: File) => {
    setFile(selectedFile)
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsLoading(true)

    const res = await getPdfEditorPages(selectedFile)
    setIsLoading(false)

    if (res.success && res.pages && res.pages.length > 0) {
      const items: SignPageItem[] = res.pages.map((p: PdfEditorPageInfo, idx: number) => ({
        id: `sign-page-${idx}-${Date.now()}`,
        sourceIndex: p.original_index,
        rotation: p.rotation,
        width: p.width,
        height: p.height,
        thumbnail: p.thumbnail,
        overlays: [],
      }))
      setPages(items)
      setSelectedIndex(0)
      setTargetRange(`1-${items.length}`)
      setShowChooser(true)
    } else {
      setErrorMessage(res.message || 'Gagal memuat halaman dokumen PDF.')
    }
  }

  // Signature canvas drawing
  const startDrawingSig = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.setPointerCapture(e.pointerId)
    setIsDrawingSig(true)
    setHasDrawnSig(true)
    const rect = canvas.getBoundingClientRect()
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const drawSig = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingSig) return
    const canvas = sigCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  const stopDrawingSig = () => {
    setIsDrawingSig(false)
    const canvas = sigCanvasRef.current
    if (canvas && hasDrawnSig) {
      setSigDataUrl(canvas.toDataURL('image/png'))
    }
  }

  const clearSigCanvas = () => {
    const canvas = sigCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawnSig(false)
    setSigDataUrl(null)
  }

  // Initial canvas drawing
  const startDrawingInit = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = initCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.setPointerCapture(e.pointerId)
    setIsDrawingInit(true)
    setHasDrawnInit(true)
    const rect = canvas.getBoundingClientRect()
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const drawInit = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingInit) return
    const canvas = initCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  const stopDrawingInit = () => {
    setIsDrawingInit(false)
    const canvas = initCanvasRef.current
    if (canvas && hasDrawnInit) {
      setInitDataUrl(canvas.toDataURL('image/png'))
    }
  }

  const clearInitCanvas = () => {
    const canvas = initCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawnInit(false)
    setInitDataUrl(null)
  }

  // Upload handlers
  const handleUploadSigImage = (uploadFile: File) => {
    if (uploadFile.size > 5 * 1024 * 1024) {
      setErrorMessage('Ukuran berkas gambar tanda tangan maksimal 5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSigDataUrl(reader.result)
      }
    }
    reader.readAsDataURL(uploadFile)
  }

  const handleUploadInitImage = (uploadFile: File) => {
    if (uploadFile.size > 5 * 1024 * 1024) {
      setErrorMessage('Ukuran berkas gambar paraf maksimal 5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setInitDataUrl(reader.result)
      }
    }
    reader.readAsDataURL(uploadFile)
  }

  const activeSigner: SignerItem =
    signingMode === 'only_me'
      ? { id: 'signer-me', name: signerName.trim() || 'Saya Sendiri', color: '#2563eb' }
      : signers.find(s => s.id === activeSignerId) || signers[0] || { id: 'signer-1', name: 'Pihak 1', color: '#2563eb' }

  const handleAddSigner = () => {
    if (signers.length >= 5) {
      setErrorMessage('Maksimal 5 penandatangan dalam satu dokumen.')
      return
    }
    const nextIdx = signers.length + 1
    const paletteItem = SIGNER_PALETTE[(nextIdx - 1) % SIGNER_PALETTE.length]
    const newSigner: SignerItem = {
      id: `signer-${Date.now()}`,
      name: `Pihak ${nextIdx}`,
      color: paletteItem.color,
    }
    setSigners(prev => [...prev, newSigner])
    setActiveSignerId(newSigner.id)
    setSuccessMessage(`Berhasil menambahkan ${newSigner.name}`)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const handleUpdateSignerName = (id: string, newName: string) => {
    setSigners(prev => prev.map(s => (s.id === id ? { ...s, name: newName } : s)))
  }

  const handleUpdateSignerColor = (id: string, newColor: string) => {
    setSigners(prev => prev.map(s => (s.id === id ? { ...s, color: newColor } : s)))
  }

  const handleRemoveSigner = (id: string) => {
    if (signers.length <= 2) {
      setErrorMessage('Minimal 2 penandatangan untuk mode beberapa orang.')
      return
    }
    const nextList = signers.filter(s => s.id !== id)
    setSigners(nextList)
    if (activeSignerId === id) {
      setActiveSignerId(nextList[0]?.id || '')
    }
  }

  // Add Element to target pages
  const handleAddElementToPages = (kind: 'signature' | 'initial' | 'name' | 'date') => {
    const targetIndices = parseTargetPages(targetMode, targetRange, selectedIndex, pages.length)
    if (targetIndices.length === 0) return

    let overlayProto: Omit<SignOverlayItem, 'id'>

    if (kind === 'signature') {
      let dataUrl = sigDataUrl
      if (sigMode === 'type' && sigTypedName.trim()) {
        dataUrl = renderCursiveTextToDataUrl(sigTypedName.trim(), false)
      }
      if (!dataUrl) {
        setErrorMessage('Tanda tangan belum dibuat. Silakan coret, ketik nama, atau unggah gambar.')
        return
      }
      overlayProto = {
        kind: 'signature',
        label: signingMode === 'several' ? `Tanda Tangan (${activeSigner.name})` : 'Tanda Tangan',
        x_ratio: 0.65,
        y_ratio: 0.8,
        width_ratio: 0.28,
        height_ratio: 0.12,
        image_base64: dataUrl,
        signer_id: activeSigner.id,
        signer_name: activeSigner.name,
        signer_color: activeSigner.color,
      }
    } else if (kind === 'initial') {
      let dataUrl = initDataUrl
      if (initMode === 'type' && initTypedText.trim()) {
        dataUrl = renderCursiveTextToDataUrl(initTypedText.trim(), true)
      }
      if (!dataUrl) {
        setErrorMessage('Paraf belum dibuat. Silakan coret, ketik inisial, atau unggah gambar.')
        return
      }
      overlayProto = {
        kind: 'initial',
        label: signingMode === 'several' ? `Paraf (${activeSigner.name})` : 'Paraf',
        x_ratio: 0.82,
        y_ratio: 0.9,
        width_ratio: 0.14,
        height_ratio: 0.07,
        image_base64: dataUrl,
        signer_id: activeSigner.id,
        signer_name: activeSigner.name,
        signer_color: activeSigner.color,
      }
    } else if (kind === 'name') {
      const cleanName = signerName.trim()
      if (!cleanName) {
        setErrorMessage('Masukkan nama penanda tangan terlebih dahulu.')
        return
      }
      overlayProto = {
        kind: 'name',
        label: `Nama: ${cleanName}`,
        x_ratio: 0.65,
        y_ratio: 0.93,
        width_ratio: 0.28,
        height_ratio: 0.04,
        text: cleanName,
        font_size: 11,
        color: '#0f172a',
        signer_id: activeSigner.id,
        signer_name: activeSigner.name,
        signer_color: activeSigner.color,
      }
    } else {
      const cleanDate = signerDate.trim()
      if (!cleanDate) {
        setErrorMessage('Tentukan tanggal penandatanganan terlebih dahulu.')
        return
      }
      overlayProto = {
        kind: 'date',
        label: `Tgl: ${cleanDate}`,
        x_ratio: 0.65,
        y_ratio: 0.76,
        width_ratio: 0.28,
        height_ratio: 0.04,
        text: cleanDate,
        font_size: 10,
        color: '#334155',
        signer_id: activeSigner.id,
        signer_name: activeSigner.name,
        signer_color: activeSigner.color,
      }
    }

    setPages(prev => {
      const copy = [...prev]
      for (const targetIdx of targetIndices) {
        if (targetIdx >= 0 && targetIdx < copy.length) {
          const newOverlay: SignOverlayItem = {
            ...overlayProto,
            id: `ovl-${Date.now()}-${Math.random()}`,
          }
          copy[targetIdx] = {
            ...copy[targetIdx],
            overlays: [...copy[targetIdx].overlays, newOverlay],
          }
        }
      }
      return copy
    })

    setErrorMessage(null)
    setSuccessMessage(`Elemen berhasil ditambahkan ke ${targetIndices.length} halaman.`)
    setTimeout(() => setSuccessMessage(null), 3500)
  }

  // Remove overlay
  const removeOverlay = (overlayId: string) => {
    setPages(prev => {
      const copy = [...prev]
      const current = copy[selectedIndex]
      copy[selectedIndex] = {
        ...current,
        overlays: current.overlays.filter(o => o.id !== overlayId),
      }
      return copy
    })
    if (selectedOverlayId === overlayId) {
      setSelectedOverlayId(null)
    }
  }

  // Pointer drag & resize handlers
  const handlePointerDownDrag = (e: React.PointerEvent<HTMLDivElement>, overlay: SignOverlayItem) => {
    e.stopPropagation()
    setSelectedOverlayId(overlay.id)
    isDraggingRef.current = true
    isResizingRef.current = false
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: overlay.x_ratio,
      startY: overlay.y_ratio,
      startW: overlay.width_ratio,
      startH: overlay.height_ratio,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerDownResize = (e: React.PointerEvent<HTMLDivElement>, overlay: SignOverlayItem) => {
    e.stopPropagation()
    setSelectedOverlayId(overlay.id)
    isResizingRef.current = true
    isDraggingRef.current = false
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: overlay.x_ratio,
      startY: overlay.y_ratio,
      startW: overlay.width_ratio,
      startH: overlay.height_ratio,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMoveStage = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current && !isResizingRef.current) return
    const stage = stageRef.current
    if (!stage || !selectedOverlayId) return

    const stageRect = stage.getBoundingClientRect()
    const dxRatio = (e.clientX - dragStartRef.current.clientX) / stageRect.width
    const dyRatio = (e.clientY - dragStartRef.current.clientY) / stageRect.height

    setPages(prev => {
      const copy = [...prev]
      const curPage = copy[selectedIndex]
      const targetOvl = curPage.overlays.find(o => o.id === selectedOverlayId)
      if (!targetOvl) return prev

      if (isDraggingRef.current) {
        let newX = dragStartRef.current.startX + dxRatio
        let newY = dragStartRef.current.startY + dyRatio
        newX = Math.max(0, Math.min(1 - targetOvl.width_ratio, newX))
        newY = Math.max(0, Math.min(1 - targetOvl.height_ratio, newY))

        copy[selectedIndex] = {
          ...curPage,
          overlays: curPage.overlays.map(o =>
            o.id === selectedOverlayId ? { ...o, x_ratio: newX, y_ratio: newY } : o
          ),
        }
      } else if (isResizingRef.current) {
        let newW = Math.max(0.05, Math.min(1 - targetOvl.x_ratio, dragStartRef.current.startW + dxRatio))
        let newH = Math.max(0.02, Math.min(1 - targetOvl.y_ratio, dragStartRef.current.startH + dyRatio))

        // Lock aspect ratio for signatures & initials
        if (targetOvl.kind === 'signature' || targetOvl.kind === 'initial') {
          const aspect = dragStartRef.current.startW / Math.max(0.001, dragStartRef.current.startH)
          newH = newW / aspect
          if (targetOvl.y_ratio + newH > 1) {
            newH = 1 - targetOvl.y_ratio
            newW = newH * aspect
          }
        }

        copy[selectedIndex] = {
          ...curPage,
          overlays: curPage.overlays.map(o =>
            o.id === selectedOverlayId ? { ...o, width_ratio: newW, height_ratio: newH } : o
          ),
        }
      }
      return copy
    })
  }

  const handlePointerUpStage = () => {
    isDraggingRef.current = false
    isResizingRef.current = false
  }

  // Keyboard accessibility for selected overlay
  const handleOverlayKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, overlayId: string) => {
    const shift = e.shiftKey
    const step = shift ? 0.02 : 0.01

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      removeOverlay(overlayId)
      return
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault()
      setPages(prev => {
        const copy = [...prev]
        const curPage = copy[selectedIndex]
        const ovl = curPage.overlays.find(o => o.id === overlayId)
        if (!ovl) return prev

        let { x_ratio, y_ratio, width_ratio, height_ratio } = ovl
        if (shift) {
          // Resize mode with Shift+Arrow
          if (e.key === 'ArrowRight') width_ratio = Math.min(1 - x_ratio, width_ratio + step)
          if (e.key === 'ArrowLeft') width_ratio = Math.max(0.05, width_ratio - step)
          if (e.key === 'ArrowDown') height_ratio = Math.min(1 - y_ratio, height_ratio + step)
          if (e.key === 'ArrowUp') height_ratio = Math.max(0.02, height_ratio - step)
        } else {
          // Move mode with Arrow
          if (e.key === 'ArrowRight') x_ratio = Math.min(1 - width_ratio, x_ratio + step)
          if (e.key === 'ArrowLeft') x_ratio = Math.max(0, x_ratio - step)
          if (e.key === 'ArrowDown') y_ratio = Math.min(1 - height_ratio, y_ratio + step)
          if (e.key === 'ArrowUp') y_ratio = Math.max(0, y_ratio - step)
        }

        copy[selectedIndex] = {
          ...curPage,
          overlays: curPage.overlays.map(o =>
            o.id === overlayId ? { ...o, x_ratio, y_ratio, width_ratio, height_ratio } : o
          ),
        }
        return copy
      })
    }
  }

  // Numeric adjustment fallback
  const handleNumericRatioChange = (overlayId: string, field: 'x_ratio' | 'y_ratio' | 'width_ratio' | 'height_ratio', valPercent: number) => {
    const ratio = Math.max(0, Math.min(1, valPercent / 100))
    setPages(prev => {
      const copy = [...prev]
      const curPage = copy[selectedIndex]
      copy[selectedIndex] = {
        ...curPage,
        overlays: curPage.overlays.map(o => (o.id === overlayId ? { ...o, [field]: ratio } : o)),
      }
      return copy
    })
  }

  // Apply and Download
  const handleApplyAndDownload = async () => {
    if (!file || pages.length === 0) return
    setIsApplying(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const specs: PdfEditorPageSpec[] = pages.map(p => {
      const textOverlays: PdfEditorTextOverlay[] = p.overlays
        .filter(o => o.kind === 'name' || o.kind === 'date')
        .map(o => ({
          id: o.id,
          text: o.text || '',
          x_ratio: o.x_ratio,
          y_ratio: o.y_ratio,
          width_ratio: o.width_ratio,
          height_ratio: o.height_ratio,
          font_size: o.font_size || 11,
          color: o.color || '#000000',
        }))

      const imageOverlays: PdfEditorImageOverlay[] = p.overlays
        .filter(o => o.kind === 'signature' || o.kind === 'initial')
        .map(o => ({
          id: o.id,
          image_base64: o.image_base64 || '',
          x_ratio: o.x_ratio,
          y_ratio: o.y_ratio,
          width_ratio: o.width_ratio,
          height_ratio: o.height_ratio,
        }))

      return {
        source_index: p.sourceIndex,
        rotation: p.rotation,
        text_overlays: textOverlays,
        image_overlays: imageOverlays,
      }
    })

    const res = await applyPdfEditor(file, { pages: specs }, 'signed')
    setIsApplying(false)

    if (res.success) {
      setSuccessMessage(`Berhasil menyimpan dan mengunduh berkas bertanda tangan: ${res.filename}`)
    } else {
      setErrorMessage(res.message || 'Gagal menyimpan tanda tangan ke dokumen PDF.')
    }
  }

  const activePage = pages[selectedIndex]
  const activeSelectedOverlay = activePage?.overlays.find(o => o.id === selectedOverlayId)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modal Sign PDF"
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-4 sm:p-6 space-y-4 border border-slate-200 animate-fade-in max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">Sign PDF Visual</h3>
                {file && pages.length > 0 && !showChooser && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-2xs font-bold ${
                      signingMode === 'several'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                    data-testid="badge-signing-mode"
                  >
                    {signingMode === 'several'
                      ? `Beberapa orang (${signers.length} Pihak)`
                      : 'Hanya saya'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Bubuhkan tanda tangan, paraf, nama, dan tanggal ke dokumen PDF secara lokal.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {file && pages.length > 0 && !showChooser && (
              <button
                type="button"
                onClick={() => setShowChooser(true)}
                aria-label="Ganti mode penandatangan"
                className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1.5"
                data-testid="btn-switch-signing-mode"
              >
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>Ganti Mode</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup modal Sign PDF"
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition"
              data-testid="btn-close-pdf-sign"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Disclaimer Notice */}
        <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-2 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span className="text-2xs leading-relaxed">
            <strong>Catatan Keabsahan:</strong> Fitur ini menyematkan tanda tangan visual pada halaman dokumen dan bukan tanda tangan digital berbasis sertifikat kriptografis (p12/pfx). Pemrosesan 100% lokal di browser Anda.
          </span>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Dropzone or Chooser or Editor */}
        {!file || pages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 px-4">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-xs font-semibold text-slate-700">Mengekstrak halaman dokumen PDF...</p>
                <p className="text-2xs text-slate-400">Menyiapkan kanvas penandatanganan</p>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-2xl p-8 max-w-lg w-full flex flex-col items-center justify-center gap-3 cursor-pointer transition bg-slate-50/60 hover:bg-blue-50/20 text-center">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-800 block">
                    Pilih berkas PDF yang ingin ditandatangani
                  </span>
                  <span className="text-2xs text-slate-400 block mt-1">
                    Maksimum ukuran 25 MB • Diproses secara privat tanpa internet
                  </span>
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  aria-label="Pilih berkas PDF untuk ditandatangani"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0])
                    }
                  }}
                  data-testid="input-pdf-sign-file"
                />
              </label>
            )}
          </div>
        ) : showChooser ? (
          <div className="flex-1 flex flex-col justify-between py-2 space-y-4 overflow-y-auto custom-scrollbar">
            <div className="text-center space-y-1 py-1">
              <h4 className="text-lg font-bold text-slate-800">
                Siapa yang akan menandatangani dokumen ini?
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Pilih jenis alur penandatanganan untuk berkas Anda. Anda dapat mengubah pilihan ini kapan saja di dalam studio.
              </p>
            </div>

            {/* 2 Visual Option Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto w-full px-2">
              {/* Option 1: Hanya Saya */}
              <div
                className={`border-2 rounded-2xl p-5 flex flex-col justify-between transition bg-white shadow-xs hover:shadow-md ${
                  signingMode === 'only_me' ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200 hover:border-red-300'
                }`}
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Hanya saya</span>
                      <span className="text-2xs font-semibold text-slate-400 font-normal">/ Only me</span>
                    </h5>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Anda adalah satu-satunya pihak yang menandatangani dokumen ini. Bubuhkan tanda tangan, paraf, nama, atau tanggal Anda sendiri secara instan.
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setSigningMode('only_me')
                      setShowChooser(false)
                    }}
                    className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2"
                    data-testid="btn-choose-only-me"
                  >
                    <span>Tandatangani Sendiri</span>
                  </button>
                </div>
              </div>

              {/* Option 2: Beberapa Orang */}
              <div
                className={`border-2 rounded-2xl p-5 flex flex-col justify-between transition bg-white shadow-xs hover:shadow-md ${
                  signingMode === 'several' ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200 hover:border-red-300'
                }`}
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Beberapa orang</span>
                      <span className="text-2xs font-semibold text-slate-400 font-normal">/ Several people</span>
                    </h5>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Dua orang atau lebih menandatangani dokumen ini. Tentukan daftar pihak, beri kode warna khas, dan kelola penandatanganan secara berurutan.
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setSigningMode('several')
                      setShowChooser(false)
                    }}
                    className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2"
                    data-testid="btn-choose-several"
                  >
                    <span>Atur Penandatangan</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Info Bar */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs max-w-2xl mx-auto w-full">
              <div className="flex items-center gap-2 text-slate-700">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-bold truncate max-w-[220px]" title={file.name}>
                  {file.name}
                </span>
                <span className="text-slate-400 text-2xs">
                  • {(file.size / 1024).toFixed(0)} KB • {pages.length} Halaman
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    setPages([])
                    setShowChooser(false)
                    setErrorMessage(null)
                    setSuccessMessage(null)
                  }}
                  className="text-2xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 transition"
                  data-testid="btn-chooser-change-file"
                >
                  Ganti Berkas
                </button>
                <button
                  type="button"
                  onClick={() => setShowChooser(false)}
                  className="text-2xs font-semibold text-blue-600 hover:text-blue-800 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 transition"
                  data-testid="btn-chooser-back-studio"
                >
                  Buka Studio
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            {/* Multi-Signer Active Selector & Manager (Several People mode) */}
            {signingMode === 'several' && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/90 rounded-2xl space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-bold uppercase tracking-wider text-emerald-900">
                      Pihak Aktif:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Pilih pihak aktif">
                      {signers.map(s => {
                        const isActive = s.id === activeSigner.id
                        return (
                          <button
                            key={s.id}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            onClick={() => {
                              setActiveSignerId(s.id)
                              if (activeAssetTab === 'text') {
                                setSignerName(s.name)
                              }
                            }}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs ${
                              isActive
                                ? 'text-white'
                                : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                            }`}
                            style={isActive ? { backgroundColor: s.color, borderColor: s.color } : {}}
                            data-testid={`btn-select-signer-${s.id}`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white/60"
                              style={{ backgroundColor: s.color }}
                            />
                            <span>{s.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleAddSigner}
                      disabled={signers.length >= 5}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-100/70 disabled:opacity-40 text-emerald-800 text-2xs font-bold rounded-lg border border-emerald-300 transition flex items-center gap-1"
                      data-testid="btn-add-signer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Pihak</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsManagingSigners(prev => !prev)}
                      className={`px-2.5 py-1 rounded-lg text-2xs font-bold border transition flex items-center gap-1 ${
                        isManagingSigners
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                      }`}
                      data-testid="btn-toggle-manage-signers"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>{isManagingSigners ? 'Tutup Atur' : 'Kelola Pihak'}</span>
                    </button>
                  </div>
                </div>

                {/* Collapsible Signers Manager */}
                {isManagingSigners && (
                  <div className="pt-2.5 border-t border-emerald-200/80 space-y-2 animate-fade-in" data-testid="panel-manage-signers">
                    <p className="text-2xs text-slate-600">
                      Ubah nama atau warna identitas setiap pihak penandatangan:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {signers.map((s, sIdx) => (
                        <div key={s.id} className="p-2 bg-white rounded-xl border border-slate-200 flex flex-col gap-1.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-3xs font-bold text-slate-400">Pihak {sIdx + 1}</span>
                            {signers.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSigner(s.id)}
                                aria-label={`Hapus ${s.name}`}
                                className="text-rose-500 hover:text-rose-700 text-3xs font-semibold"
                                data-testid={`btn-remove-signer-${s.id}`}
                              >
                                Hapus
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={s.name}
                            onChange={e => handleUpdateSignerName(s.id, e.target.value)}
                            aria-label={`Nama ${s.name}`}
                            className="p-1 text-xs border border-slate-200 rounded-lg outline-none font-semibold text-slate-800"
                            data-testid={`input-signer-name-${s.id}`}
                          />
                          <div className="flex items-center gap-1 pt-0.5">
                            <span className="text-3xs text-slate-400">Warna:</span>
                            {SIGNER_PALETTE.map(p => (
                              <button
                                key={p.color}
                                type="button"
                                onClick={() => handleUpdateSignerColor(s.id, p.color)}
                                title={p.label}
                                aria-label={`Pilih warna ${p.label} untuk ${s.name}`}
                                className={`w-4 h-4 rounded-full border transition ${
                                  s.color === p.color ? 'ring-2 ring-slate-800 scale-110' : 'opacity-80 hover:opacity-100'
                                }`}
                                style={{ backgroundColor: p.color }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Asset Creator Accordion / Panel */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              {/* Top tabs */}
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                <div className="flex gap-1.5 p-1 bg-white border border-slate-200 rounded-xl" role="tablist" aria-label="Tipe Elemen Sign">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeAssetTab === 'signature'}
                    onClick={() => setActiveAssetTab('signature')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                      activeAssetTab === 'signature'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    data-testid="tab-asset-signature"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Tanda Tangan</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeAssetTab === 'initial'}
                    onClick={() => setActiveAssetTab('initial')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                      activeAssetTab === 'initial'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    data-testid="tab-asset-initial"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Paraf</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeAssetTab === 'text'}
                    onClick={() => setActiveAssetTab('text')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                      activeAssetTab === 'text'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    data-testid="tab-asset-text"
                  >
                    <Type className="w-3.5 h-3.5" />
                    <span>Nama & Tanggal</span>
                  </button>
                </div>

                {/* Target page selector */}
                <div className="flex items-center gap-2 text-xs">
                  <label htmlFor="select-target-mode" className="text-2xs font-bold text-slate-500 uppercase tracking-wider">
                    Target:
                  </label>
                  <select
                    id="select-target-mode"
                    value={targetMode}
                    onChange={e => setTargetMode(e.target.value as any)}
                    aria-label="Pilih target halaman pemasangan"
                    className="p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium outline-none"
                    data-testid="select-target-mode"
                  >
                    <option value="current">Halaman {selectedIndex + 1} (Aktif)</option>
                    <option value="range">Rentang Halaman</option>
                    <option value="all">Semua ({pages.length} Hal)</option>
                  </select>
                  {targetMode === 'range' && (
                    <input
                      type="text"
                      placeholder="e.g. 1-3, 5"
                      value={targetRange}
                      onChange={e => setTargetRange(e.target.value)}
                      aria-label="Masukkan rentang halaman contoh 1-3, 5"
                      className="w-24 p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium outline-none"
                      data-testid="input-target-range"
                    />
                  )}
                </div>
              </div>

              {/* Tab Content 1: Tanda Tangan */}
              {activeAssetTab === 'signature' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-bold text-slate-500 uppercase">Metode:</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setSigMode('draw')}
                        className={`px-2.5 py-1 text-2xs font-semibold rounded-lg transition ${
                          sigMode === 'draw' ? 'bg-slate-800 text-white' : 'bg-white border text-slate-700'
                        }`}
                        data-testid="btn-sig-mode-draw"
                      >
                        Coret Kanvas
                      </button>
                      <button
                        type="button"
                        onClick={() => setSigMode('type')}
                        className={`px-2.5 py-1 text-2xs font-semibold rounded-lg transition ${
                          sigMode === 'type' ? 'bg-slate-800 text-white' : 'bg-white border text-slate-700'
                        }`}
                        data-testid="btn-sig-mode-type"
                      >
                        Ketik Nama (Kursif)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSigMode('upload')}
                        className={`px-2.5 py-1 text-2xs font-semibold rounded-lg transition ${
                          sigMode === 'upload' ? 'bg-slate-800 text-white' : 'bg-white border text-slate-700'
                        }`}
                        data-testid="btn-sig-mode-upload"
                      >
                        Unggah Gambar
                      </button>
                    </div>
                  </div>

                  {sigMode === 'draw' && (
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                      <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-1 relative shadow-inner shrink-0">
                        <canvas
                          ref={sigCanvasRef}
                          width={320}
                          height={110}
                          onPointerDown={startDrawingSig}
                          onPointerMove={drawSig}
                          onPointerUp={stopDrawingSig}
                          className="cursor-crosshair bg-white block rounded-lg touch-none"
                          data-testid="canvas-sign-signature"
                        />
                        <div className="absolute bottom-2 right-2 text-3xs text-slate-400 select-none pointer-events-none">
                          Coret tanda tangan di sini
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 w-full">
                        <p className="text-2xs text-slate-500 leading-relaxed">
                          Gunakan mouse, stylus, atau jari untuk menggambar tanda tangan Anda.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={clearSigCanvas}
                            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition"
                            data-testid="btn-clear-sig"
                          >
                            Hapus Coretan
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddElementToPages('signature')}
                            disabled={!hasDrawnSig && !sigDataUrl}
                            className="flex-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                            data-testid="btn-add-sig-to-page"
                          >
                            Pasang Tanda Tangan
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {sigMode === 'type' && (
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                      <div className="flex-1 w-full space-y-1">
                        <label htmlFor="input-sig-typed" className="block text-2xs font-bold text-slate-600">
                          Nama untuk Digayakan:
                        </label>
                        <input
                          id="input-sig-typed"
                          type="text"
                          placeholder="Masukkan nama lengkap Anda..."
                          value={sigTypedName}
                          onChange={e => setSigTypedName(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                          data-testid="input-sig-typed-name"
                        />
                      </div>
                      <div className="w-48 h-18 bg-white border border-slate-200 rounded-xl p-2 flex items-center justify-center shrink-0">
                        {sigTypedName.trim() ? (
                          <span className="font-cursive text-xl text-slate-800 select-none italic font-serif">
                            {sigTypedName.trim()}
                          </span>
                        ) : (
                          <span className="text-3xs text-slate-400 italic">Pratinjau kursif</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddElementToPages('signature')}
                        disabled={!sigTypedName.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg shadow-xs transition shrink-0"
                        data-testid="btn-add-sig-typed-to-page"
                      >
                        Pasang Tanda Tangan
                      </button>
                    </div>
                  )}

                  {sigMode === 'upload' && (
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                      <label className="flex-1 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-3 flex items-center gap-3 cursor-pointer bg-white transition w-full">
                        <Upload className="w-5 h-5 text-blue-600 shrink-0" />
                        <div className="text-left">
                          <span className="text-xs font-bold text-slate-700 block">Pilih Gambar Tanda Tangan</span>
                          <span className="text-3xs text-slate-400 block">Format PNG transparan atau JPEG (maks. 5 MB)</span>
                        </div>
                        <input
                          type="file"
                          accept=".png, .jpg, .jpeg"
                          className="hidden"
                          onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                              handleUploadSigImage(e.target.files[0])
                            }
                          }}
                          data-testid="input-sig-file-upload"
                        />
                      </label>
                      {sigDataUrl && (
                        <div className="w-32 h-14 bg-white border border-slate-200 rounded-xl p-1 flex items-center justify-center shrink-0">
                          <img src={sigDataUrl} alt="Pratinjau tanda tangan unggahan" className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAddElementToPages('signature')}
                        disabled={!sigDataUrl}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg shadow-xs transition shrink-0"
                        data-testid="btn-add-sig-upload-to-page"
                      >
                        Pasang Tanda Tangan
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content 2: Paraf (Initial) */}
              {activeAssetTab === 'initial' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-bold text-slate-500 uppercase">Metode:</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setInitMode('draw')}
                        className={`px-2.5 py-1 text-2xs font-semibold rounded-lg transition ${
                          initMode === 'draw' ? 'bg-slate-800 text-white' : 'bg-white border text-slate-700'
                        }`}
                        data-testid="btn-init-mode-draw"
                      >
                        Coret Kanvas
                      </button>
                      <button
                        type="button"
                        onClick={() => setInitMode('type')}
                        className={`px-2.5 py-1 text-2xs font-semibold rounded-lg transition ${
                          initMode === 'type' ? 'bg-slate-800 text-white' : 'bg-white border text-slate-700'
                        }`}
                        data-testid="btn-init-mode-type"
                      >
                        Ketik Inisial
                      </button>
                      <button
                        type="button"
                        onClick={() => setInitMode('upload')}
                        className={`px-2.5 py-1 text-2xs font-semibold rounded-lg transition ${
                          initMode === 'upload' ? 'bg-slate-800 text-white' : 'bg-white border text-slate-700'
                        }`}
                        data-testid="btn-init-mode-upload"
                      >
                        Unggah Gambar
                      </button>
                    </div>
                  </div>

                  {initMode === 'draw' && (
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                      <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-1 relative shadow-inner shrink-0">
                        <canvas
                          ref={initCanvasRef}
                          width={200}
                          height={90}
                          onPointerDown={startDrawingInit}
                          onPointerMove={drawInit}
                          onPointerUp={stopDrawingInit}
                          className="cursor-crosshair bg-white block rounded-lg touch-none"
                          data-testid="canvas-sign-initial"
                        />
                        <div className="absolute bottom-2 right-2 text-3xs text-slate-400 select-none pointer-events-none">
                          Coret paraf
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 w-full">
                        <p className="text-2xs text-slate-500 leading-relaxed">
                          Paraf berukuran lebih ringkas untuk disematkan pada sudut halaman.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={clearInitCanvas}
                            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition"
                            data-testid="btn-clear-init"
                          >
                            Hapus Coretan
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddElementToPages('initial')}
                            disabled={!hasDrawnInit && !initDataUrl}
                            className="flex-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                            data-testid="btn-add-init-to-page"
                          >
                            Pasang Paraf
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {initMode === 'type' && (
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                      <div className="flex-1 w-full space-y-1">
                        <label htmlFor="input-init-typed" className="block text-2xs font-bold text-slate-600">
                          Inisial Nama:
                        </label>
                        <input
                          id="input-init-typed"
                          type="text"
                          placeholder="e.g. AB atau R"
                          maxLength={5}
                          value={initTypedText}
                          onChange={e => setInitTypedText(e.target.value)}
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                          data-testid="input-init-typed-text"
                        />
                      </div>
                      <div className="w-28 h-16 bg-white border border-slate-200 rounded-xl p-2 flex items-center justify-center shrink-0">
                        {initTypedText.trim() ? (
                          <span className="font-cursive text-xl text-slate-800 select-none italic font-serif">
                            {initTypedText.trim()}
                          </span>
                        ) : (
                          <span className="text-3xs text-slate-400 italic">Inisial</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddElementToPages('initial')}
                        disabled={!initTypedText.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg shadow-xs transition shrink-0"
                        data-testid="btn-add-init-typed-to-page"
                      >
                        Pasang Paraf
                      </button>
                    </div>
                  )}

                  {initMode === 'upload' && (
                    <div className="flex flex-col sm:flex-row gap-3 items-center">
                      <label className="flex-1 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-3 flex items-center gap-3 cursor-pointer bg-white transition w-full">
                        <Upload className="w-5 h-5 text-blue-600 shrink-0" />
                        <div className="text-left">
                          <span className="text-xs font-bold text-slate-700 block">Pilih Gambar Paraf</span>
                          <span className="text-3xs text-slate-400 block">Format PNG transparan atau JPEG</span>
                        </div>
                        <input
                          type="file"
                          accept=".png, .jpg, .jpeg"
                          className="hidden"
                          onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                              handleUploadInitImage(e.target.files[0])
                            }
                          }}
                          data-testid="input-init-file-upload"
                        />
                      </label>
                      {initDataUrl && (
                        <div className="w-24 h-14 bg-white border border-slate-200 rounded-xl p-1 flex items-center justify-center shrink-0">
                          <img src={initDataUrl} alt="Pratinjau paraf unggahan" className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAddElementToPages('initial')}
                        disabled={!initDataUrl}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg shadow-xs transition shrink-0"
                        data-testid="btn-add-init-upload-to-page"
                      >
                        Pasang Paraf
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content 3: Nama & Tanggal */}
              {activeAssetTab === 'text' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div className="space-y-1">
                    <label htmlFor="input-signer-name" className="block text-2xs font-bold text-slate-600 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Nama Terang Penanda Tangan</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="input-signer-name"
                        type="text"
                        placeholder="Contoh: Budi Santoso, S.Kom."
                        value={signerName}
                        onChange={e => setSignerName(e.target.value)}
                        className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                        data-testid="input-signer-name"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddElementToPages('name')}
                        disabled={!signerName.trim()}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                        data-testid="btn-add-name-to-page"
                      >
                        Pasang Nama
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="input-signer-date" className="block text-2xs font-bold text-slate-600 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Tanggal Penandatanganan</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="input-signer-date"
                        type="date"
                        value={signerDate}
                        onChange={e => setSignerDate(e.target.value)}
                        className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                        data-testid="input-signer-date"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddElementToPages('date')}
                        disabled={!signerDate.trim()}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                        data-testid="btn-add-date-to-page"
                      >
                        Pasang Tanggal
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Stage & Canvas View */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-lg text-2xs font-bold">
                    Halaman {selectedIndex + 1} dari {pages.length}
                  </span>
                  <span className="text-slate-400 text-2xs">
                    ({activePage?.overlays.length || 0} elemen ditempatkan)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedIndex(prev => Math.max(0, prev - 1))}
                    disabled={selectedIndex === 0}
                    aria-label="Ke halaman sebelumnya"
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition"
                    data-testid="btn-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIndex(prev => Math.min(pages.length - 1, prev + 1))}
                    disabled={selectedIndex === pages.length - 1}
                    aria-label="Ke halaman berikutnya"
                    className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition"
                    data-testid="btn-next-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Main Stage */}
              <div
                className="flex flex-col items-center justify-center bg-slate-100/90 rounded-2xl p-4 border border-slate-200 min-h-[360px] select-none"
                onPointerMove={handlePointerMoveStage}
                onPointerUp={handlePointerUpStage}
              >
                {activePage && (
                  <div
                    ref={stageRef}
                    className="relative bg-white shadow-md rounded-lg overflow-hidden border border-slate-300 max-w-full"
                    style={{
                      transform: `rotate(${activePage.rotation}deg)`,
                    }}
                    data-testid="sign-active-stage"
                  >
                    <img
                      src={activePage.thumbnail}
                      alt={`Pratinjau Halaman ${selectedIndex + 1}`}
                      className="max-h-[380px] w-auto block select-none pointer-events-none"
                    />

                    {/* Overlay Elements Placed on Page */}
                    {activePage.overlays.map((ovl) => {
                      const isSelected = ovl.id === selectedOverlayId
                      const hasSignerColor = signingMode === 'several' && ovl.signer_color
                      return (
                        <div
                          key={ovl.id}
                          tabIndex={0}
                          role="region"
                          aria-label={`${ovl.label} di halaman ${selectedIndex + 1}. Tekan panah untuk menggeser, Shift+panah untuk mengubah ukuran, Delete untuk menghapus.`}
                          onKeyDown={e => handleOverlayKeyDown(e, ovl.id)}
                          onPointerDown={e => handlePointerDownDrag(e, ovl)}
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedOverlayId(ovl.id)
                          }}
                          className={`absolute cursor-move group transition-shadow rounded ${
                            isSelected
                              ? 'ring-2 ring-blue-500 shadow-md bg-blue-50/20'
                              : 'hover:ring-1 hover:ring-blue-400 bg-transparent'
                          } ${hasSignerColor ? 'border-2' : ''}`}
                          style={{
                            left: `${ovl.x_ratio * 100}%`,
                            top: `${ovl.y_ratio * 100}%`,
                            width: `${ovl.width_ratio * 100}%`,
                            height: `${ovl.height_ratio * 100}%`,
                            borderColor: hasSignerColor ? ovl.signer_color : undefined,
                          }}
                          data-testid={`overlay-item-${ovl.id}`}
                        >
                          {/* Signer identifier tag in multi-signer mode */}
                          {signingMode === 'several' && ovl.signer_name && (
                            <div
                              className="absolute -top-3.5 left-0 px-1.5 py-0.2 text-3xs font-bold text-white rounded shadow-xs truncate max-w-[130px] pointer-events-none select-none z-10"
                              style={{ backgroundColor: ovl.signer_color || '#2563eb' }}
                              data-testid={`badge-signer-${ovl.id}`}
                            >
                              {ovl.signer_name}
                            </div>
                          )}

                          {/* Inner element rendering */}
                          {ovl.image_base64 ? (
                            <img
                              src={ovl.image_base64}
                              alt={ovl.label}
                              className="w-full h-full object-contain pointer-events-none"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-semibold text-3xs text-slate-900 border-b border-slate-400 bg-white/80 px-1 truncate pointer-events-none">
                              {ovl.text}
                            </div>
                          )}

                          {/* Delete pill */}
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              removeOverlay(ovl.id)
                            }}
                            aria-label={`Hapus ${ovl.label}`}
                            className="absolute -top-2.5 -right-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-3xs shadow transition opacity-90 hover:opacity-100"
                            data-testid={`btn-remove-overlay-${ovl.id}`}
                          >
                            ×
                          </button>

                          {/* Resize corner handle */}
                          {isSelected && (
                            <div
                              onPointerDown={e => handlePointerDownResize(e, ovl)}
                              aria-label="Ubah ukuran elemen"
                              className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-blue-600 rounded-xs cursor-nwse-resize shadow border border-white"
                              data-testid={`handle-resize-${ovl.id}`}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Accessible Inspector / Numeric Adjustments for Selected Overlay */}
              {activeSelectedOverlay && (
                <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-900">{activeSelectedOverlay.label}</span>
                    {activeSelectedOverlay.signer_name && (
                      <span
                        className="text-3xs font-bold text-white px-1.5 py-0.5 rounded shadow-2xs"
                        style={{ backgroundColor: activeSelectedOverlay.signer_color || '#2563eb' }}
                      >
                        {activeSelectedOverlay.signer_name}
                      </span>
                    )}
                    <span className="text-3xs text-slate-500">
                      Gunakan tombol panah keyboard atau input di samping:
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-3xs font-semibold text-slate-600">X:</span>
                      <input
                        type="number"
                        min={0}
                        max={95}
                        value={Math.round(activeSelectedOverlay.x_ratio * 100)}
                        onChange={e => handleNumericRatioChange(activeSelectedOverlay.id, 'x_ratio', Number(e.target.value))}
                        aria-label="Posisi horizontal X persentase"
                        className="w-12 p-1 bg-white border border-slate-300 rounded text-xs text-center"
                      />
                      <span className="text-3xs text-slate-400">%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-3xs font-semibold text-slate-600">Y:</span>
                      <input
                        type="number"
                        min={0}
                        max={95}
                        value={Math.round(activeSelectedOverlay.y_ratio * 100)}
                        onChange={e => handleNumericRatioChange(activeSelectedOverlay.id, 'y_ratio', Number(e.target.value))}
                        aria-label="Posisi vertikal Y persentase"
                        className="w-12 p-1 bg-white border border-slate-300 rounded text-xs text-center"
                      />
                      <span className="text-3xs text-slate-400">%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-3xs font-semibold text-slate-600">Lebar:</span>
                      <input
                        type="number"
                        min={5}
                        max={100}
                        value={Math.round(activeSelectedOverlay.width_ratio * 100)}
                        onChange={e => handleNumericRatioChange(activeSelectedOverlay.id, 'width_ratio', Number(e.target.value))}
                        aria-label="Lebar persentase"
                        className="w-12 p-1 bg-white border border-slate-300 rounded text-xs text-center"
                      />
                      <span className="text-3xs text-slate-400">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOverlay(activeSelectedOverlay.id)}
                      className="text-rose-600 hover:text-rose-700 p-1 rounded hover:bg-rose-100/60 transition flex items-center gap-1 font-semibold text-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Filmstrip Thumbnails */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-2xs font-bold uppercase tracking-wider text-slate-500">
                <span>Daftar Halaman ({pages.length})</span>
                <span className="text-3xs text-slate-400 lowercase">klik untuk berpindah halaman kerja</span>
              </div>
              <div className="flex gap-2 overflow-x-auto py-2 custom-scrollbar">
                {pages.map((p, idx) => {
                  const isSelected = idx === selectedIndex
                  const hasSign = p.overlays.length > 0
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedIndex(idx)}
                      aria-label={`Pilih Halaman ${idx + 1}`}
                      className={`relative shrink-0 p-1 rounded-xl border transition cursor-pointer flex flex-col items-center gap-1 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      data-testid={`thumb-sign-page-${idx}`}
                    >
                      <div className="w-16 h-22 bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center border border-slate-100">
                        <img
                          src={p.thumbnail}
                          alt={`Thumbnail hal ${idx + 1}`}
                          className="max-w-full max-h-full object-contain"
                          style={{
                            transform: `rotate(${p.rotation}deg)`,
                          }}
                        />
                      </div>
                      <span className="text-3xs font-bold text-slate-600">{idx + 1}</span>
                      {hasSign && (
                        <span
                          className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-blue-600 border border-white"
                          title={`${p.overlays.length} elemen tanda tangan terpasang`}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {file && pages.length > 0 && !showChooser && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => {
                setFile(null)
                setPages([])
                setShowChooser(false)
                setErrorMessage(null)
                setSuccessMessage(null)
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
              data-testid="btn-reset-sign"
            >
              Ganti Berkas PDF
            </button>
            <button
              type="button"
              onClick={handleApplyAndDownload}
              disabled={isApplying || pages.length === 0}
              className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-2"
              data-testid="btn-apply-sign"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menerapkan Tanda Tangan...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Terapkan & Unduh PDF</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
