'use strict';

import React, { useState } from 'react';
import { use180GeoPricing } from '../hooks/useGeoPricing';

export interface GeoBannerProps {
  appId: string;
  baseAmount: number;
  baseCurrency?: string;
  countryOverride?: string;
  apiBaseUrl?: string;
  theme?: 'dark' | 'light' | 'glass';
  className?: string;
  onDismiss?: () => void;
}

export const OneEightyGeoBanner: React.FC<GeoBannerProps> = ({
  appId,
  baseAmount,
  baseCurrency = 'USD',
  countryOverride,
  apiBaseUrl,
  theme = 'glass',
  className = '',
  onDismiss,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const { data, loading, hasDiscount } = use180GeoPricing(appId, baseAmount, {
    baseCurrency,
    countryOverride,
    apiBaseUrl,
  });

  if (loading || !hasDiscount || !data?.banner || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  const getThemeStyles = () => {
    switch (theme) {
      case 'dark':
        return {
          background: '#09090b',
          color: '#fafafa',
          border: '1px solid #27272a',
          badgeBg: '#18181b',
          badgeColor: '#10b981',
        };
      case 'light':
        return {
          background: '#ffffff',
          color: '#09090b',
          border: '1px solid #e4e4e7',
          badgeBg: '#f4f4f5',
          badgeColor: '#059669',
        };
      case 'glass':
      default:
        return {
          background: 'rgba(15, 23, 42, 0.85)',
          color: '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(12px)',
          badgeBg: 'rgba(16, 185, 129, 0.15)',
          badgeColor: '#34d399',
        };
    }
  };

  const s = getThemeStyles();

  return (
    <aside
      className={`one-eighty-geo-banner ${className}`}
      aria-label="Purchasing Power Parity Regional Discount"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderRadius: '10px',
        fontSize: '13px',
        fontWeight: 500,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.2s ease',
        ...s,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '20px' }}>{data.banner.flag}</span>
        <div>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              marginRight: '8px',
              background: s.badgeBg,
              color: s.badgeColor,
            }}
          >
            {data.discountPercentage}% OFF
          </span>
          <span>{data.banner.message}</span>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss banner"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          opacity: 0.6,
          cursor: 'pointer',
          padding: '4px',
          marginLeft: '12px',
          fontSize: '16px',
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </aside>
  );
};
