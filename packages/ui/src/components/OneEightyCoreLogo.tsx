'use client';

import React from 'react';
import { clsx } from 'clsx';

export type OneEightyLogoVariant = 'full' | 'compact' | 'icon' | 'infinity';
export type OneEightyLogoTheme = 'auto' | 'light' | 'dark';

export interface OneEightyCoreLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: OneEightyLogoVariant;
  theme?: OneEightyLogoTheme;
  height?: number | string;
  width?: number | string;
  className?: string;
  imageClassName?: string;
  alt?: string;
  priority?: boolean;
}

export function OneEightyCoreLogo({
  variant = 'compact',
  theme = 'auto',
  height,
  width,
  className,
  imageClassName,
  alt = '180 Core — Developer Infrastructure',
  style,
  ...props
}: OneEightyCoreLogoProps) {
  // Determine asset sources
  const getAssetSources = () => {
    switch (variant) {
      case 'full':
        return {
          light: '/180-core-logo.png',
          dark: '/180-core-logo-dark.png',
          aspect: 'aspect-[932/223]',
          defaultHeight: 44,
        };
      case 'icon':
        return {
          light: '/180-core-icon.png',
          dark: '/180-core-icon-dark.png',
          aspect: 'aspect-square',
          defaultHeight: 32,
        };
      case 'infinity':
        return {
          light: '/180-core-infinity-icon.png',
          dark: '/180-core-infinity-icon-dark.png',
          aspect: 'aspect-square',
          defaultHeight: 32,
        };
      case 'compact':
      default:
        return {
          light: '/180-core-logo-compact.png',
          dark: '/180-core-logo-compact-dark.png',
          aspect: 'aspect-[932/175]',
          defaultHeight: 36,
        };
    }
  };

  const asset = getAssetSources();
  const appliedHeight = height || asset.defaultHeight;

  return (
    <div
      className={clsx('relative inline-flex items-center shrink-0 select-none', className)}
      style={{
        height: typeof appliedHeight === 'number' ? `${appliedHeight}px` : appliedHeight,
        width: width ? (typeof width === 'number' ? `${width}px` : width) : 'auto',
        ...style,
      }}
      {...props}
    >
      {/* Light version */}
      {(theme === 'auto' || theme === 'light') && (
        <img
          src={asset.light}
          alt={alt}
          className={clsx(
            'h-full w-auto object-contain max-w-full',
            asset.aspect,
            theme === 'auto' && 'block dark:hidden',
            imageClassName
          )}
          loading="eager"
        />
      )}

      {/* Dark version */}
      {(theme === 'auto' || theme === 'dark') && (
        <img
          src={asset.dark}
          alt={alt}
          className={clsx(
            'h-full w-auto object-contain max-w-full',
            asset.aspect,
            theme === 'auto' && 'hidden dark:block',
            imageClassName
          )}
          loading="eager"
        />
      )}
    </div>
  );
}

export function OneEightyCoreIcon({
  size = 32,
  theme = 'auto',
  className,
  ...props
}: Omit<OneEightyCoreLogoProps, 'variant' | 'height' | 'width'> & { size?: number | string }) {
  return (
    <OneEightyCoreLogo
      variant="icon"
      theme={theme}
      height={size}
      width={size}
      className={className}
      {...props}
    />
  );
}

export default OneEightyCoreLogo;
