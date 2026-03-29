'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import api from '@/utils/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type ActionType = 'collect_news' | 'summarize_content' | 'generate_pdf' | 'send_email' | 'upload_to_drive' | 'ai_digest';
type TriggerType = 'schedule' | 'event' | 'manual';
type EventType = 'new_article' | 'trending_spike' | 'new_paper' | 'new_repo';

interface ActionParamField {
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect';
  label: string;
  default: string | number | string[];
  options?: string[];
  min?: number;
  max?: number;
}
interface ActionSchema { [key: string]: ActionParamField; }
interface ActionSchemas { [actionType: string]: ActionSchema; }

interface WorkflowAction {
  type: ActionType;
  params?: Record<string, unknown>;
}

interface EventConfig {
  event_type?: EventType;
  filter?: { topic?: string };
  cooldown_minutes?: number;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger_type: TriggerType;
  cron_expression: string;
  event_config: EventConfig;
  actions: WorkflowAction[];
  is_active: boolean;
  status: string;
  run_count: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  collect_news: '📰 Collect News',
  summarize_content: '🤖 Summarize Content',
  generate_pdf: '📄 Generate PDF',
  send_email: '📧 Send Email',
  upload_to_drive: '☁️ Upload to Drive',
  ai_digest: '🧠 AI Digest',
};

const ACTION_TYPES = Object.keys(ACTION_LABELS) as ActionType[];

const CRON_PRESETS = [
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 8am', value: '0 8 * * *' },
  { label: 'Every Monday 9am', value: '0 9 * * 1' },
  { label: 'Custom', value: '' },
];

const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: 'new_article', label: '📰 New Article Published' },
  { value: 'trending_spike', label: '📈 Trending Topic Spike' },
  { value: 'new_paper', label: '🔬 New Research Paper' },
  { value: 'new_repo', label: '💻 New Repository Trending' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function inputClass(extra = '') {
  return `w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 ${extra}`;
}

// ── ActionParamEditor ─────────────────────────────────────────────────────────

function ActionParamEditor({
  action, schema, onChange,
}: {
  action: WorkflowAction;
  schema: ActionSchema | undefined;
  onChange: (p: Record<string, unknown>) => void;
}) {
  if (!schema) return null;
  const params = action.params || {};

  // For collect_news: only show youtube_queries when youtube is a selected source
  const sources: string[] = Array.isArray(params.sources)
    ? params.sources as string[]
    : Array.isArray(schema.sources?.default)
    ? schema.sources.default as string[]
    : [];
  const youtubeSelected = sources.includes('youtube');

  return (
    <div className="mt-2 ml-2 pl-3 border-l-2 border-indigo-500/30 space-y-2">
      {Object.entries(schema).map(([key, field]) => {
        // Hide youtube_queries unless youtube is selected
        if (key === 'youtube_queries' && !youtubeSelected) return null;
        const val = params[key] ?? field.default;

        if (field.type === 'multiselect' && field.options) {
          const selected = (Array.isArray(val) ? val : field.default) as string[];
          return (
            <div key={key}>
              <label className="block text-xs text-slate-400 mb-1">{field.label}</label>
              <div className="flex flex-wrap gap-1.5">
                {field.options.map(opt => (
                  <button key={opt} type="button"
                    onClick={() => {
                      const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
                      onChange({ ...params, [key]: next });
                    }}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${selected.includes(opt) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        }

        if (field.type === 'select' && field.options) {
          return (
            <div key={key}>
              <label className="block text-xs text-slate-400 mb-1">{field.label}</label>
              <select value={val as string} onChange={e => onChange({ ...params, [key]: e.target.value })} className={inputClass()}>
                {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          );
        }

        if (field.type === 'number') {
          return (
            <div key={key}>
              <label className="block text-xs text-slate-400 mb-1">{field.label}{field.min !== undefined && ` (${field.min}–${field.max})`}</label>
              <input type="number" value={val as number} min={field.min} max={field.max}
                onChange={e => onChange({ ...params, [key]: Number(e.target.value) })} className={inputClass()} />
            </div>
          );
        }

        if (field.type === 'textarea') {
          return (
            <div key={key}>
              <label className="block text-xs text-slate-400 mb-1">{field.label}</label>
              <textarea value={val as string} rows={3} onChange={e => onChange({ ...params, [key]: e.target.value })} className={inputClass('resize-none')} />
            </div>
          );
        }

        return (
          <div key={key}>
            <label className="block text-xs text-slate-400 mb-1">{field.label}</label>
            <input type="text" value={val as string} onChange={e => onChange({ ...params, [key]: e.target.value })} className={inputClass()} />
          </div>
        );
      })}
    </div>
  );
}

// ── EditWorkflowModal ─────────────────────────────────────────────────────────

export function EditWorkflowModal({ workflow, onClose }: { workflow: Workflow; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data: schemas = {} } = useQuery<ActionSchemas>({
    queryKey: ['action-schemas'],
    queryFn: async () => { const { data } = await api.get('/automation/action-schemas/'); return data; },
    staleTime: Infinity,
  });

  const [form, setForm] = useState({
    name: workflow.name,
    description: workflow.description,
    trigger_type: workflow.trigger_type,
    cron_expression: workflow.cron_expression || '0 * * * *',
    event_config: {
      event_type: (workflow.event_config?.event_type || 'new_article') as EventType,
      filter: { topic: workflow.event_config?.filter?.topic || '' },
      cooldown_minutes: workflow.event_config?.cooldown_minutes ?? 60,
    },
    actions: (workflow.actions || []).map(a => ({ ...a, params: a.params || {} })) as WorkflowAction[],
  });

  const [expandedActions, setExpandedActions] = useState<Set<number>>(new Set());

  const mutation = useMutation({
    mutationFn: async (payload: unknown) => {
      const { data } = await api.patch(`/automation/workflows/${workflow.id}/`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow updated!');
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to update workflow.';
      toast.error(msg);
    },
  });

  const addAction = () => setForm(f => ({ ...f, actions: [...f.actions, { type: 'collect_news' as ActionType, params: {} }] }));

  const removeAction = (i: number) => {
    setForm(f => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));
    setExpandedActions(prev => { const n = new Set(prev); n.delete(i); return n; });
  };

  const updateActionType = (i: number, type: ActionType) => {
    setForm(f => { const a = [...f.actions]; a[i] = { type, params: {} }; return { ...f, actions: a }; });
  };

  const updateActionParams = (i: number, params: Record<string, unknown>) => {
    setForm(f => { const a = [...f.actions]; a[i] = { ...a[i], params }; return { ...f, actions: a }; });
  };

  const toggleExpanded = (i: number) => {
    setExpandedActions(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      cron_expression: form.trigger_type === 'schedule' ? form.cron_expression : '',
      event_config: form.trigger_type === 'event' ? form.event_config : {},
    };
    mutation.mutate(payload);
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Edit Workflow</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{workflow.id.slice(0, 8)}…</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
            <input type="text" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputClass()} placeholder="Workflow name" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea value={form.description} rows={2}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className={inputClass('resize-none')} placeholder="What does this workflow do?" />
          </div>

          {/* Trigger Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Trigger Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['schedule', 'event', 'manual'] as TriggerType[]).map(t => (
                <button key={t} type="button"
                  onClick={() => setForm(f => ({ ...f, trigger_type: t }))}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors ${form.trigger_type === t ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                  {t === 'schedule' ? '⏱ Schedule' : t === 'event' ? '⚡ Event' : '🖐 Manual'}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule config */}
          {form.trigger_type === 'schedule' && (
            <div className="space-y-2 p-3 bg-slate-900/60 rounded-lg border border-slate-700">
              <label className="block text-sm font-medium text-slate-300">Cron Schedule</label>
              <select onChange={e => { if (e.target.value) setForm(f => ({ ...f, cron_expression: e.target.value })); }}
                defaultValue={form.cron_expression}
                className={inputClass()}>
                {CRON_PRESETS.map(p => <option key={p.label} value={p.value}>{p.label}</option>)}
              </select>
              <input type="text" value={form.cron_expression}
                onChange={e => setForm(f => ({ ...f, cron_expression: e.target.value }))}
                className={inputClass('font-mono')} placeholder="*/30 * * * *" />
              <p className="text-xs text-slate-500">Format: minute hour day month weekday</p>
            </div>
          )}

          {/* Event config */}
          {form.trigger_type === 'event' && (
            <div className="space-y-3 p-3 bg-slate-900/60 rounded-lg border border-slate-700">
              <label className="block text-sm font-medium text-slate-300">Event Configuration</label>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Event Type *</label>
                <select value={form.event_config.event_type}
                  onChange={e => setForm(f => ({ ...f, event_config: { ...f.event_config, event_type: e.target.value as EventType } }))}
                  className={inputClass()}>
                  {EVENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Topic Filter <span className="text-slate-500">(optional)</span></label>
                <input type="text" value={form.event_config.filter?.topic || ''}
                  onChange={e => setForm(f => ({ ...f, event_config: { ...f.event_config, filter: { topic: e.target.value } } }))}
                  placeholder="e.g. AI, React — blank matches all" className={inputClass()} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cooldown (minutes)</label>
                <input type="number" min={1} max={1440} value={form.event_config.cooldown_minutes ?? 60}
                  onChange={e => setForm(f => ({ ...f, event_config: { ...f.event_config, cooldown_minutes: Number(e.target.value) } }))}
                  className={inputClass()} />
              </div>
            </div>
          )}

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Actions *</label>
              <button type="button" onClick={addAction} className="text-xs text-indigo-400 hover:text-indigo-300">+ Add Action</button>
            </div>
            <div className="space-y-2">
              {form.actions.map((action, i) => (
                <div key={i} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <div className="flex gap-2 items-center">
                    <select value={action.type} onChange={e => updateActionType(i, e.target.value as ActionType)}
                      className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                      {ACTION_TYPES.map(t => <option key={t} value={t}>{ACTION_LABELS[t]}</option>)}
                    </select>
                    {schemas[action.type] && (
                      <button type="button" onClick={() => toggleExpanded(i)}
                        className={`px-2 py-2 rounded-lg text-xs border transition-colors ${expandedActions.has(i) ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}
                        title="Configure parameters">⚙️</button>
                    )}
                    {form.actions.length > 1 && (
                      <button type="button" onClick={() => removeAction(i)} className="text-red-400 hover:text-red-300 px-2">✕</button>
                    )}
                  </div>
                  {expandedActions.has(i) && (
                    <ActionParamEditor action={action} schema={schemas[action.type]}
                      onChange={params => updateActionParams(i, params)} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium">
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
