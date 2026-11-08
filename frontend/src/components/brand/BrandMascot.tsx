import React from 'react'
import mascotWebp from '../../assets/kitu-mascot.webp'
import mascotPng from '../../assets/kitu-mascot.png'
import avatarWebp from '../../assets/kitu-avatar.webp'
import avatarPng from '../../assets/kitu-avatar.png'

export type BrandMascotVariant = 'hero' | 'avatar'
export type BrandMascotSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero'

interface BrandMascotProps {
  variant?: BrandMascotVariant
  size?: BrandMascotSize
  className?: string
  alt?: string
  priority?: boolean
  caption?: string
  interactive?: boolean
  onClick?: () => void
}

const SIZE_MAP: Record<BrandMascotVariant, Record<BrandMascotSize, string>> = {
  hero: {
    xs: 'h-16 w-auto',
    sm: 'h-24 w-auto',
    md: 'h-36 w-auto',
    lg: 'h-48 w-auto',
    xl: 'h-64 w-auto',
    hero: 'h-72 sm:h-80 w-auto',
  },
  avatar: {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
    xl: 'h-20 w-20',
    hero: 'h-28 w-28',
  },
}

export const BrandMascot: React.FC<BrandMascotProps> = ({
  variant = 'hero',
  size = 'md',
  className = '',
  alt = 'Kitu — Maskot Resmi Satukit',
  priority = false,
  caption,
  interactive = false,
  onClick,
}) => {
  const sizeClasses = SIZE_MAP[variant][size]
  const isAvatar = variant === 'avatar'

  const content = (
    <div
      className={`inline-flex flex-col items-center justify-center ${
        interactive ? 'cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95' : ''
      } ${className}`}
      onClick={interactive ? onClick : undefined}
      data-testid={isAvatar ? 'kitu-avatar' : 'kitu-mascot'}
    >
      <picture className="inline-flex shrink-0 items-center justify-center">
        <source srcSet={isAvatar ? avatarWebp : mascotWebp} type="image/webp" />
        <img
          src={isAvatar ? avatarPng : mascotPng}
          alt={alt}
          className={`object-contain select-none drop-shadow-sm ${sizeClasses}`}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
        />
      </picture>
      {caption && (
        <span className="mt-1 text-xs font-medium text-stone-600 select-none">
          {caption}
        </span>
      )}
    </div>
  )

  return content
}
