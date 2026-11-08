import React from 'react'

export interface FooterProps {
  className?: string
}

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  return (
    <footer
      className={`border-t border-stone-200/90 dark:border-stone-800/90 pt-6 pb-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-stone-600 dark:text-stone-400 transition-colors ${className}`}
      data-testid="app-footer"
    >
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-stone-600 dark:text-stone-400">
        <span className="font-medium text-stone-700 dark:text-stone-300">© 2026 Satukit</span>
        <span aria-hidden="true" className="text-stone-300 dark:text-stone-600">·</span>
        <span>Satu Tempat, Banyak Solusi Digital</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span>Dikembangkan oleh</span>
        <a
          href="https://porto.rahmath72.cloud/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-stone-800 dark:text-stone-200 hover:text-teal-800 dark:hover:text-teal-300 underline decoration-stone-300 dark:decoration-stone-600 hover:decoration-teal-700 dark:hover:decoration-teal-400 underline-offset-2 transition-colors rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
          data-testid="footer-developer-link"
        >
          Rahmat Hidayat
        </a>
      </div>
    </footer>
  )
}
