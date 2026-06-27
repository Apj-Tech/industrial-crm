'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import {
  LayoutDashboard, Users, Building2, CalendarCheck, FileText,
  Package, BarChart3, Clock, CalendarOff, ShieldCheck, Bell,
  ClipboardList, LogOut, X, ChevronRight, Boxes, Tags, Radio,
  MapPin, TrendingUp,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { meetingsApi } from '@/lib/api';
import clsx from 'clsx';

interface SidebarProps { isOpen: boolean; onClose: () => void; }

const navItems = [
  { label: 'Dashboard',            href: '/dashboard',      icon: LayoutDashboard, section: null },
  { label: 'Customers',            href: '/customers',      icon: Building2,       section: 'CRM' },
  { label: 'Customer map',         href: '/customers/map',  icon: MapPin,          section: 'CRM' },
  { label: 'Meetings & follow-ups',href: '/meetings',       icon: CalendarCheck,   section: 'CRM' },
  { label: 'Products',             href: '/products',       icon: Package,         section: 'Sales' },
  { label: 'Quotations',           href: '/quotations',     icon: FileText,        section: 'Sales' },
  { label: 'Stock',                href: '/stock',          icon: Boxes,           section: 'Sales' },
  { label: 'Analytics',            href: '/analytics',      icon: TrendingUp,      section: 'Reports' },
  { label: 'Attendance',           href: '/attendance',     icon: Clock,           section: 'Operations' },
  { label: 'Leave',                href: '/leaves',         icon: CalendarOff,     section: 'Operations' },
];

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

const adminItems = [
  { label: 'Live tracking',  href: '/admin/live-tracking', icon: Radio,        roles: ADMIN_ROLES },
  { label: 'Categories',     href: '/admin/categories',    icon: Tags,         roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Users',          href: '/admin/users',         icon: Users,        roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Approvals',      href: '/admin/approvals',     icon: ShieldCheck,  roles: ADMIN_ROLES },
  { label: 'Reports',        href: '/admin/reports',       icon: BarChart3,    roles: ADMIN_ROLES },
  { label: 'Activity logs',  href: '/admin/activity',      icon: ClipboardList,roles: ADMIN_ROLES },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Administrator',
  MANAGER: 'Manager', SALES_ENGINEER: 'Sales Engineer', SALES: 'Sales',
};

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const { data: alertData } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: () => meetingsApi.alerts().then(r => r.data.data?.count || 0),
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const alertCount = alertData as number || 0;

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const handleLogout = () => { clearAuth(); router.push('/login'); };

  const userRole = user?.role || 'SALES';
  const visibleAdminItems = adminItems.filter(i => i.roles.includes(userRole));

  const sections = ['', 'CRM', 'Sales', 'Reports', 'Operations'];

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onClose} />}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-40 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 transition-transform duration-300 w-64',
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">Industrial CRM</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{ROLE_LABELS[userRole] || userRole}</p>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden p-1 rounded text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alerts shortcut */}
        <div className="px-2 pt-3">
          <Link href="/alerts" onClick={onClose}
            className={clsx('sidebar-link relative', isActive('/alerts') && 'sidebar-link-active')}>
            <Bell className="w-4 h-4 shrink-0" />
            <span className="flex-1">Alerts & reminders</span>
            {alertCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
            {isActive('/alerts') && !alertCount && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
          </Link>
        </div>

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {sections.map((section) => {
            const items = navItems.filter(n => section === '' ? n.section === null : n.section === section);
            if (!items.length) return null;
            return (
              <div key={section}>
                {section && <p className="sidebar-section">{section}</p>}
                {items.map(({ label, href, icon: Icon }) => (
                  <Link key={href} href={href} onClick={onClose}
                    className={clsx('sidebar-link', isActive(href) && 'sidebar-link-active')}>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {isActive(href) && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                  </Link>
                ))}
              </div>
            );
          })}

          {/* Admin section — visible based on role */}
          {visibleAdminItems.length > 0 && (
            <div>
              <p className="sidebar-section">Admin</p>
              {visibleAdminItems.map(({ label, href, icon: Icon }) => (
                <Link key={href} href={href} onClick={onClose}
                  className={clsx('sidebar-link', isActive(href) && 'sidebar-link-active')}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {isActive(href) && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
                </Link>
              ))}
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
            <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary dark:text-primary-300">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{ROLE_LABELS[userRole] || userRole}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="sidebar-link w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600">
            <LogOut className="w-4 h-4 shrink-0" /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
