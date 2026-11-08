import React from 'react'
import logoWebp from '../../assets/satukit-logo.webp'
import logoPng from '../../assets/satukit-logo.png'
import iconWebp from '../../assets/satukit-icon.webp'
import iconPng from '../../assets/satukit-icon.png'
import appIconPng from '../../assets/satukit-app-icon.png'

export type BrandLogoVariant = 'horizontal' | 'icon' | 'app-icon'
export type BrandLogoSize = 'sm' | 'md' | 'lg' | 'xl'

interface BrandLogoProps {
  variant?: BrandLogoVariant
  size?: BrandLogoSize
  className?: string
  alt?: string
  priority?: boolean
}

const SIZE_MAP: Record<BrandLogoVariant, Record<BrandLogoSize, string>> = {
  horizontal: {
    sm: 'h-6 w-auto',
    md: 'h-8 w-auto',
    lg: 'h-11 w-auto',
    xl: 'h-16 w-auto',
  },
  icon: {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-11 w-11',
    xl: 'h-16 w-16',
  },
  'app-icon': {
    sm: 'h-7 w-7 rounded-lg',
    md: 'h-9 w-9 rounded-xl',
    lg: 'h-12 w-12 rounded-2xl',
    xl: 'h-16 w-16 rounded-3xl',
  },
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  alt = 'Satukit — Satu Tempat, Banyak Solusi Digital',
  priority = false,
}) => {
  const sizeClasses = SIZE_MAP[variant][size]

  if (variant === 'icon') {
    return (
      <picture className={`inline-flex shrink-0 items-center justify-center ${className}`}>
        <source srcSet={iconWebp} type="image/webp" />
        <img
          src={iconPng}
          alt={alt}
          className={`object-contain ${sizeClasses}`}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          data-testid="satukit-icon"
        />
      </picture>
    )
  }

  if (variant === 'app-icon') {
    return (
      <div className={`inline-flex shrink-0 items-center justify-center overflow-hidden shadow-xs ${className}`}>
        <img
          src={appIconPng}
          alt={alt}
          className={`object-cover ${sizeClasses}`}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          data-testid="satukit-app-icon"
        />
      </div>
    )
  }

  return (
    <picture className={`inline-flex shrink-0 items-center ${className}`}>
      <source srcSet={logoWebp} type="image/webp" />
      <img
        src={logoPng}
        alt={alt}
        className={`object-contain ${sizeClasses}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        data-testid="satukit-horizontal-logo"
      />
    </picture>
  )
}
