import React from 'react'

export interface FooterProps {
  className?: string
}

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  return (
    <footer
      className={`border-t border-stone-200/90 pt-6 pb-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600 ${className}`}
      data-testid="app-footer"
    >
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-stone-600">
        <span className="font-medium text-stone-700">© 2026 Doc-builder</span>
        <span aria-hidden="true" className="text-stone-300">·</span>
        <span>Aplikasi Pembuat CV &amp; Pengolah Dokumen Privat</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span>Dikembangkan oleh</span>
        <a
          href="https://porto.rahmath72.cloud/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-stone-800 hover:text-teal-800 underline decoration-stone-300 hover:decoration-teal-700 underline-offset-2 transition-colors rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
          data-testid="footer-developer-link"
        >
          Rahmat Hidayat
        </a>
      </div>
    </footer>
  )
}
