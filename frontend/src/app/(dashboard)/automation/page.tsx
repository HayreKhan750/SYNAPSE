'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import api from '@/utils/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkflowAction {
  type: 'collect_news' | 'summarize_content' | 'generate_pdf' | 'send_email' | 'upload_to_drive';
  params?: Record<string, unknown>;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger_type: 'schedule' | 'event' | 'manual';
  cron_expression: string;
  actions: WorkflowAction[];
  is_active: boolean;
  status: 'active' | 'paused' | 'failed';
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
  created_at: string;
  runs_count: number;
  last_run_status: string | null;
}

interface WorkflowRun {
  id: string;
  workflow: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  started_at: string;
  completed_at: string | null;
  result: Record<string, unknown>;
  error_message: string;
  duration_seconds: number | null;
}

interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

// ── API helpers ───────────────────────────────────────────────────────────────

// Helper: extract array from any API response shape:
//   { success, data: [...], meta }  — custom wrapper
//   { count, results: [...] }       — standard DRF pagination
//   [...]                           — plain array
function extractList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj['data'])) return obj['data'] as T[];
    if (Array.isArray(obj['results'])) return obj['results'] as T[];
  }
  return [];
}

const fetchWorkflows = async (): Promise<Workflow[]> => {
  const { data } = await api.get('/automation/workflows/');
  return extractList<Workflow>(data);
};

const fetchRuns = async (workflowId: string): Promise<WorkflowRun[]> => {
  const { data } = await api.get(`/automation/workflows/${workflowId}/runs/`);
  return extractList<WorkflowRun>(data);
};

const createWorkflow = async (payload: Partial<Workflow>) => {
  const { data } = await api.post('/automation/workflows/', payload);
  return data;
};

const deleteWorkflow = async (id: string) => {
  await api.delete(`/automation/workflows/${id}/`);
};

const triggerWorkflow = async (id: string) => {
  const { data } = await api.post(`/automation/workflows/${id}/trigger/`);
  return data;
};

const toggleWorkflow = async (id: string) => {
  const { data } = await api.post(`/automation/workflows/${id}/toggle/`);
  return data;
};

// ── Sub-components ────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  collect_news: '📰 Collect News',
  summarize_content: '🤖 Summarize Content',
  generate_pdf: '📄 Generate PDF',
  send_email: '📧 Send Email',
  upload_to_drive: '☁️ Upload to Drive',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border border-green-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  failed: 'bg-red-500/20 text-red-400 border border-red-500/30',
  success: 'bg-green-500/20 text-green-400 border border-green-500/30',
  running: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  pending: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-slate-600 text-slate-300'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function WorkflowCard({
  workflow,
  onTrigger,
  onToggle,
  onDelete,
  onViewRuns,
}: {
  workflow: Workflow;
  onTrigger: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onViewRuns: (workflow: Workflow) => void;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col gap-3 hover:border-indigo-500/50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{workflow.name}</h3>
          {workflow.description && (
            <p className="text-sm text-slate-400 mt-0.5 line-clamp-1">{workflow.description}</p>
          )}
        </div>
        <StatusBadge status={workflow.status} />
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
        <span className="bg-slate-700 rounded px-2 py-0.5">
          ⏱ {workflow.trigger_type === 'schedule' ? workflow.cron_expression || 'cron' : workflow.trigger_type}
        </span>
        <span className="bg-slate-700 rounded px-2 py-0.5">
          🔄 {workflow.run_count} runs
        </span>
        {workflow.last_run_at && (
          <span className="bg-slate-700 rounded px-2 py-0.5">
            Last: {new Date(workflow.last_run_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5">
        {workflow.actions.map((a, i) => (
          <span key={i} className="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded px-2 py-0.5">
            {ACTION_LABELS[a.type] ?? a.type}
          </span>
        ))}
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onTrigger(workflow.id)}
          disabled={!workflow.is_active}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm py-1.5 rounded-lg transition-colors font-medium"
        >
          ▶ Run
        </button>
        <button
          onClick={() => onToggle(workflow.id)}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
          title={workflow.is_active ? 'Pause' : 'Resume'}
        >
          {workflow.is_active ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => onViewRuns(workflow)}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
          title="View run history"
        >
          📋
        </button>
        <button
          onClick={() => onDelete(workflow.id)}
          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg transition-colors"
          title="Delete workflow"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

function RunHistoryModal({
  workflow,
  onClose,
}: {
  workflow: Workflow;
  onClose: () => void;
}) {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['workflow-runs', workflow.id],
    queryFn: () => fetchRuns(workflow.id),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            Run History — <span className="text-indigo-400">{workflow.name}</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-xl">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {isLoading && (
            <div className="text-slate-400 text-sm animate-pulse">Loading runs…</div>
          )}
          {!isLoading && runs.length === 0 && (
            <div className="text-slate-400 text-sm text-center py-8">No runs yet.</div>
          )}
          {runs.map((run) => (
            <div key={run.id} className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <StatusBadge status={run.status} />
                <span className="text-xs text-slate-400">
                  {new Date(run.started_at).toLocaleString()}
                </span>
              </div>
              {run.duration_seconds != null && (
                <p className="text-xs text-slate-400">
                  Duration: {run.duration_seconds.toFixed(1)}s
                </p>
              )}
              {run.error_message && (
                <p className="text-xs text-red-400 mt-1 bg-red-500/10 rounded p-2">
                  {run.error_message}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Cron expression presets
const CRON_PRESETS = [
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 8am', value: '0 8 * * *' },
  { label: 'Every Monday 9am', value: '0 9 * * 1' },
  { label: 'Custom', value: '' },
];

const ACTION_TYPES = [
  'collect_news',
  'summarize_content',
  'generate_pdf',
  'send_email',
  'upload_to_drive',
] as const;

function CreateWorkflowModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger_type: 'schedule' as 'schedule' | 'event' | 'manual',
    cron_expression: '0 * * * *',
    actions: [{ type: 'collect_news' as WorkflowAction['type'] }],
  });
  const [cronPreset, setCronPreset] = useState('0 * * * *');

  const mutation = useMutation({
    mutationFn: createWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow created!');
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? 'Failed to create workflow.';
      toast.error(msg);
    },
  });

  const addAction = () => {
    setForm((f) => ({ ...f, actions: [...f.actions, { type: 'collect_news' }] }));
  };

  const removeAction = (i: number) => {
    setForm((f) => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));
  };

  const updateActionType = (i: number, type: WorkflowAction['type']) => {
    setForm((f) => {
      const actions = [...f.actions];
      actions[i] = { ...actions[i], type };
      return { ...f, actions };
    });
  };

  const handleCronPreset = (value: string) => {
    setCronPreset(value);
    if (value) setForm((f) => ({ ...f, cron_expression: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Create Workflow</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Workflow Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Daily Tech Digest"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What does this workflow do?"
              rows={2}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Trigger Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Trigger Type</label>
            <select
              value={form.trigger_type}
              onChange={(e) => setForm((f) => ({ ...f, trigger_type: e.target.value as typeof f.trigger_type }))}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="schedule">⏱ Schedule (Cron)</option>
              <option value="manual">🖐 Manual</option>
              <option value="event">⚡ Event</option>
            </select>
          </div>

          {/* Cron expression (only for schedule) */}
          {form.trigger_type === 'schedule' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Schedule</label>
              <select
                value={cronPreset}
                onChange={(e) => handleCronPreset(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 mb-2"
              >
                {CRON_PRESETS.map((p) => (
                  <option key={p.label} value={p.value}>{p.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={form.cron_expression}
                onChange={(e) => setForm((f) => ({ ...f, cron_expression: e.target.value }))}
                placeholder="*/30 * * * *"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-xs text-slate-500 mt-1">Format: minute hour day month weekday</p>
            </div>
          )}

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Actions *</label>
              <button
                type="button"
                onClick={addAction}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                + Add Action
              </button>
            </div>
            <div className="space-y-2">
              {form.actions.map((action, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={action.type}
                    onChange={(e) => updateActionType(i, e.target.value as WorkflowAction['type'])}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    {ACTION_TYPES.map((t) => (
                      <option key={t} value={t}>{ACTION_LABELS[t]}</option>
                    ))}
                  </select>
                  {form.actions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAction(i)}
                      className="text-red-400 hover:text-red-300 transition-colors px-2"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium"
            >
              {mutation.isPending ? 'Creating…' : 'Create Workflow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: fetchWorkflows,
  });

  const triggerMutation = useMutation({
    mutationFn: triggerWorkflow,
    onSuccess: (_, id) => {
      toast.success('Workflow triggered!');
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-runs', id] });
    },
    onError: () => toast.error('Failed to trigger workflow.'),
  });

  const toggleMutation = useMutation({
    mutationFn: toggleWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
    onError: () => toast.error('Failed to toggle workflow.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => {
      toast.success('Workflow deleted.');
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
    onError: () => toast.error('Failed to delete workflow.'),
  });

  const handleDelete = (id: string) => {
    if (confirm('Delete this workflow? This cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  const activeCount = workflows.filter((w) => w.is_active).length;
  const totalRuns = workflows.reduce((sum, w) => sum + w.run_count, 0);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
    <div className="p-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">⚙️ Automation Center</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Schedule and automate your tech intelligence workflows.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
        >
          + New Workflow
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Workflows', value: workflows.length, icon: '⚙️' },
          { label: 'Active', value: activeCount, icon: '✅' },
          { label: 'Total Runs', value: totalRuns, icon: '🔄' },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
            <span className="text-2xl">{stat.icon}</span>
            <div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-slate-400 text-xs">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Workflow Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-5 animate-pulse h-48" />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4">⚙️</div>
          <h3 className="text-white font-semibold text-lg mb-2">No workflows yet</h3>
          <p className="text-slate-400 text-sm mb-6 max-w-sm">
            Create your first workflow to automate content collection, summarization, and more.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            + Create Workflow
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onTrigger={(id) => triggerMutation.mutate(id)}
              onToggle={(id) => toggleMutation.mutate(id)}
              onDelete={handleDelete}
              onViewRuns={setSelectedWorkflow}
            />
          ))}
        </div>
      )}

      {/* Action Types Legend */}
      <div className="mt-10 bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Available Action Types</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {Object.entries(ACTION_LABELS).map(([type, label]) => (
            <div key={type} className="bg-slate-900 rounded-lg p-2.5 text-center">
              <p className="text-sm text-slate-300">{label}</p>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">{type}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {showCreate && <CreateWorkflowModal onClose={() => setShowCreate(false)} />}
      {selectedWorkflow && (
        <RunHistoryModal workflow={selectedWorkflow} onClose={() => setSelectedWorkflow(null)} />
      )}
    </div>
    </div>
  );
}
