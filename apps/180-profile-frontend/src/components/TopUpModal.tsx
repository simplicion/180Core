'use client';

import React from 'react';
import { OneEightyPayBottomSheet, OneEightyPayBottomSheetProps } from './OneEightyPayBottomSheet';

export interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBalance?: number) => void;
  currentBalance?: number;
  initialAmount?: number;
}

export function TopUpModal(props: TopUpModalProps) {
  return <OneEightyPayBottomSheet {...props} />;
}

export default TopUpModal;
