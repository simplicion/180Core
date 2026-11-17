'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@workspace/ui';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    try {
      localStorage.setItem('180_theme_user_set', 'true');
      if (nextDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('180_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('180_theme', 'light');
      }
    } catch {
      // Ignore storage failures in restricted contexts
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className="h-11 w-11 rounded-xl border-zinc-200 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      title={mounted ? (isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode') : 'Toggle Theme'}
      aria-label="Toggle color theme"
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4 text-amber-400" />
        ) : (
          <Moon className="h-4 w-4 text-zinc-700" />
        )
      ) : (
        <Moon className="h-4 w-4 text-zinc-400" />
      )}
    </Button>
  );
}
