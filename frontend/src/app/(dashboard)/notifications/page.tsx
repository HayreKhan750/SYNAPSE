'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import api from '@/utils/api';

interface Notification {
  id: string;
  title: string;
  message: string;
  notif_type: string;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

function extractList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj['data'])) return obj['data'] as T[];
    if (Array.isArray(obj['results'])) return obj['results'] as T[];
  }
  return [];
}

const NOTIF_STYLES: Record<string, { icon: string; colour: string; bg: string }> = {
  workflow_complete: { icon: '⚙️', colour: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  info:             { icon: 'ℹ️', colour: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  warning:          { icon: '⚠️', colour: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  error:            { icon: '❌', colour: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  success:          { icon: '✅', colour: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['all-notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/');
      return extractList<Notification>(data);
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => { await api.post('/notifications/read-all/'); },
    onSuccess: () => {
      toast.success('All notifications marked as read.');
      queryClient.invalidateQueries({ queryKey: ['all-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: async (id: string) => { await api.post(`/notifications/${id}/read/`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/notifications/${id}/`); },
    onSuccess: () => {
      toast.success('Notification deleted.');
      queryClient.invalidateQueries({ queryKey: ['all-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-6 max-w-3xl mx-auto pb-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">🔔 Notifications</h1>
            <p className="text-slate-400 text-sm mt-1">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-xl transition-colors font-medium"
            >
              ✓ Mark all read
            </button>
          )}
        </div>

        {/* Skeleton */}
        {isLoading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4 animate-pulse h-20" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-5xl mb-4">🔔</div>
            <h3 className="text-white font-semibold text-lg mb-2">No notifications yet</h3>
            <p className="text-slate-400 text-sm max-w-sm">
              Notifications appear here when your workflows complete, or when there are important updates.
            </p>
          </div>
        )}

        {/* Notification list */}
        {!isLoading && notifications.length > 0 && (
          <div className="space-y-3">
            {notifications.map((n) => {
              const style = NOTIF_STYLES[n.notif_type] ?? NOTIF_STYLES['info'];
              return (
                <div
                  key={n.id}
                  className={`relative bg-slate-800 border rounded-xl p-4 transition-all ${
                    !n.is_read
                      ? 'border-indigo-500/30 shadow-sm shadow-indigo-500/10'
                      : 'border-slate-700 opacity-70'
                  }`}
                >
                  {/* Unread indicator */}
                  {!n.is_read && (
                    <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-indigo-500" />
                  )}

                  <div className="flex items-start gap-3 pr-6">
                    {/* Type badge */}
                    <div className={`flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center text-base ${style.bg}`}>
                      {style.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <p className={`text-sm font-semibold ${n.is_read ? 'text-slate-300' : 'text-white'}`}>
                          {n.title}
                        </p>
                        <span className="text-xs text-slate-500 flex-shrink-0">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-400 mt-1 leading-relaxed">{n.message}</p>

                      {/* Metadata chips */}
                      {n.metadata && Object.keys(n.metadata).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {Object.entries(n.metadata).map(([k, v]) => (
                            <span key={k} className="text-xs bg-slate-700 text-slate-400 rounded px-2 py-0.5">
                              {k}: {String(v).slice(0, 30)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
                    {!n.is_read && (
                      <button
                        onClick={() => markOneMutation.mutate(n.id)}
                        disabled={markOneMutation.isPending}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        ✓ Mark as read
                      </button>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(n.id)}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 flex items-center gap-1 ml-auto"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
