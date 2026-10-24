import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  FileEdit,
  RotateCw,
  Trash2,
  Copy,
  Type,
  Image as ImageIcon,
  PenTool,
  ArrowLeft,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  ChevronUp,
  ChevronDown,
  Layers,
  Undo2,
  Redo2,
  MousePointer,
} from 'lucide-react'
import {
  getPdfEditorPages,
  applyPdfEditor,
  type PdfEditorPageInfo,
  type PdfEditorTextOverlay,
  type PdfEditorImageOverlay,
  type PdfEditorUnifiedOverlay,
  type PdfEditorPageSpec,
} from '../../services/pdfTools'

export interface OverlayItem {
  id: string
  type: 'text' | 'image' | 'drawing' | 'signature'
  name: string
  text?: string
  fontSize?: number
  color?: string
  imageBase64?: string
  xRatio: number
  yRatio: number
  widthRatio: number
  heightRatio: number
}

interface PageItem {
  id: string
  sourceIndex: number
  rotation: number
  width: number
  height: number
  thumbnail: string
  preview?: string
  overlays: OverlayItem[]
}

interface PdfEditorModalProps {
  isOpen: boolean
  onClose: () => void
}

const COLOR_PALETTE = [
  { label: 'Hitam', value: '#1e293b' },
  { label: 'Merah', value: '#dc2626' },
  { label: 'Biru', value: '#1e40af' },
  { label: 'Hijau', value: '#047857' },
  { label: 'Kuning', value: '#d97706' },
  { label: 'Ungu', value: '#7c3aed' },
  { label: 'Putih', value: '#ffffff' },
]

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 30, 36, 48]

export const PdfEditorModal: React.FC<PdfEditorModalProps> = ({ isOpen, onClose }) => {
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<PageItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)

  // Zoom & View
  const [zoom, setZoom] = useState<number>(100)
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'drawing' | 'signature'>('select')

  // Mobile Drawers
  const [showLeftSidebar, setShowLeftSidebar] = useState<boolean>(true)
  const [showRightSidebar, setShowRightSidebar] = useState<boolean>(true)

  // Loading & Alerts
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isApplying, setIsApplying] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Add Text Form State
  const [showAddText, setShowAddText] = useState<boolean>(false)
  const [newText, setNewText] = useState<string>('')
  const [textColor, setTextColor] = useState<string>('#1e293b')
  const [fontSize, setFontSize] = useState<number>(14)
  const [textPosition, setTextPosition] = useState<'top' | 'center' | 'bottom'>('top')

  // Free Draw Modal State
  const [showDrawModal, setShowDrawModal] = useState<boolean>(false)
  const [drawColor, setDrawColor] = useState<string>('#dc2626')
  const [brushWidth, setBrushWidth] = useState<number>(3)
  const [isDrawing, setIsDrawing] = useState<boolean>(false)
  const [hasDrawn, setHasDrawn] = useState<boolean>(false)
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Signature Modal State
  const [showSignModal, setShowSignModal] = useState<boolean>(false)
  const [isSigning, setIsSigning] = useState<boolean>(false)
  const [hasSigned, setHasSigned] = useState<boolean>(false)
  const signCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Image Upload Ref
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)

  // Dragging and resizing overlay
  const dragRef = useRef<{
    active: boolean
    mode: 'move' | 'nw' | 'ne' | 'se' | 'sw'
    startX: number
    startY: number
    initX: number
    initY: number
    initW: number
    initH: number
  }>({
    active: false,
    mode: 'move',
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
    initW: 0,
    initH: 0,
  })

  // Undo / Redo History
  const [history, setHistory] = useState<PageItem[][]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)

  const pushHistory = useCallback((newPages: PageItem[]) => {
    setHistory(prev => {
      const upToCurrent = prev.slice(0, historyIndex + 1)
      const next = [...upToCurrent, JSON.parse(JSON.stringify(newPages))]
      if (next.length > 25) next.shift()
      return next
    })
    setHistoryIndex(prev => Math.min(prev + 1, 24))
  }, [historyIndex])

  const undo = () => {
    if (historyIndex > 0) {
      const prevPages = JSON.parse(JSON.stringify(history[historyIndex - 1]))
      setPages(prevPages)
      setHistoryIndex(historyIndex - 1)
      setSelectedOverlayId(null)
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextPages = JSON.parse(JSON.stringify(history[historyIndex + 1]))
      setPages(nextPages)
      setHistoryIndex(historyIndex + 1)
      setSelectedOverlayId(null)
    }
  }

  useEffect(() => {
    if (!isOpen) {
      setFile(null)
      setPages([])
      setSelectedIndex(0)
      setSelectedOverlayId(null)
      setErrorMessage(null)
      setSuccessMessage(null)
      setShowAddText(false)
      setShowDrawModal(false)
      setShowSignModal(false)
      setHistory([])
      setHistoryIndex(-1)
      setZoom(100)
    }
  }, [isOpen])

  // File loading
  const handleFileSelected = async (selectedFile: File) => {
    setFile(selectedFile)
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsLoading(true)

    try {
      const res = await getPdfEditorPages(selectedFile)
      setIsLoading(false)

      if (res.success && res.pages && res.pages.length > 0) {
        const items: PageItem[] = res.pages.map((p: PdfEditorPageInfo, idx: number) => ({
          id: `page-${idx}-${Date.now()}`,
          sourceIndex: p.original_index,
          rotation: p.rotation,
          width: p.width,
          height: p.height,
          thumbnail: p.thumbnail,
          preview: p.preview || p.thumbnail,
          overlays: [],
        }))
        setPages(items)
        setSelectedIndex(0)
        setHistory([JSON.parse(JSON.stringify(items))])
        setHistoryIndex(0)
      } else {
        setErrorMessage(res.message || 'Gagal memuat halaman dokumen PDF.')
      }
    } catch (err: unknown) {
      setIsLoading(false)
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses dokumen PDF.')
    }
  }

  // Active page accessor
  const currentPage = pages[selectedIndex] || null

  // Page manipulation
  const rotateCurrentPage = () => {
    if (pages.length === 0) return
    setPages(prev => {
      const copy = [...prev]
      const current = copy[selectedIndex]
      copy[selectedIndex] = {
        ...current,
        rotation: (current.rotation + 90) % 360,
      }
      pushHistory(copy)
      return copy
    })
  }

  const duplicateCurrentPage = () => {
    if (pages.length === 0) return
    const current = pages[selectedIndex]
    const duplicated: PageItem = {
      ...current,
      id: `page-${Date.now()}-${Math.random()}`,
      overlays: JSON.parse(JSON.stringify(current.overlays)),
    }
    const nextPages = [...pages]
    nextPages.splice(selectedIndex + 1, 0, duplicated)
    setPages(nextPages)
    setSelectedIndex(selectedIndex + 1)
    pushHistory(nextPages)
  }

  const deleteCurrentPage = () => {
    if (pages.length <= 1) {
      setErrorMessage('Dokumen harus memiliki minimal 1 halaman tersisa.')
      return
    }
    const nextPages = pages.filter((_, idx) => idx !== selectedIndex)
    setPages(nextPages)
    setSelectedIndex(Math.max(0, selectedIndex - 1))
    setSelectedOverlayId(null)
    pushHistory(nextPages)
  }

  const moveCurrentPage = (direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? selectedIndex - 1 : selectedIndex + 1
    if (targetIndex < 0 || targetIndex >= pages.length) return
    const nextPages = [...pages]
    const temp = nextPages[selectedIndex]
    nextPages[selectedIndex] = nextPages[targetIndex]
    nextPages[targetIndex] = temp
    setPages(nextPages)
    setSelectedIndex(targetIndex)
    pushHistory(nextPages)
  }

  // Overlay operations
  const addOverlayToCurrentPage = (overlay: OverlayItem) => {
    if (pages.length === 0) return
    setPages(prev => {
      const copy = [...prev]
      const cur = copy[selectedIndex]
      copy[selectedIndex] = {
        ...cur,
        overlays: [...cur.overlays, overlay],
      }
      pushHistory(copy)
      return copy
    })
    setSelectedOverlayId(null)
  }

  const updateSelectedOverlay = (props: Partial<OverlayItem>) => {
    if (!selectedOverlayId || pages.length === 0) return
    setPages(prev => {
      const copy = [...prev]
      const cur = copy[selectedIndex]
      copy[selectedIndex] = {
        ...cur,
        overlays: cur.overlays.map(o => (o.id === selectedOverlayId ? { ...o, ...props } : o)),
      }
      return copy
    })
  }

  const commitOverlayUpdate = () => {
    pushHistory(pages)
  }

  const removeOverlay = (id?: string) => {
    const targetId = id || selectedOverlayId
    if (!targetId || pages.length === 0) return
    setPages(prev => {
      const copy = [...prev]
      const cur = copy[selectedIndex]
      copy[selectedIndex] = {
        ...cur,
        overlays: cur.overlays.filter(o => o.id !== targetId),
      }
      pushHistory(copy)
      return copy
    })
    if (selectedOverlayId === targetId) setSelectedOverlayId(null)
  }

  const removeAllOverlays = () => {
    if (pages.length === 0) return
    setPages(prev => {
      const copy = [...prev]
      copy[selectedIndex] = {
        ...copy[selectedIndex],
        overlays: [],
      }
      pushHistory(copy)
      return copy
    })
    setSelectedOverlayId(null)
  }

  const moveOverlayZIndex = (direction: 'forward' | 'backward') => {
    if (!selectedOverlayId || !currentPage) return
    const list = [...currentPage.overlays]
    const idx = list.findIndex(o => o.id === selectedOverlayId)
    if (idx === -1) return

    const targetIdx = direction === 'forward' ? idx + 1 : idx - 1
    if (targetIdx < 0 || targetIdx >= list.length) return

    const temp = list[idx]
    list[idx] = list[targetIdx]
    list[targetIdx] = temp

    setPages(prev => {
      const copy = [...prev]
      copy[selectedIndex] = { ...copy[selectedIndex], overlays: list }
      pushHistory(copy)
      return copy
    })
  }

  // Text overlay submit
  const handleSaveTextOverlay = () => {
    if (!newText.trim()) return
    const posCoords = {
      top: { x: 0.1, y: 0.08 },
      center: { x: 0.1, y: 0.45 },
      bottom: { x: 0.1, y: 0.88 },
    }[textPosition]

    const overlay: OverlayItem = {
      id: `txt-${Date.now()}`,
      type: 'text',
      name: `Teks: "${newText.trim().slice(0, 16)}"`,
      text: newText.trim(),
      xRatio: posCoords.x,
      yRatio: posCoords.y,
      widthRatio: 0.4,
      heightRatio: 0.08,
      fontSize: fontSize,
      color: textColor,
    }

    addOverlayToCurrentPage(overlay)
    setNewText('')
    setShowAddText(false)
  }

  // Image overlay upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0]
    if (!imgFile) return
    if (!['image/jpeg', 'image/png'].includes(imgFile.type)) {
      setErrorMessage('Format gambar harus PNG atau JPEG.')
      return
    }
    if (imgFile.size > 5 * 1024 * 1024) {
      setErrorMessage('Ukuran gambar tidak boleh melebihi 5 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      const overlay: OverlayItem = {
        id: `img-${Date.now()}`,
        type: 'image',
        name: `Gambar: ${imgFile.name.slice(0, 14)}`,
        imageBase64: base64,
        xRatio: 0.25,
        yRatio: 0.25,
        widthRatio: 0.35,
        heightRatio: 0.2,
      }
      addOverlayToCurrentPage(overlay)
    }
    reader.readAsDataURL(imgFile)
    e.target.value = ''
  }

  // Drawing canvas helpers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    setIsDrawing(true)
    setHasDrawn(true)
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineWidth = brushWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = drawColor
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  const stopDrawing = () => setIsDrawing(false)

  const clearDrawCanvas = () => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const handleSaveDrawing = () => {
    const canvas = drawCanvasRef.current
    if (!canvas || !hasDrawn) return
    const dataUrl = (canvas.toDataURL && canvas.toDataURL('image/png')) || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    const overlay: OverlayItem = {
      id: `draw-${Date.now()}`,
      type: 'drawing',
      name: 'Coret Bebas',
      imageBase64: dataUrl,
      xRatio: 0.2,
      yRatio: 0.3,
      widthRatio: 0.45,
      heightRatio: 0.25,
    }
    addOverlayToCurrentPage(overlay)
    setShowDrawModal(false)
    setHasDrawn(false)
  }

  // Signature canvas helpers
  const startSigning = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    setIsSigning(true)
    setHasSigned(true)
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const sign = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSigning) return
    const canvas = signCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#0f172a'
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
  }

  const stopSigning = () => setIsSigning(false)

  const clearSignCanvas = () => {
    const canvas = signCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSigned(false)
  }

  const handleSaveSignature = () => {
    const canvas = signCanvasRef.current
    if (!canvas || !hasSigned) return
    const dataUrl = (canvas.toDataURL && canvas.toDataURL('image/png')) || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    const overlay: OverlayItem = {
      id: `sign-${Date.now()}`,
      type: 'signature',
      name: 'Tanda Tangan',
      imageBase64: dataUrl,
      xRatio: 0.6,
      yRatio: 0.8,
      widthRatio: 0.3,
      heightRatio: 0.12,
    }
    addOverlayToCurrentPage(overlay)
    setShowSignModal(false)
    setHasSigned(false)
  }

  // Pointer drag & resize handlers on stage
  const handlePointerDown = (
    e: React.PointerEvent,
    overlay: OverlayItem,
    mode: 'move' | 'nw' | 'ne' | 'se' | 'sw'
  ) => {
    e.stopPropagation()
    setSelectedOverlayId(overlay.id)
    dragRef.current = {
      active: true,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      initX: overlay.xRatio,
      initY: overlay.yRatio,
      initW: overlay.widthRatio,
      initH: overlay.heightRatio,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active || !selectedOverlayId || !stageRef.current) return
    const stage = stageRef.current
    const rect = stage.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const dx = (e.clientX - dragRef.current.startX) / rect.width
    const dy = (e.clientY - dragRef.current.startY) / rect.height
    const { mode, initX, initY, initW, initH } = dragRef.current

    if (mode === 'move') {
      const nextX = Math.max(0, Math.min(1 - initW, initX + dx))
      const nextY = Math.max(0, Math.min(1 - initH, initY + dy))
      updateSelectedOverlay({ xRatio: nextX, yRatio: nextY })
    } else if (mode === 'se') {
      const nextW = Math.max(0.05, Math.min(1 - initX, initW + dx))
      const nextH = Math.max(0.03, Math.min(1 - initY, initH + dy))
      updateSelectedOverlay({ widthRatio: nextW, heightRatio: nextH })
    } else if (mode === 'sw') {
      const nextX = Math.max(0, Math.min(initX + initW - 0.05, initX + dx))
      const nextW = initW + (initX - nextX)
      const nextH = Math.max(0.03, Math.min(1 - initY, initH + dy))
      updateSelectedOverlay({ xRatio: nextX, widthRatio: nextW, heightRatio: nextH })
    } else if (mode === 'ne') {
      const nextY = Math.max(0, Math.min(initY + initH - 0.03, initY + dy))
      const nextH = initH + (initY - nextY)
      const nextW = Math.max(0.05, Math.min(1 - initX, initW + dx))
      updateSelectedOverlay({ yRatio: nextY, widthRatio: nextW, heightRatio: nextH })
    } else if (mode === 'nw') {
      const nextX = Math.max(0, Math.min(initX + initW - 0.05, initX + dx))
      const nextW = initW + (initX - nextX)
      const nextY = Math.max(0, Math.min(initY + initH - 0.03, initY + dy))
      const nextH = initH + (initY - nextY)
      updateSelectedOverlay({ xRatio: nextX, yRatio: nextY, widthRatio: nextW, heightRatio: nextH })
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current.active) {
      dragRef.current.active = false
      commitOverlayUpdate()
      try {
        ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        // Safe fallback if target already released
      }
    }
  }

  // Keyboard navigation for selected overlay
  const handlersRef = useRef({
    updateSelectedOverlay,
    commitOverlayUpdate,
    removeOverlay,
    undo,
    redo,
    currentPage,
    selectedOverlayId,
  })

  useEffect(() => {
    handlersRef.current = {
      updateSelectedOverlay,
      commitOverlayUpdate,
      removeOverlay,
      undo,
      redo,
      currentPage,
      selectedOverlayId,
    }
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const {
        selectedOverlayId: curSelId,
        currentPage: curPage,
        updateSelectedOverlay: curUpdate,
        commitOverlayUpdate: curCommit,
        removeOverlay: curRemove,
        undo: curUndo,
        redo: curRedo,
      } = handlersRef.current

      if (!isOpen || !curSelId || !curPage) return
      // If typing in input or textarea, skip
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

      const selected = curPage.overlays.find(o => o.id === curSelId)
      if (!selected) return

      const step = e.shiftKey ? 0.03 : 0.01

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (e.shiftKey) {
          curUpdate({ widthRatio: Math.max(0.05, selected.widthRatio - step) })
        } else {
          curUpdate({ xRatio: Math.max(0, selected.xRatio - step) })
        }
        curCommit()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (e.shiftKey) {
          curUpdate({ widthRatio: Math.min(1 - selected.xRatio, selected.widthRatio + step) })
        } else {
          curUpdate({ xRatio: Math.min(1 - selected.widthRatio, selected.xRatio + step) })
        }
        curCommit()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (e.shiftKey) {
          curUpdate({ heightRatio: Math.max(0.03, selected.heightRatio - step) })
        } else {
          curUpdate({ yRatio: Math.max(0, selected.yRatio - step) })
        }
        curCommit()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (e.shiftKey) {
          curUpdate({ heightRatio: Math.min(1 - selected.yRatio, selected.heightRatio + step) })
        } else {
          curUpdate({ yRatio: Math.min(1 - selected.heightRatio, selected.yRatio + step) })
        }
        curCommit()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        curRemove(curSelId)
      } else if (e.key === 'Escape') {
        setSelectedOverlayId(null)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) curRedo()
        else curUndo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        curRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Apply changes and download
  const handleApplyAndDownload = async () => {
    if (!file || pages.length === 0) return
    setIsApplying(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    const specs: PdfEditorPageSpec[] = pages.map(p => {
      const textOverlays: PdfEditorTextOverlay[] = []
      const imageOverlays: PdfEditorImageOverlay[] = []
      const unifiedOverlays: PdfEditorUnifiedOverlay[] = []

      p.overlays.forEach(o => {
        if (o.type === 'text') {
          textOverlays.push({
            id: o.id,
            text: o.text || '',
            x_ratio: o.xRatio,
            y_ratio: o.yRatio,
            font_size: o.fontSize || 14,
            color: o.color || '#1e293b',
          })
          unifiedOverlays.push({
            id: o.id,
            type: 'text',
            name: o.name,
            text: o.text || '',
            font_size: o.fontSize || 14,
            color: o.color || '#1e293b',
            x_ratio: o.xRatio,
            y_ratio: o.yRatio,
            width_ratio: o.widthRatio,
            height_ratio: o.heightRatio,
          })
        } else {
          imageOverlays.push({
            id: o.id,
            image_base64: o.imageBase64 || '',
            x_ratio: o.xRatio,
            y_ratio: o.yRatio,
            width_ratio: o.widthRatio,
            height_ratio: o.heightRatio,
          })
          unifiedOverlays.push({
            id: o.id,
            type: o.type,
            name: o.name,
            image_base64: o.imageBase64 || '',
            x_ratio: o.xRatio,
            y_ratio: o.yRatio,
            width_ratio: o.widthRatio,
            height_ratio: o.heightRatio,
          })
        }
      })

      return {
        source_index: p.sourceIndex,
        rotation: p.rotation,
        text_overlays: textOverlays,
        image_overlays: imageOverlays,
        overlays: unifiedOverlays,
      }
    })

    try {
      const res = await applyPdfEditor(file, { pages: specs }, 'edited')
      setIsApplying(false)
      if (res.success) {
        setSuccessMessage(`Berhasil menyimpan dan mengunduh berkas: ${res.filename || 'dokumen_edited.pdf'}`)
      } else {
        setErrorMessage(res.message || 'Gagal menerapkan perubahan dokumen PDF.')
      }
    } catch (err: unknown) {
      setIsApplying(false)
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kegagalan komunikasi saat menerapkan perubahan.')
    }
  }

  if (!isOpen) return null

  // Empty state: Upload file dropzone
  if (!file || pages.length === 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-editor-empty-title"
      >
        <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <FileEdit className="w-5 h-5" />
              </div>
              <div>
                <h2 id="pdf-editor-empty-title" className="font-bold text-slate-800 dark:text-slate-100 text-base">
                  Editor PDF Visual
                </h2>
                <p className="text-xs text-slate-500">Edit teks, gambar, tanda tangan, dan halaman PDF</p>
              </div>
            </div>
            <button
              onClick={onClose}
              data-testid="btn-close-pdf-editor"
              aria-label="Tutup Editor PDF"
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {errorMessage && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <label
              htmlFor="input-pdf-editor-file"
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50/30 dark:bg-slate-800/30 transition-all group"
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 group-hover:scale-105 transition-transform">
                {isLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center mb-1">
                Pilih atau seret berkas PDF ke sini
              </span>
              <span className="text-xs text-slate-400 text-center">
                Mendukung dokumen PDF maksimal 50 MB (tanpa proteksi password)
              </span>
              <input
                id="input-pdf-editor-file"
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                data-testid="input-pdf-editor-file"
                disabled={isLoading}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleFileSelected(f)
                }}
              />
            </label>
          </div>
        </div>
      </div>
    )
  }

  // Selected Overlay Object (if any)
  const selectedOverlay = currentPage?.overlays.find(o => o.id === selectedOverlayId) || null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-slate-100 select-none overflow-hidden animate-fade-in font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Editor PDF Layar Penuh"
    >
      {/* 1. TOP HEADER TOOLBAR */}
      <header className="h-14 bg-slate-800/95 border-b border-slate-700 px-4 flex items-center justify-between gap-3 shrink-0 z-20 backdrop-blur">
        {/* Left: Branding & Page indicator */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            data-testid="btn-close-pdf-editor"
            aria-label="Tutup Editor PDF"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold text-sm tracking-tight text-white hidden sm:inline">Editor PDF Visual</span>
            <span className="text-xs text-slate-400 truncate max-w-[150px] sm:max-w-[220px]" title={file.name}>
              {file.name}
            </span>
            <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-indigo-300">
              Halaman {selectedIndex + 1} dari {pages.length}
            </span>
            <span className="text-2xs text-slate-400 hidden md:inline">
              (Rotasi: {currentPage ? currentPage.rotation : 0}°)
            </span>
          </div>
        </div>

        {/* Center: Tools Toolbar */}
        <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-700/80">
          <button
            onClick={() => setActiveTool('select')}
            aria-label="Mode Pilih / Kursor"
            className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              activeTool === 'select' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <MousePointer className="w-4 h-4" />
            <span className="hidden xl:inline">Pilih</span>
          </button>

          <button
            onClick={() => {
              setActiveTool('text')
              setShowAddText(true)
            }}
            data-testid="btn-toggle-add-text"
            aria-label="Tambah Teks"
            className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              showAddText ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Type className="w-4 h-4 text-indigo-400" />
            <span className="hidden md:inline">Teks</span>
          </button>

          <button
            onClick={() => imageInputRef.current?.click()}
            aria-label="Unggah Gambar"
            className="p-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
          >
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">Gambar</span>
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleImageUpload}
          />

          <button
            onClick={() => setShowDrawModal(true)}
            aria-label="Coret Bebas"
            className="p-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
          >
            <PenTool className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Coret</span>
          </button>

          <button
            onClick={() => setShowSignModal(true)}
            aria-label="Tanda Tangan"
            className="p-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
          >
            <FileEdit className="w-4 h-4 text-rose-400" />
            <span className="hidden md:inline">Tanda Tangan</span>
          </button>

          <div className="w-px h-5 bg-slate-700 mx-1" />

          {/* Undo / Redo */}
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            data-testid="btn-undo"
            aria-label="Urungkan (Undo)"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            data-testid="btn-redo"
            aria-label="Ulangi (Redo)"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Page actions & Drawer toggles */}
        <div className="flex items-center gap-2">
          {/* Page tools quick pill */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-700/80">
            <button
              onClick={rotateCurrentPage}
              data-testid="btn-rotate-page"
              aria-label="Putar Halaman 90 Derajat"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Putar Halaman 90°"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={duplicateCurrentPage}
              data-testid="btn-duplicate-page"
              aria-label="Duplikasi Halaman"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Duplikasi Halaman"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={deleteCurrentPage}
              disabled={pages.length <= 1}
              data-testid="btn-delete-page"
              aria-label="Hapus Halaman"
              className="p-1.5 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-30 disabled:hover:text-slate-300 transition-colors"
              title="Hapus Halaman"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile drawer triggers */}
          <button
            onClick={() => setShowLeftSidebar(prev => !prev)}
            aria-label="Buka / Tutup Daftar Halaman"
            className={`p-2 rounded-lg border text-xs lg:hidden ${
              showLeftSidebar ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 text-slate-300'
            }`}
          >
            Halaman
          </button>
          <button
            onClick={() => setShowRightSidebar(prev => !prev)}
            aria-label="Buka / Tutup Panel Layer"
            className={`p-2 rounded-lg border text-xs lg:hidden ${
              showRightSidebar ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 text-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Alert Banners */}
      {errorMessage && (
        <div className="bg-rose-900/90 text-rose-100 px-4 py-2 text-xs flex items-center justify-between border-b border-rose-800 z-30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-300" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-900/90 text-emerald-100 px-4 py-2 text-xs flex items-center justify-between border-b border-emerald-800 z-30">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. MAIN 3-COLUMN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT COLUMN: Page Filmstrip Sidebar */}
        <aside
          className={`w-56 bg-slate-800/80 border-r border-slate-700 flex flex-col shrink-0 transition-all duration-200 z-10 ${
            showLeftSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 hidden lg:flex'
          }`}
        >
          <div className="p-3 border-b border-slate-700 flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Daftar Halaman ({pages.length})</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => moveCurrentPage('up')}
                disabled={selectedIndex <= 0}
                aria-label="Pindahkan Halaman ke Atas"
                className="p-1 hover:bg-slate-700 rounded disabled:opacity-30"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => moveCurrentPage('down')}
                disabled={selectedIndex >= pages.length - 1}
                aria-label="Pindahkan Halaman ke Bawah"
                className="p-1 hover:bg-slate-700 rounded disabled:opacity-30"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {pages.map((p, idx) => (
              <div
                key={p.id}
                data-testid={`thumb-page-${idx}`}
                onClick={() => {
                  setSelectedIndex(idx)
                  setSelectedOverlayId(null)
                }}
                className={`relative group rounded-xl p-2 cursor-pointer transition-all border text-left ${
                  idx === selectedIndex
                    ? 'border-indigo-500 bg-indigo-950/40 shadow-lg ring-2 ring-indigo-500/30'
                    : 'border-slate-700 hover:border-slate-500 bg-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-2xs font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                    Hal {idx + 1}
                  </span>
                  {p.overlays.length > 0 && (
                    <span className="text-3xs font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                      {p.overlays.length} elemen
                    </span>
                  )}
                </div>

                <div className="aspect-[3/4] bg-white rounded-lg overflow-hidden flex items-center justify-center relative shadow-sm">
                  <img
                    src={p.thumbnail}
                    alt={`Thumbnail halaman ${idx + 1}`}
                    className="w-full h-full object-contain pointer-events-none transition-transform duration-200"
                    style={{ transform: `rotate(${p.rotation}deg)` }}
                  />
                  {p.overlays.length > 0 && (
                    <div className="absolute inset-0 bg-indigo-500/10 pointer-events-none" />
                  )}
                </div>

                <div className="mt-1 flex items-center justify-between text-3xs text-slate-400">
                  <span>{p.rotation}°</span>
                  <span>
                    {Math.round(p.width)}×{Math.round(p.height)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* CENTER COLUMN: High-Resolution Interactive Canvas Stage */}
        <main
          className="flex-1 bg-slate-950 flex flex-col items-center justify-center overflow-auto p-4 sm:p-8 relative"
          onClick={() => setSelectedOverlayId(null)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {currentPage && (
            <div
              ref={stageRef}
              className="relative bg-white shadow-2xl rounded-sm transition-transform duration-100 ease-out origin-center"
              style={{
                width: `${Math.round((currentPage.width * zoom) / 100)}px`,
                height: `${Math.round((currentPage.height * zoom) / 100)}px`,
                maxWidth: '92vw',
                maxHeight: '85vh',
                aspectRatio: `${currentPage.width} / ${currentPage.height}`,
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* PDF Page Raster Prerender */}
              <img
                src={currentPage.preview || currentPage.thumbnail}
                alt={`Halaman PDF ${selectedIndex + 1}`}
                className="w-full h-full object-contain pointer-events-none select-none"
                style={{ transform: `rotate(${currentPage.rotation}deg)` }}
              />

              {/* Overlays Canvas Plane */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {currentPage.overlays.map(overlay => {
                  const isSelected = overlay.id === selectedOverlayId

                  return (
                    <div
                      key={overlay.id}
                      onPointerDown={e => handlePointerDown(e, overlay, 'move')}
                      className={`absolute pointer-events-auto cursor-move select-none group transition-shadow ${
                        isSelected
                          ? 'ring-2 ring-indigo-500 bg-indigo-500/10 shadow-lg z-30'
                          : 'hover:ring-1 hover:ring-indigo-400/60 z-10'
                      }`}
                      style={{
                        left: `${overlay.xRatio * 100}%`,
                        top: `${overlay.yRatio * 100}%`,
                        width: `${overlay.widthRatio * 100}%`,
                        height: `${overlay.heightRatio * 100}%`,
                      }}
                    >
                      {/* Render text overlay */}
                      {overlay.type === 'text' && (
                        <div
                          className="w-full h-full p-1 leading-snug break-words flex items-center justify-start overflow-hidden font-sans font-medium"
                          style={{
                            color: overlay.color || '#1e293b',
                            fontSize: `${Math.max(8, Math.round(((overlay.fontSize || 14) * zoom) / 100))}px`,
                          }}
                        >
                          {overlay.text}
                        </div>
                      )}

                      {/* Render image / drawing / signature overlay */}
                      {overlay.type !== 'text' && overlay.imageBase64 && (
                        <img
                          src={overlay.imageBase64}
                          alt={overlay.name}
                          className="w-full h-full object-contain pointer-events-none"
                        />
                      )}

                      {/* Resize Handles (Active only when selected) */}
                      {isSelected && (
                        <>
                          <div
                            onPointerDown={e => handlePointerDown(e, overlay, 'nw')}
                            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full cursor-nw-resize z-40"
                          />
                          <div
                            onPointerDown={e => handlePointerDown(e, overlay, 'ne')}
                            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full cursor-ne-resize z-40"
                          />
                          <div
                            onPointerDown={e => handlePointerDown(e, overlay, 'se')}
                            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full cursor-se-resize z-40"
                          />
                          <div
                            onPointerDown={e => handlePointerDown(e, overlay, 'sw')}
                            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full cursor-sw-resize z-40"
                          />
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Floating Zoom and Stage Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800/90 border border-slate-700/80 rounded-full px-4 py-1.5 shadow-xl flex items-center gap-3 backdrop-blur z-20">
            <button
              onClick={() => setZoom(prev => Math.max(40, prev - 15))}
              aria-label="Perkecil Kanvas"
              className="p-1 text-slate-300 hover:text-white rounded-full hover:bg-slate-700/60"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-slate-200 min-w-[40px] text-center">{zoom}%</span>
            <button
              onClick={() => setZoom(prev => Math.min(200, prev + 15))}
              aria-label="Perbesar Kanvas"
              className="p-1 text-slate-300 hover:text-white rounded-full hover:bg-slate-700/60"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-700" />
            <button
              onClick={() => setZoom(100)}
              aria-label="Pas Halaman"
              className="text-2xs font-semibold text-slate-300 hover:text-white px-2 py-0.5 rounded hover:bg-slate-700/60"
            >
              Fit
            </button>
          </div>
        </main>

        {/* RIGHT COLUMN: Layers & Properties Panel ("Edit PDF") */}
        <aside
          className={`w-72 bg-slate-800/95 border-l border-slate-700 flex flex-col shrink-0 transition-all duration-200 z-10 ${
            showRightSidebar ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 hidden lg:flex'
          }`}
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h3 className="font-bold text-xs tracking-wider uppercase text-slate-200">Edit PDF</h3>
            </div>
            {currentPage && currentPage.overlays.length > 0 && (
              <button
                onClick={removeAllOverlays}
                className="text-3xs text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded hover:bg-rose-950/40 flex items-center gap-1"
                title="Hapus semua elemen pada halaman aktif"
              >
                <Trash2 className="w-3 h-3" />
                Hapus Semua
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {/* 1. Element Inspector (if selected) */}
            {selectedOverlay ? (
              <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    {selectedOverlay.type === 'text' && <Type className="w-4 h-4 text-indigo-400" />}
                    {selectedOverlay.type === 'image' && <ImageIcon className="w-4 h-4 text-emerald-400" />}
                    {selectedOverlay.type === 'drawing' && <PenTool className="w-4 h-4 text-amber-400" />}
                    {selectedOverlay.type === 'signature' && <FileEdit className="w-4 h-4 text-rose-400" />}
                    <span className="text-xs font-semibold text-white">Atribut Elemen</span>
                  </div>
                  <button
                    onClick={() => removeOverlay(selectedOverlay.id)}
                    aria-label="Hapus Elemen Terpilih"
                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded"
                    title="Hapus elemen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Text Inspector Fields */}
                {selectedOverlay.type === 'text' && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="input-edit-overlay-text" className="block text-2xs text-slate-400 mb-1">
                        Isi Teks
                      </label>
                      <textarea
                        id="input-edit-overlay-text"
                        value={selectedOverlay.text || ''}
                        onChange={e => updateSelectedOverlay({ text: e.target.value })}
                        onBlur={commitOverlayUpdate}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none h-16"
                      />
                    </div>

                    <div>
                      <label htmlFor="select-edit-overlay-font-size" className="block text-2xs text-slate-400 mb-1">
                        Ukuran Font
                      </label>
                      <select
                        id="select-edit-overlay-font-size"
                        value={selectedOverlay.fontSize || 14}
                        onChange={e => {
                          updateSelectedOverlay({ fontSize: Number(e.target.value) })
                          commitOverlayUpdate()
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                      >
                        {FONT_SIZES.map(sz => (
                          <option key={sz} value={sz}>
                            {sz} pt
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="block text-2xs text-slate-400 mb-1.5">Warna Teks</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {COLOR_PALETTE.map(c => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => {
                              updateSelectedOverlay({ color: c.value })
                              commitOverlayUpdate()
                            }}
                            className={`w-5 h-5 rounded-full border transition-transform ${
                              selectedOverlay.color === c.value ? 'scale-125 border-indigo-400 ring-2 ring-indigo-500' : 'border-slate-600'
                            }`}
                            style={{ backgroundColor: c.value }}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Z-Index Controls */}
                <div className="pt-2 border-t border-slate-800">
                  <span className="block text-2xs text-slate-400 mb-1.5">Urutan Layer</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => moveOverlayZIndex('forward')}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-2xs font-medium flex items-center justify-center gap-1"
                    >
                      <ChevronUp className="w-3 h-3" /> Maju
                    </button>
                    <button
                      onClick={() => moveOverlayZIndex('backward')}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-2xs font-medium flex items-center justify-center gap-1"
                    >
                      <ChevronDown className="w-3 h-3" /> Mundur
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-900/40 border border-dashed border-slate-700 rounded-xl text-center">
                <p className="text-2xs text-slate-400">
                  Klik elemen di kanvas atau daftar di bawah untuk menyunting posisi dan atributnya.
                </p>
              </div>
            )}

            {/* 2. Layers List */}
            <div className="space-y-2">
              <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">
                Lapisan Halaman ({currentPage ? currentPage.overlays.length : 0})
              </span>

              {currentPage && currentPage.overlays.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Belum ada elemen tambahan.
                  <br />
                  Gunakan toolbar atas untuk menambahkan.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {currentPage?.overlays.map(item => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedOverlayId(item.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs border transition-all ${
                        item.id === selectedOverlayId
                          ? 'bg-indigo-900/40 border-indigo-500 text-white shadow-sm'
                          : 'bg-slate-900/50 border-slate-700/80 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {item.type === 'text' && <Type className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                        {item.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        {item.type === 'drawing' && <PenTool className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        {item.type === 'signature' && <FileEdit className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                        <span className="truncate max-w-[130px] font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            removeOverlay(item.id)
                          }}
                          aria-label={`Hapus ${item.name}`}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action: Big Red CTA "Terapkan & Unduh PDF" like iLovePDF */}
          <div className="p-4 border-t border-slate-700 bg-slate-850">
            <button
              onClick={handleApplyAndDownload}
              disabled={isApplying}
              data-testid="btn-apply-editor"
              aria-label="Terapkan dan Unduh PDF"
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-rose-600 hover:bg-rose-500 active:scale-[0.98] transition-all shadow-lg shadow-rose-900/40 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses Dokumen...</span>
                </>
              ) : (
                <>
                  <FileEdit className="w-4 h-4" />
                  <span>Terapkan & Unduh PDF</span>
                </>
              )}
            </button>
          </div>
        </aside>
      </div>

      {/* 3. MODALS / SUB-PANELS */}

      {/* Modal: Tambah Teks */}
      {showAddText && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="title-add-text-dialog"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-indigo-400" />
                <h3 id="title-add-text-dialog" className="text-sm font-bold text-white">
                  Tambahkan Teks ke Halaman {selectedIndex + 1}
                </h3>
              </div>
              <button
                onClick={() => setShowAddText(false)}
                aria-label="Tutup Dialog Tambah Teks"
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label htmlFor="input-new-text" className="block text-2xs text-slate-400 mb-1 font-medium">
                Teks yang akan disematkan
              </label>
              <input
                id="input-new-text"
                data-testid="input-new-text"
                type="text"
                value={newText}
                onChange={e => setNewText(e.target.value)}
                placeholder="Contoh: Disetujui Manajer"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="select-font-size" className="block text-2xs text-slate-400 mb-1">
                  Ukuran Font
                </label>
                <select
                  id="select-font-size"
                  value={fontSize}
                  onChange={e => setFontSize(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {FONT_SIZES.map(sz => (
                    <option key={sz} value={sz}>
                      {sz} pt
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="select-text-position" className="block text-2xs text-slate-400 mb-1">
                  Posisi Awal
                </label>
                <select
                  id="select-text-position"
                  value={textPosition}
                  onChange={e => setTextPosition(e.target.value as 'top' | 'center' | 'bottom')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="top">Atas Halaman</option>
                  <option value="center">Tengah Halaman</option>
                  <option value="bottom">Bawah Halaman</option>
                </select>
              </div>
            </div>

            <div>
              <span className="block text-2xs text-slate-400 mb-1.5">Pilihan Warna</span>
              <div className="flex items-center gap-2">
                {COLOR_PALETTE.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setTextColor(c.value)}
                    className={`w-6 h-6 rounded-full border transition-transform ${
                      textColor === c.value ? 'scale-125 border-indigo-400 ring-2 ring-indigo-500' : 'border-slate-600'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddText(false)}
                className="px-3 py-2 text-xs text-slate-400 hover:text-white rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTextOverlay}
                disabled={!newText.trim()}
                data-testid="btn-save-text-overlay"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-colors shadow-md shadow-indigo-900/30"
              >
                Tambahkan Teks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Coret Bebas */}
      {showDrawModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="title-draw-dialog"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-amber-400" />
                <h3 id="title-draw-dialog" className="text-sm font-bold text-white">
                  Coret Bebas di Halaman {selectedIndex + 1}
                </h3>
              </div>
              <button
                onClick={() => setShowDrawModal(false)}
                aria-label="Tutup Dialog Coret Bebas"
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawing Canvas */}
            <div className="bg-white rounded-xl overflow-hidden border-2 border-dashed border-slate-600 flex items-center justify-center relative">
              <canvas
                ref={drawCanvasRef}
                width={450}
                height={220}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="cursor-crosshair bg-white block w-full"
                data-testid="canvas-drawing"
              />
              {!hasDrawn && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 pointer-events-none select-none">
                  Sentuh atau seret mouse untuk membuat coretan
                </div>
              )}
            </div>

            {/* Brush Controls */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xs text-slate-400">Warna:</span>
                <div className="flex items-center gap-1.5">
                  {COLOR_PALETTE.slice(0, 5).map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setDrawColor(c.value)}
                      className={`w-5 h-5 rounded-full border ${
                        drawColor === c.value ? 'scale-125 ring-2 ring-indigo-400' : 'border-slate-600'
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-2xs text-slate-400">Tebal:</span>
                <select
                  value={brushWidth}
                  onChange={e => setBrushWidth(Number(e.target.value))}
                  aria-label="Pilih ketebalan kuas"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                >
                  <option value={2}>Tipis (2px)</option>
                  <option value={4}>Sedang (4px)</option>
                  <option value={7}>Tebal (7px)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={clearDrawCanvas}
                className="text-xs text-slate-400 hover:text-rose-400"
              >
                Bersihkan
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDrawModal(false)}
                className="px-3 py-2 text-xs text-slate-400 hover:text-white rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveDrawing}
                disabled={!hasDrawn}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-colors shadow-md shadow-amber-900/30"
              >
                Terapkan Coretan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tanda Tangan */}
      {showSignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="title-sign-dialog"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-rose-400" />
                <h3 id="title-sign-dialog" className="text-sm font-bold text-white">
                  Tanda Tangan Halaman {selectedIndex + 1}
                </h3>
              </div>
              <button
                onClick={() => setShowSignModal(false)}
                aria-label="Tutup Dialog Tanda Tangan"
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Signature Canvas */}
            <div className="bg-white rounded-xl overflow-hidden border-2 border-dashed border-slate-600 flex items-center justify-center relative">
              <canvas
                ref={signCanvasRef}
                width={380}
                height={160}
                onMouseDown={startSigning}
                onMouseMove={sign}
                onMouseUp={stopSigning}
                onMouseLeave={stopSigning}
                className="cursor-crosshair bg-white block w-full"
                data-testid="canvas-signature"
              />
              {!hasSigned && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 pointer-events-none select-none">
                  Goreskan tanda tangan Anda di sini
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={clearSignCanvas}
                className="text-xs text-slate-400 hover:text-rose-400"
              >
                Hapus Goresan
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSignModal(false)}
                  className="px-3 py-2 text-xs text-slate-400 hover:text-white rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveSignature}
                  disabled={!hasSigned}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-colors shadow-md shadow-rose-900/30"
                >
                  Gunakan Tanda Tangan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
