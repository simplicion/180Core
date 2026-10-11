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
          light: '/180-core-logo.svg',
          dark: '/180-core-logo-dark.svg',
          fallbackLight: '/180-core-logo.png',
          fallbackDark: '/180-core-logo-dark.png',
          aspect: 'aspect-[932/223]',
          defaultHeight: 44,
        };
      case 'icon':
        return {
          light: '/180-core-infinity-icon.svg',
          dark: '/180-core-infinity-icon.svg',
          fallbackLight: '/180-core-icon.png',
          fallbackDark: '/180-core-icon-dark.png',
          aspect: 'aspect-square',
          defaultHeight: 32,
        };
      case 'infinity':
        return {
          light: '/180-core-infinity-icon.svg',
          dark: '/180-core-infinity-icon.svg',
          fallbackLight: '/180-core-infinity-icon.png',
          fallbackDark: '/180-core-infinity-icon-dark.png',
          aspect: 'aspect-square',
          defaultHeight: 32,
        };
      case 'compact':
      default:
        return {
          light: '/180-core-logo-compact.svg',
          dark: '/180-core-logo-compact-dark.svg',
          fallbackLight: '/180-core-logo-compact.png',
          fallbackDark: '/180-core-logo-compact-dark.png',
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
          onError={(e) => {
            if (asset.fallbackLight && !e.currentTarget.src.endsWith(asset.fallbackLight)) {
              e.currentTarget.src = asset.fallbackLight;
            }
          }}
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
          onError={(e) => {
            if (asset.fallbackDark && !e.currentTarget.src.endsWith(asset.fallbackDark)) {
              e.currentTarget.src = asset.fallbackDark;
            }
          }}
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
