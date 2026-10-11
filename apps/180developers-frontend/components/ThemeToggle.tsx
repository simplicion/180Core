'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const hasDarkClass = document.documentElement.classList.contains('dark');
    setIsDark(hasDarkClass);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('180_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('180_theme', 'light');
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-all duration-200 cursor-pointer shadow-xs"
      title={mounted ? (isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode') : 'Toggle Theme'}
      aria-label="Toggle theme"
    >
      {mounted ? (
        isDark ? (
          <Sun className="w-4 h-4 text-amber-400 hover:rotate-90 transition-transform duration-300" />
        ) : (
          <Moon className="w-4 h-4 text-zinc-600 hover:-rotate-12 transition-transform duration-300" />
        )
      ) : (
        <Sun className="w-4 h-4 text-zinc-400 opacity-60" />
      )}
    </button>
  );
}
