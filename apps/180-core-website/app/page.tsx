import React from 'react';
import { HeroSection } from '@/components/HeroSection';
import { PillarsShowcase } from '@/components/PillarsShowcase';
import { ArchitectureAndCodeSection } from '@/components/ArchitectureAndCodeSection';
import { EcosystemStrip } from '@/components/EcosystemStrip';
import { FinalCtaSection } from '@/components/FinalCtaSection';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <PillarsShowcase />
      <ArchitectureAndCodeSection />
      <EcosystemStrip />
      <FinalCtaSection />
    </>
  );
}
