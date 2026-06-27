'use client';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import dynamic from 'next/dynamic';
import { BarChart3, TrendingUp, Users, Building2, Clock, Trophy, Target, AlertTriangle } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#1E3A5F', '#2563EB', '#16A34A', '#F59E0B', '#DC2626', '#9333EA', '#0E7490'];

function StatCard({ title, value, sub, icon: Icon, color = 'text-primary' }: any) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{value ?? '—'}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl bg-primary-50 dark:bg-primary-900/20 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: overviewData, isLoading: ovLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => analyticsApi.overview().then(r => r.data.data),
    staleTime: 60000,
  });
  const { data: monthlyData } = useQuery({
    queryKey: ['analytics-monthly'],
    queryFn: () => analyticsApi.monthly(6).then(r => r.data.data?.data),
    staleTime: 60000,
  });
  const { data: empData } = useQuery({
    queryKey: ['analytics-employee'],
    queryFn: () => analyticsApi.employee().then(r => r.data.data?.employees),
    staleTime: 60000,
  });
  const { data: segData } = useQuery({
    queryKey: ['analytics-segmentation'],
    queryFn: () => analyticsApi.segmentation().then(r => r.data.data),
    staleTime: 60000,
  });
  const { data: winLossData } = useQuery({
    queryKey: ['analytics-winloss'],
    queryFn: () => analyticsApi.winLoss().then(r => r.data.data?.data),
    staleTime: 60000,
  });

  const ov = overviewData || {} as any;
  const monthly = monthlyData || [];
  const employees = empData || [];
  const seg = segData || {} as any;
  const winLoss = winLossData || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Analytics Dashboard</h1>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total Customers" value={ov.customers?.total} sub={`${ov.customers?.newThisMonth ?? 0} new this month`} icon={Building2} />
        <StatCard title="Total Meetings" value={ov.meetings?.total} sub={`${ov.meetings?.today ?? 0} today`} icon={Target} />
        <StatCard title="Customer Visits" value={ov.visits?.total} sub={`Avg ${ov.visits?.avgDurationMinutes ?? 0} min/visit`} icon={Clock} />
        <StatCard title="PO Received" value={ov.meetings?.poReceived} sub={`${ov.meetings?.overdueFollowUps ?? 0} overdue`} icon={Trophy} color="text-green-600" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Active Customers" value={ov.customers?.active} icon={Users} />
        <StatCard title="Trials Planned" value={ov.meetings?.trialsPlanned} icon={Target} />
        <StatCard title="Trials Completed" value={ov.meetings?.trialsCompleted} icon={Trophy} />
        <StatCard title="Overdue Follow-ups" value={ov.meetings?.overdueFollowUps} icon={AlertTriangle} color="text-red-500" />
      </div>

      {/* Monthly activity chart */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Monthly Activity (Last 6 Months)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="meetings" stroke="#1E3A5F" fill="#1E3A5F22" name="Meetings" />
            <Area type="monotone" dataKey="visits" stroke="#2563EB" fill="#2563EB22" name="Visits" />
            <Area type="monotone" dataKey="quotations" stroke="#F59E0B" fill="#F59E0B22" name="Quotations" />
            <Area type="monotone" dataKey="orders" stroke="#16A34A" fill="#16A34A22" name="PO Received" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Win/Loss analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Win / Loss Analysis</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={winLoss}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="won" fill="#16A34A" name="Won" radius={[3,3,0,0]} />
              <Bar dataKey="lost" fill="#DC2626" name="Lost" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Customer by Status</h2>
          {seg.byStatus?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={seg.byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ status, count }) => `${status}: ${count}`}>
                  {(seg.byStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-52 flex items-center justify-center text-slate-400 text-sm">No data yet</div>}
        </div>
      </div>

      {/* Employee performance */}
      {employees.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Employee Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  {['#', 'Name', 'Department', 'Visits (Month)', 'Total Visits', 'Avg Duration', 'Overdue', 'PO Won'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {employees.map((e: any, i: number) => (
                  <tr key={e.user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2.5 text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100">{e.user.name}</td>
                    <td className="px-3 py-2.5 text-slate-500">{e.user.department || '—'}</td>
                    <td className="px-3 py-2.5 font-semibold text-primary">{e.monthVisits}</td>
                    <td className="px-3 py-2.5">{e.totalVisits}</td>
                    <td className="px-3 py-2.5">{e.avgDurationMinutes} min</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-medium ${e.overdueFollowUps > 0 ? 'text-red-500' : 'text-green-600'}`}>{e.overdueFollowUps}</span>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-green-600">{e.wonDeals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer category breakdown */}
      {seg.byCategory?.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Top Customers by Visit Frequency</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={seg.topCustomers?.slice(0, 8) || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="companyName" type="category" tick={{ fontSize: 11 }} width={130} />
              <Tooltip />
              <Bar dataKey="_count.meetings" fill="#1E3A5F" name="Visits" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
