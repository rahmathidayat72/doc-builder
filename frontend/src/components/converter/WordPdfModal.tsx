import React, { useState } from 'react'
import { ArrowRightLeft, FileCode, FileText, X } from 'lucide-react'
import { DocxToPdfModal } from './DocxToPdfModal'
import { PdfToDocxModal } from './PdfToDocxModal'

export type WordPdfTab = 'docx2pdf' | 'pdf2docx'

interface WordPdfModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: WordPdfTab
}

interface WordPdfModalContentProps {
  initialTab: WordPdfTab
  onClose: () => void
}

const WordPdfModalContent: React.FC<WordPdfModalContentProps> = ({
  initialTab,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<WordPdfTab>(initialTab)

  const handleTabChange = (tab: WordPdfTab) => {
    if (tab === activeTab) return
    setActiveTab(tab)
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-overlay-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="word-pdf-modal-title"
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-stone-200 animate-fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-50 text-teal-800 border border-teal-200 rounded-lg inline-flex items-center gap-1">
              <FileCode className="w-4 h-4" />
              <ArrowRightLeft className="w-3 h-3 opacity-75" />
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 id="word-pdf-modal-title" className="text-base font-bold text-stone-900">
                Word &amp; PDF
              </h3>
              <p className="text-xs text-stone-600">
                Konversi DOCX ke PDF atau rekonstruksi PDF menjadi dokumen Word.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal konversi Word & PDF"
            className="text-stone-500 hover:text-stone-800 p-1.5 rounded-lg transition cursor-pointer"
            data-testid={
              activeTab === 'docx2pdf' ? 'btn-close-converter' : 'btn-close-pdf2docx'
            }
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-stone-100 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => handleTabChange('docx2pdf')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'docx2pdf'
                ? 'bg-white text-teal-800 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            data-testid="tab-docx2pdf"
          >
            Word ke PDF
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('pdf2docx')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'pdf2docx'
                ? 'bg-white text-teal-800 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            data-testid="tab-pdf2docx"
          >
            PDF ke Word
          </button>
        </div>

        {/* Konten Tab Tersemat (reset otomatis saat berganti tab karena unmount/remount) */}
        {activeTab === 'docx2pdf' ? (
          <DocxToPdfModal key="docx2pdf" isOpen={true} onClose={onClose} embedded />
        ) : (
          <PdfToDocxModal key="pdf2docx" isOpen={true} onClose={onClose} embedded />
        )}
      </div>
    </div>
  )
}

export const WordPdfModal: React.FC<WordPdfModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'docx2pdf',
}) => {
  if (!isOpen) return null
  return <WordPdfModalContent key={initialTab} initialTab={initialTab} onClose={onClose} />
}
