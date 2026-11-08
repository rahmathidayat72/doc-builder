import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

interface ThemeToggleProps {
  className?: string
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, isDark, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
      title={isDark ? 'Mode Terang' : 'Mode Gelap'}
      data-testid="theme-toggle-btn"
      className={`relative inline-flex items-center gap-1 p-1 rounded-full bg-stone-200/90 dark:bg-stone-800 border border-stone-300 dark:border-stone-700/80 cursor-pointer select-none transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-teal-700 dark:focus-visible:outline-teal-400 ${className}`}
    >
      {/* Sun Icon Indicator */}
      <span
        className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${
          !isDark
            ? 'bg-white text-amber-500 shadow-xs scale-105 font-bold'
            : 'text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300'
        }`}
      >
        <Sun className="w-3.5 h-3.5" aria-hidden="true" />
      </span>

      {/* Moon Icon Indicator */}
      <span
        className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${
          isDark
            ? 'bg-stone-950 text-teal-400 shadow-xs scale-105 font-bold'
            : 'text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300'
        }`}
      >
        <Moon className="w-3.5 h-3.5" aria-hidden="true" />
      </span>
      <span className="sr-only">
        {theme === 'dark' ? 'Mode Gelap Aktif' : 'Mode Terang Aktif'}
      </span>
    </button>
  )
}
