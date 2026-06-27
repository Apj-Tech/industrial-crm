'use client';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { Menu, Sun, Moon, Bell, Search } from 'lucide-react';

interface HeaderProps { onMenuClick: () => void; title?: string; }

export default function Header({ onMenuClick, title }: HeaderProps) {
  const user = useAuthStore((s) => s.user);
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('crm_theme', next ? 'dark' : 'light');
  };

  return (
    <header className="h-16 fixed top-0 right-0 left-0 md:left-64 z-20 flex items-center gap-3 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
      {/* Mobile hamburger */}
      <button onClick={onMenuClick} className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title */}
      {title && (
        <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate hidden sm:block">{title}</h1>
      )}

      <div className="flex-1" />

      {/* Search (desktop) */}
      <button className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
        <Search className="w-3.5 h-3.5" />
        <span>Quick search…</span>
        <kbd className="ml-2 text-[10px] bg-slate-100 dark:bg-slate-700 rounded px-1 py-0.5">⌘K</kbd>
      </button>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
      >
        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Notifications */}
      <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
      </button>

      {/* Avatar */}
      <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center cursor-pointer">
        <span className="text-xs font-bold text-primary dark:text-primary-300">
          {user?.name?.charAt(0).toUpperCase()}
        </span>
      </div>
    </header>
  );
}
