'use client';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { Users, Shield, UserCheck } from 'lucide-react';

export default function UsersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list({ limit: 50 }).then(r => r.data.data),
  });

  const users = (data as any)?.items || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Team members
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{users.length} active members</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u: any) => (
            <div key={u.id} className="card p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
                <span className="text-base font-bold text-primary dark:text-primary-300">{u.name?.charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{u.name}</p>
                <p className="text-xs text-slate-500 truncate">{u.email}</p>
                {u.department && <p className="text-xs text-slate-400 truncate">{u.department}</p>}
              </div>
              <div className="shrink-0">
                {u.role === 'ADMIN' ? (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary rounded-full font-medium">
                    <Shield className="w-3 h-3" /> Admin
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">
                    <UserCheck className="w-3 h-3" /> Sales
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
