'use client';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { dashboardApi } from '@/lib/api';
import {
  Users, Building2, CalendarCheck, AlertTriangle, FileText,
  CheckCircle, Clock, TrendingUp, Package, ShieldAlert
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Legend
} from 'recharts';

const COLORS = { primary: '#1E3A5F', amber: '#F59E0B', green: '#10B981', red: '#EF4444' };

function StatCard({ icon: Icon, label, value, color = 'primary', sub }: {
  icon: React.ElementType; label: string; value: number | string; color?: string; sub?: string;
}) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary-50 text-primary dark:bg-primary-900/30 dark:text-primary-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="stat-value">{value ?? '-'}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const mockChartData = [
  { month: 'Jan', meetings: 12, quotations: 4 },
  { month: 'Feb', meetings: 18, quotations: 6 },
  { month: 'Mar', meetings: 22, quotations: 9 },
  { month: 'Apr', meetings: 15, quotations: 5 },
  { month: 'May', meetings: 28, quotations: 11 },
  { month: 'Jun', meetings: 34, quotations: 14 },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', isAdmin ? 'admin' : 'user'],
    queryFn: () => isAdmin ? dashboardApi.admin() : dashboardApi.user(),
    retry: false,
  });

  const stats = data?.data?.data || {};
  const chartData = stats.monthlyActivity?.length ? stats.monthlyActivity : mockChartData;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="stat-card animate-pulse">
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg mb-3" />
            <div className="w-16 h-7 bg-slate-200 dark:bg-slate-700 rounded mb-1" />
            <div className="w-24 h-4 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="page-title">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="page-subtitle">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* KPI grid */}
      {isAdmin ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard icon={Building2} label="Total customers" value={stats.totalCustomers ?? 0} />
          <StatCard icon={Users} label="New this month" value={stats.newCustomers ?? 0} color="green" />
          <StatCard icon={CalendarCheck} label="Follow-ups today" value={stats.followUpsToday ?? 0} color="amber" />
          <StatCard icon={AlertTriangle} label="Overdue follow-ups" value={stats.overdueFollowUps ?? 0} color="red" />
          <StatCard icon={Package} label="Trials planned" value={stats.trialsPlanned ?? 0} />
          <StatCard icon={CheckCircle} label="Trials completed" value={stats.trialsCompleted ?? 0} color="green" />
          <StatCard icon={FileText} label="Quotations sent" value={stats.quotationsSent ?? 0} color="amber" />
          <StatCard icon={ShieldAlert} label="Pending approvals" value={stats.pendingApprovals ?? 0} color="red" />
          <StatCard icon={Clock} label="Present today" value={stats.presentToday ?? 0} color="green" />
          <StatCard icon={TrendingUp} label="Leave requests" value={stats.leaveRequests ?? 0} color="amber" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard icon={CalendarCheck} label="My follow-ups today" value={stats.myFollowUpsToday ?? 0} color="amber" />
          <StatCard icon={AlertTriangle} label="Overdue" value={stats.myOverdue ?? 0} color="red" />
          <StatCard icon={FileText} label="My quotations" value={stats.myQuotations ?? 0} />
          <StatCard icon={Building2} label="My customers" value={stats.myCustomers ?? 0} />
          <StatCard icon={Clock} label="Check-in status" value={stats.checkedIn ? 'Checked in' : 'Not checked in'} color={stats.checkedIn ? 'green' : 'amber'} />
          <StatCard icon={TrendingUp} label="Meetings this month" value={stats.meetingsThisMonth ?? 0} color="primary" />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="section-title mb-4">Monthly activity</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gMeetings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="meetings" stroke={COLORS.primary} fill="url(#gMeetings)" strokeWidth={2} name="Meetings" />
              <Area type="monotone" dataKey="quotations" stroke={COLORS.amber} fill="transparent" strokeWidth={2} strokeDasharray="4 2" name="Quotations" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="section-title mb-4">Quotation conversion</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="meetings" fill={COLORS.primary} radius={[3, 3, 0, 0]} name="Meetings" />
              <Bar dataKey="quotations" fill={COLORS.amber} radius={[3, 3, 0, 0]} name="Quotations" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Overdue follow-ups */}
      <div className="card p-5">
        <h2 className="section-title mb-1">Overdue follow-ups</h2>
        <p className="page-subtitle mb-4">Customers waiting for a response</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                {['Customer', 'Contact', 'Last meeting', 'Due date', 'Status', ''].map((h) => (
                  <th key={h} className="table-head text-left pb-2 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(!stats.overdueList?.length) ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted">No overdue follow-ups 🎉</td></tr>
              ) : stats.overdueList.map((f: { id: string; customerId: string; customer: { companyName: string; contactPerson: string }; nextFollowUp: string; status: string }) => (
                <tr key={f.id} className="table-row">
                  <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-slate-100">{f.customer.companyName}</td>
                  <td className="py-2.5 pr-4 text-muted">{f.customer.contactPerson}</td>
                  <td className="py-2.5 pr-4 text-muted">-</td>
                  <td className="py-2.5 pr-4 text-red-500">{new Date(f.nextFollowUp).toLocaleDateString('en-IN')}</td>
                  <td className="py-2.5 pr-4"><span className="badge badge-yellow">{f.status.replace(/_/g, ' ')}</span></td>
                  <td className="py-2.5"><a href={`/customers/${f.customerId}`} className="text-primary text-xs hover:underline">View</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
