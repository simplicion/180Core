import React from 'react';
import { ProjectProvider } from '@/context/ProjectContext';

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProjectProvider>{children}</ProjectProvider>;
}
