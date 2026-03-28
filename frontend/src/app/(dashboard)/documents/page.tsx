"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Presentation, FileCode2, File, FolderGit2, Globe,
  Plus, Download, Trash2, Loader2, Sparkles, X, Archive, Cloud,
  HardDrive, CheckCircle2, Link2, Eye, Lock, Wand2, Code2,
  Palette, Layers, Zap, ChevronRight, Copy, ExternalLink,
  LayoutTemplate, Play, RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/utils/api";
import { formatDistanceToNow } from "date-fns";
import { useAuthStore } from "@/store/authStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType = "pdf" | "ppt" | "word" | "markdown" | "html" | "project";
type ProjectType = "django" | "fastapi" | "nextjs" | "datascience" | "react_lib" | "html_template";
type ProjectFeature = "auth" | "testing" | "ci_cd";
type GenerateDocType = Exclude<DocType, "project">;

interface DocumentRecord {
  id: string;
  title: string;
  doc_type: DocType;
  file_size_bytes: number;
  file_path: string;
  download_url: string;
  agent_prompt: string;
  metadata: Record<string, unknown>;
  created_at: string;
  version?: number;
  parent?: string | null;
}

interface GeneratePayload {
  doc_type: GenerateDocType;
  title: string;
  prompt: string;
  subtitle?: string;
  author?: string;
}

interface ProjectPayload {
  project_type: ProjectType;
  name: string;
  features: ProjectFeature[];
  description: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPE_CONFIG: Record<DocType, { label: string; icon: React.ElementType; colour: string; bg: string }> = {
  pdf:      { label: "PDF Report",  icon: FileText,    colour: "text-red-500",     bg: "bg-red-50 dark:bg-red-900/20" },
  ppt:      { label: "PowerPoint",  icon: Presentation,colour: "text-amber-500",   bg: "bg-amber-50 dark:bg-amber-900/20" },
  word:     { label: "Word Doc",    icon: File,        colour: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-900/20" },
  markdown: { label: "Markdown",    icon: FileCode2,   colour: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  html:     { label: "HTML Page",   icon: Globe,       colour: "text-cyan-500",    bg: "bg-cyan-50 dark:bg-cyan-900/20" },
  project:  { label: "Project",     icon: FolderGit2,  colour: "text-violet-500",  bg: "bg-violet-50 dark:bg-violet-900/20" },
};

const PROMPT_EXAMPLES: Record<GenerateDocType, string> = {
  pdf:      "Write a comprehensive report on the latest advancements in Large Language Models including key players, benchmark results, and future directions.",
  ppt:      "Create a 5-slide presentation on RAG (Retrieval-Augmented Generation) explaining what it is, how it works, use cases, limitations, and future outlook.",
  word:     "Generate a technical design document for a microservices architecture for an e-commerce platform with sections on services, data flow, API contracts, and deployment.",
  markdown: "Write a developer README for a Python CLI tool that scrapes Hacker News and summarizes top stories using OpenAI.",
  html:     "Create an interactive research report on the state of AI in 2026, covering key breakthroughs, market leaders, societal impact, and future predictions.",
};

// HTML Template categories for the builder
const HTML_TEMPLATE_CATEGORIES = [
  { id: "landing",     label: "Landing Page",      icon: "🚀", desc: "Hero, features, CTA, footer",              gradient: "from-violet-500 to-purple-600" },
  { id: "portfolio",   label: "Portfolio",          icon: "🎨", desc: "Showcase your work beautifully",            gradient: "from-pink-500 to-rose-600" },
  { id: "saas",        label: "SaaS Dashboard",     icon: "📊", desc: "Metrics, charts, sidebar nav",             gradient: "from-blue-500 to-cyan-600" },
  { id: "blog",        label: "Blog / Article",     icon: "📝", desc: "Clean reading experience",                 gradient: "from-emerald-500 to-teal-600" },
  { id: "ecommerce",   label: "E-Commerce",         icon: "🛍️", desc: "Product grid, cart, checkout",             gradient: "from-orange-500 to-amber-600" },
  { id: "resume",      label: "Resume / CV",        icon: "📋", desc: "Professional one-pager",                   gradient: "from-slate-500 to-gray-600" },
  { id: "agency",      label: "Agency / Studio",    icon: "✨", desc: "Bold, creative agency site",               gradient: "from-indigo-500 to-violet-600" },
  { id: "docs",        label: "Documentation",      icon: "📚", desc: "Sidebar nav + MDX-style content",          gradient: "from-teal-500 to-emerald-600" },
  { id: "restaurant",  label: "Restaurant / Food",  icon: "🍽️", desc: "Menu, gallery, reservations",             gradient: "from-red-500 to-orange-600" },
  { id: "realestate",  label: "Real Estate",        icon: "🏠", desc: "Property listings, map, contact",          gradient: "from-green-500 to-emerald-600" },
  { id: "music",       label: "Music / Artist",     icon: "🎵", desc: "Artist page, tracks, tour dates",          gradient: "from-purple-500 to-pink-600" },
  { id: "app",         label: "App Landing",        icon: "📱", desc: "App showcase, features, download CTA",     gradient: "from-cyan-500 to-blue-600" },
  { id: "crypto",      label: "Crypto / Web3",      icon: "🪙", desc: "Token info, roadmap, wallet connect",      gradient: "from-yellow-500 to-amber-600" },
  { id: "medical",     label: "Medical / Clinic",   icon: "🏥", desc: "Services, doctors, appointments",          gradient: "from-sky-500 to-cyan-600" },
  { id: "wedding",     label: "Wedding / Events",   icon: "💍", desc: "Story, gallery, RSVP, countdown",          gradient: "from-rose-400 to-pink-600" },
  { id: "startup",     label: "Startup / Pitch",    icon: "💡", desc: "Problem, solution, team, investors",       gradient: "from-amber-500 to-orange-600" },
  { id: "custom",      label: "Custom Prompt",      icon: "🤖", desc: "Describe anything you want",               gradient: "from-fuchsia-500 to-pink-600" },
];

// Available AI models for HTML generation
const HTML_AI_MODELS = [
  { id: "openai/gpt-4o-mini",          label: "GPT-4o Mini",         desc: "Fast & affordable",        badge: "⚡ Fast" },
  { id: "openai/gpt-4o",               label: "GPT-4o",              desc: "Best quality",             badge: "🏆 Best" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet",   desc: "Great for UI/CSS",        badge: "🎨 UI" },
  { id: "anthropic/claude-3-haiku",    label: "Claude 3 Haiku",      desc: "Fast Claude",              badge: "⚡ Fast" },
  { id: "google/gemini-flash-1.5",     label: "Gemini Flash 1.5",    desc: "Google's fastest",         badge: "🔥 Fast" },
  { id: "meta-llama/llama-3.1-8b-instruct", label: "Llama 3.1 8B",  desc: "Open source, free",       badge: "🆓 Free" },
];

const HTML_STYLE_PRESETS = [
  { id: "glassmorphism", label: "Glassmorphism", preview: "bg-gradient-to-br from-violet-900 to-indigo-900" },
  { id: "minimal",       label: "Minimal Clean", preview: "bg-white border border-gray-200" },
  { id: "dark_luxury",   label: "Dark Luxury",   preview: "bg-gradient-to-br from-gray-950 to-slate-900" },
  { id: "neon_cyber",    label: "Neon Cyber",    preview: "bg-gradient-to-br from-black to-gray-900" },
  { id: "soft_pastel",   label: "Soft Pastel",   preview: "bg-gradient-to-br from-pink-50 to-purple-50" },
  { id: "bold_color",    label: "Bold & Vivid",  preview: "bg-gradient-to-br from-orange-400 to-pink-500" },
];

// ─── API Helpers ──────────────────────────────────────────────────────────────

const fetchDocuments = async (): Promise<{ results: DocumentRecord[]; count: number }> => {
  const { data } = await api.get("/documents/");
  if (Array.isArray(data?.data)) return { results: data.data, count: data.meta?.total ?? data.data.length };
  if (Array.isArray(data?.results)) return { results: data.results, count: data.count ?? data.results.length };
  if (Array.isArray(data)) return { results: data, count: data.length };
  return { results: [], count: 0 };
};

const deleteDocument = async (id: string): Promise<void> => { await api.delete(`/documents/${id}/`); };

const fetchDriveStatus = async (): Promise<{ is_connected: boolean; google_email: string | null }> => {
  try { const { data } = await api.get("/integrations/drive/status/"); return data; }
  catch { return { is_connected: false, google_email: null }; }
};

const uploadToDrive = async ({ documentId, folderName }: { documentId: string; folderName: string }): Promise<{ drive_url: string }> => {
  const { data } = await api.post("/integrations/drive/upload/", { document_id: documentId, folder_name: folderName });
  return data;
};

const uploadToS3 = async ({ documentId }: { documentId: string }): Promise<{ presigned_url: string }> => {
  const { data } = await api.post("/integrations/s3/upload/", { document_id: documentId });
  return data;
};

const disconnectDrive = async (): Promise<void> => { await api.delete("/integrations/drive/disconnect/"); };

// ─── Utilities ────────────────────────────────────────────────────────────────

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024; const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

async function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
}

// ─── Section Editor Modal ─────────────────────────────────────────────────────

function SectionEditorModal({ doc, onClose, onSaved }: { doc: DocumentRecord; onClose: () => void; onSaved: (d: DocumentRecord) => void }) {
  const [sections, setSections] = useState<Array<{ heading: string; content: string }>>(
    (doc.metadata?.sections as Array<{ heading: string; content: string }>) || []
  );
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editHeading, setEditHeading] = useState("");
  const [regenInstruction, setRegenInstruction] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const [persistLoading, setPersistLoading] = useState(false);
  const [regenAllLoading, setRegenAllLoading] = useState(false);
  const [regenAllInstruction, setRegenAllInstruction] = useState("");

  const handleEdit = (idx: number) => { setEditingIdx(idx); setEditHeading(sections[idx].heading); setEditContent(sections[idx].content); setRegenInstruction(""); };
  const handleSaveEdit = () => {
    if (editingIdx === null) return;
    const updated = [...sections]; updated[editingIdx] = { heading: editHeading, content: editContent };
    setSections(updated); setEditingIdx(null);
  };
  const handleRegenSection = async () => {
    if (editingIdx === null) return; setRegenLoading(true);
    try {
      const { data } = await api.post(`/documents/${doc.id}/regenerate-section/`, { heading: editHeading, instruction: regenInstruction || `Write a comprehensive section about: ${editHeading}` });
      setEditContent(data.content); toast.success("Section regenerated!");
    } catch { toast.error("Regeneration failed."); } finally { setRegenLoading(false); }
  };
  const handlePersistSections = async () => {
    setPersistLoading(true);
    try { const { data } = await api.post(`/documents/${doc.id}/update-sections/`, { sections }); toast.success("Document rebuilt!"); onSaved(data); onClose(); }
    catch { toast.error("Failed to save sections."); } finally { setPersistLoading(false); }
  };
  const handleRegenAll = async () => {
    setRegenAllLoading(true);
    try {
      const { data } = await api.post(`/documents/${doc.id}/regenerate-all/`, { instruction: regenAllInstruction });
      toast.success(`Regenerated! ${data.metadata?.section_count ?? 0} sections rebuilt.`);
      setSections(data.metadata?.sections ?? []); onSaved(data);
    } catch { toast.error("Regeneration failed."); } finally { setRegenAllLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-600 to-violet-600">
          <div><h2 className="text-lg font-bold text-white">Section Editor</h2><p className="text-xs text-indigo-200">{doc.title} — {sections.length} sections</p></div>
          <button onClick={onClose} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex-wrap">
          <input value={regenAllInstruction} onChange={e => setRegenAllInstruction(e.target.value)} placeholder="Optional instruction for full regeneration…"
            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-0" />
          <button onClick={handleRegenAll} disabled={regenAllLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition disabled:opacity-60 whitespace-nowrap">
            {regenAllLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Regenerate All
          </button>
          <button onClick={handlePersistSections} disabled={persistLoading || sections.length === 0} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-60 whitespace-nowrap">
            {persistLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Save &amp; Rebuild
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            {sections.length === 0 ? <div className="p-4 text-xs text-gray-400 text-center mt-4">No sections found.</div>
              : sections.map((sec, idx) => (
                <button key={idx} onClick={() => handleEdit(idx)} className={`w-full text-left px-4 py-3 text-xs border-b border-gray-200 dark:border-gray-700 transition ${editingIdx === idx ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}`}>
                  <span className="block font-bold text-indigo-400 mb-0.5">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="line-clamp-2">{sec.heading}</span>
                </button>
              ))}
          </div>
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            {editingIdx === null ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400"><FileText className="w-12 h-12 mb-3 opacity-30" /><p className="text-sm">Select a section to edit</p></div>
            ) : (
              <>
                <div><label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Section Heading</label>
                  <input value={editHeading} onChange={e => setEditHeading(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div className="flex-1"><label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Content</label>
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={12} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono leading-relaxed" /></div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800">
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Regenerate</p>
                  <div className="flex gap-2">
                    <input value={regenInstruction} onChange={e => setRegenInstruction(e.target.value)} placeholder="Optional instruction…" className="flex-1 px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button onClick={handleRegenSection} disabled={regenLoading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition disabled:opacity-60">
                      {regenLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Regenerate
                    </button>
                  </div>
                </div>
                <button onClick={handleSaveEdit} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition">Save Changes</button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Document Card ────────────────────────────────────────────────────────────

function DocumentCard({ doc, onDelete, driveConnected }: { doc: DocumentRecord; onDelete: (id: string) => void; driveConnected: boolean }) {
  const cfg = DOC_TYPE_CONFIG[doc.doc_type] ?? DOC_TYPE_CONFIG.pdf;
  const Icon = cfg.icon;
  const [driveUploading, setDriveUploading] = useState(false);
  const [s3Uploading, setS3Uploading] = useState(false);
  const [driveUrl, setDriveUrl] = useState<string | null>(doc.metadata?.drive_file_id ? String(doc.metadata.drive_file_id) : null);
  const [showPreview, setShowPreview] = useState(false);
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [docsExporting, setDocsExporting] = useState(false);
  const [googleDocUrl, setGoogleDocUrl] = useState<string | null>(doc.metadata?.google_doc_url ? String(doc.metadata.google_doc_url) : null);
  const [showSectionEditor, setShowSectionEditor] = useState(false);
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<DocumentRecord[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const handlePreview = async () => {
    if (showPreview) { setShowPreview(false); return; }
    setPreviewLoading(true);
    try {
      // Fetch the rendered HTML directly with the Authorization header
      // so we never need to point an iframe at the backend URL (avoids all
      // CSP frame-ancestors / X-Frame-Options / localhost refused issues).
      const token = useAuthStore.getState().accessToken;
      const rawBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const apiBase = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
      // Normalise: api.ts already adds /api/v1, so strip it if present
      const origin = apiBase.replace(/\/api\/v1\/?$/, "");

      const res = await fetch(
        `${origin}/api/v1/documents/${doc.id}/render/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const html = await res.text();

      // Create a blob URL so the iframe renders the HTML locally —
      // completely bypasses any server-side frame restriction.
      const blob = new Blob([html], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);
      // Revoke any previous blob URL to avoid memory leaks
      if (renderUrl) URL.revokeObjectURL(renderUrl);
      setRenderUrl(blobUrl);
      setShowPreview(true);
    } catch (e: any) {
      toast.error("Could not load preview. Check your connection.");
    } finally { setPreviewLoading(false); }
  };

  const handleShowVersions = async () => {
    if (showVersions) { setShowVersions(false); return; }
    setVersionsLoading(true);
    try { const { data } = await api.get(`/documents/${doc.id}/versions/`); setVersions(data); setShowVersions(true); }
    catch { toast.error("Could not load versions."); } finally { setVersionsLoading(false); }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setShowPreview(false); setShowRegenModal(false); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  const handleDriveUpload = async () => {
    setDriveUploading(true);
    try { const r = await uploadToDrive({ documentId: doc.id, folderName: "SYNAPSE Documents" }); setDriveUrl(r.drive_url); toast.success("Uploaded to Google Drive!"); }
    catch { toast.error("Drive upload failed."); } finally { setDriveUploading(false); }
  };

  const handleS3Upload = async () => {
    setS3Uploading(true);
    try { const r = await uploadToS3({ documentId: doc.id }); toast.success("Uploaded to S3!"); if (r.presigned_url) window.open(r.presigned_url, "_blank"); }
    catch { toast.error("S3 upload failed."); } finally { setS3Uploading(false); }
  };

  const handleDownload = async () => {
    try {
      const urlPath = doc.download_url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/v1/, "");
      const response = await api.get(urlPath, { responseType: "blob" });
      const ext: Record<string, string> = { pdf: ".pdf", ppt: ".pptx", word: ".docx", markdown: ".md", html: ".html", project: ".zip" };
      const filename = `${doc.title.slice(0, 50).replace(/\//g, "_")}${ext[doc.doc_type] ?? ""}`;
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a"); a.href = blobUrl; a.setAttribute("download", filename); document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(blobUrl);
    } catch { toast.error("Download failed."); }
  };

  // Is this an HTML template from the project builder?
  const isHtmlTemplate = doc.doc_type === "project" && String(doc.metadata?.project_type ?? "").startsWith("html");

  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="group relative bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 p-5 flex flex-col gap-3 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300">

      {/* Glow on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/0 to-violet-500/0 group-hover:from-indigo-500/3 group-hover:to-violet-500/3 transition-all duration-300 pointer-events-none" />

      <div className="flex items-start justify-between gap-2">
        <div className={`p-2.5 rounded-xl ${cfg.bg} shadow-sm`}>
          {isHtmlTemplate ? <LayoutTemplate className="w-5 h-5 text-violet-500" /> : <Icon className={`w-5 h-5 ${cfg.colour}`} />}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {driveUrl && <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded-full bg-green-50 dark:bg-green-900/20" title="View on Drive"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /></a>}
          {googleDocUrl && <a href={googleDocUrl} target="_blank" rel="noopener noreferrer" className="p-1 rounded-full bg-green-50 dark:bg-green-900/20" title="View Google Doc"><FileText className="w-3.5 h-3.5 text-green-600" /></a>}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.colour}`}>
            {isHtmlTemplate ? "HTML Template" : cfg.label}
          </span>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight line-clamp-2">{doc.title}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{doc.agent_prompt}</p>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mt-auto">
        <span>{formatBytes(doc.file_size_bytes)}</span>
        <span>{formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}</span>
      </div>

      {/* Primary actions */}
      <div className="flex gap-2">
        <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition">
          <Download className="w-3.5 h-3.5" /> {doc.doc_type === "project" ? "Download .zip" : "Download"}
        </button>
        <button onClick={handlePreview} disabled={previewLoading} title={showPreview ? "Hide preview" : "Preview"}
          className={`p-1.5 rounded-lg transition ${showPreview ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30" : "text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"}`}>
          {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
        </button>
        <button onClick={() => setShowSectionEditor(true)} className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition" title="Edit sections"><Archive className="w-4 h-4" /></button>
        <button onClick={() => setShowRegenModal(true)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition" title="Regenerate"><Sparkles className="w-4 h-4" /></button>
        <button onClick={handleShowVersions} disabled={versionsLoading} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition ${showVersions ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700" : "bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-violet-50 hover:text-violet-600"}`} title="Version history">
          {versionsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null} v{doc.version ?? 1}
        </button>
        <button onClick={() => onDelete(doc.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition" title="Delete"><Trash2 className="w-4 h-4" /></button>
      </div>

      {/* Cloud actions */}
      <div className="flex gap-2 pt-0.5 border-t border-gray-100 dark:border-gray-700/50">
        <button onClick={handleDriveUpload} disabled={!driveConnected || driveUploading} title={driveConnected ? "Upload to Google Drive" : "Connect Drive first"}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition ${driveConnected ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100" : "bg-gray-50 dark:bg-gray-700/50 text-gray-400 cursor-not-allowed"}`}>
          {driveUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />} Drive
        </button>
        <button onClick={handleS3Upload} disabled={s3Uploading} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-xs font-medium hover:bg-orange-100 transition disabled:opacity-60">
          {s3Uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />} S3
        </button>
      </div>

      {/* Version history */}
      <AnimatePresence>
        {showVersions && versions.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Version History ({versions.length})</p>
              <div className="space-y-1.5">
                {versions.map(v => (
                  <div key={v.id} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${v.id === doc.id ? "bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700" : "bg-gray-50 dark:bg-gray-800"}`}>
                    <span className={`font-bold px-1.5 py-0.5 rounded text-xs ${v.id === doc.id ? "bg-indigo-600 text-white" : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"}`}>v{v.version ?? 1}</span>
                    <span className="flex-1 text-gray-600 dark:text-gray-400 truncate">{String(v.metadata?.section_count ?? "?")} sections{v.id === doc.id && <span className="text-indigo-500 ml-1">(current)</span>}</span>
                    <span className="text-gray-400">{new Date(v.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview lightbox */}
      <AnimatePresence>
        {showPreview && renderUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setShowPreview(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 bg-gray-900/95 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.bg}`}><Icon className={`w-3.5 h-3.5 ${cfg.colour}`} /></div>
                  <div><p className="text-sm font-semibold text-white line-clamp-1">{doc.title}</p><p className="text-xs text-gray-400">{cfg.label} Preview</p></div>
                </div>
                <button onClick={() => setShowPreview(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"><X className="w-4 h-4" /></button>
              </div>
              <div className="bg-gray-950 relative" style={{ height: "75vh" }}>
                <iframe src={renderUrl} className="w-full h-full border-none" title={`Preview of ${doc.title}`} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
              </div>
              <div className="flex items-center justify-between px-5 py-3 bg-gray-900/95 border-t border-white/10">
                <p className="text-xs text-gray-500">🖱 Scroll to read the full document</p>
                <div className="flex gap-2">
                  <button onClick={() => window.open(renderUrl, "_blank", "noopener")} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition">Open Full ↗</button>
                  <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition"><Download className="w-3.5 h-3.5" /> Download</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Section editor */}
      <AnimatePresence>
        {showSectionEditor && <SectionEditorModal doc={doc} onClose={() => setShowSectionEditor(false)} onSaved={() => window.location.reload()} />}
      </AnimatePresence>

      {/* Regen modal */}
      <AnimatePresence>
        {showRegenModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6">
                <div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Sparkles className="w-5 h-5 text-white" /></div><h2 className="text-lg font-bold text-white">Regenerate Document</h2></div>
                <p className="text-amber-100 text-sm">AI will rewrite all sections from scratch using the original prompt.</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}><Icon className={`w-4 h-4 ${cfg.colour}`} /></div>
                  <div><p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{doc.title}</p><p className="text-xs text-gray-500">{doc.doc_type.toUpperCase()} · {String(doc.metadata?.section_count ?? "?")} sections</p></div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <span className="text-amber-500 text-base flex-shrink-0 mt-0.5">⚠️</span>
                  <p className="text-xs text-amber-800 dark:text-amber-300">The current document will be <strong>permanently replaced</strong>. This cannot be undone.</p>
                </div>
              </div>
              <div className="flex gap-3 px-6 pb-6">
                <button onClick={() => setShowRegenModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
                <button onClick={async () => {
                  setShowRegenModal(false);
                  try {
                    toast.loading("🤖 Regenerating…", { id: "regen" });
                    const { data } = await api.post(`/documents/${doc.id}/regenerate-all/`, {});
                    toast.success(`✓ Rebuilt! ${data.metadata?.section_count ?? ""} sections.`, { id: "regen" });
                    window.location.reload();
                  } catch { toast.error("Regeneration failed.", { id: "regen" }); }
                }} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-bold transition flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" /> Regenerate All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


// ─── ✨ HTML Template Builder ─────────────────────────────────────────────────

function HtmlTemplateBuilder({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState<string>("");
  const [stylePreset, setStylePreset] = useState<string>("glassmorphism");
  const [title, setTitle] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [colorScheme, setColorScheme] = useState("#6366f1");
  const [features, setFeatures] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("openai/gpt-4o-mini");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [generatedDoc, setGeneratedDoc] = useState<DocumentRecord | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const queryClient = useQueryClient();

  const FEATURE_OPTIONS = [
    { id: "responsive",    label: "Fully Responsive",    icon: "📱" },
    { id: "dark_mode",     label: "Dark Mode Toggle",    icon: "🌙" },
    { id: "animations",    label: "CSS Animations",      icon: "✨" },
    { id: "smooth_scroll", label: "Smooth Scroll",       icon: "🎯" },
    { id: "contact_form",  label: "Contact Form",        icon: "📬" },
    { id: "testimonials",  label: "Testimonials",        icon: "💬" },
    { id: "pricing",       label: "Pricing Section",     icon: "💰" },
    { id: "faq",           label: "FAQ Accordion",       icon: "❓" },
  ];

  const toggleFeature = (id: string) =>
    setFeatures(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selectedCat = HTML_TEMPLATE_CATEGORIES.find(c => c.id === category);

  const buildPrompt = () => {
    const cat = selectedCat;
    const styleLabel = HTML_STYLE_PRESETS.find(s => s.id === stylePreset)?.label ?? stylePreset;
    const featureList = features.map(f => FEATURE_OPTIONS.find(o => o.id === f)?.label ?? f).join(", ");
    const base = category === "custom"
      ? customPrompt
      : `Create a stunning, production-ready ${cat?.label ?? category} HTML template`;
    return `${base}. Style: ${styleLabel}. Primary color: ${colorScheme}. ${featureList ? `Include these features: ${featureList}.` : ""} Use modern HTML5, CSS3 (inline <style>), and vanilla JS. Make it visually impressive, pixel-perfect, and fully self-contained in a single HTML file. No external dependencies except Google Fonts and CDN libraries. Include beautiful gradients, micro-interactions, and premium typography.`;
  };

  const didCompleteRef = useRef(false);

  const handleGenerate = async () => {
    if (!title.trim()) { toast.error("Please enter a template title."); return; }
    if (!category) { toast.error("Please choose a template category."); return; }
    if (category === "custom" && !customPrompt.trim()) { toast.error("Please describe your template."); return; }

    // Reset completion guard so re-generates work correctly
    didCompleteRef.current = false;
    setGenerating(true);
    setProgress(5);
    setProgressMsg("Connecting to AI…");

    try {
      const token = useAuthStore.getState().accessToken;
      const rawBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const baseUrl = rawBase.replace(/\/api\/v1\/?$/, "");

      const response = await fetch(`${baseUrl}/api/v1/documents/generate-stream/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          doc_type: "html",
          title: title.trim(),
          prompt: buildPrompt(),
          subtitle: selectedCat?.label ?? "HTML Template",
          author: "SYNAPSE AI",
          model: selectedModel,
        }),
      });

      if (!response.ok || !response.body) {
        // Fallback to non-streaming endpoint
        setProgressMsg("Generating template with AI…");
        setProgress(40);
        const { data } = await api.post("/documents/generate/", {
          doc_type: "html",
          title: title.trim(),
          prompt: buildPrompt(),
          subtitle: selectedCat?.label ?? "HTML Template",
          author: "SYNAPSE AI",
          model: selectedModel,
        });
        setProgress(100);
        setProgressMsg("Template ready!");
        setGeneratedDoc(data?.document ?? data);
        if (!didCompleteRef.current) {
          didCompleteRef.current = true;
          queryClient.invalidateQueries({ queryKey: ["documents"] });
          onSuccess();
        }
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.progress !== undefined) setProgress(Math.min(evt.progress, 99));
            if (evt.message) setProgressMsg(evt.message);
            if (evt.step === "done" || evt.document) {
              setProgress(100);
              setProgressMsg("Template ready! ✨");
              const doc = evt.document ?? evt.data;
              if (doc) setGeneratedDoc(doc);
              if (!didCompleteRef.current) {
                didCompleteRef.current = true;
                queryClient.invalidateQueries({ queryKey: ["documents"] });
                onSuccess();
              }
            }
            if (evt.error) { toast.error(evt.error); }
          } catch {}
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Step indicators ──
  const steps = [
    { n: 1, label: "Template Type" },
    { n: 2, label: "Style & Features" },
    { n: 3, label: "Review & Generate" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Step progress bar ── */}
      <div className="flex items-center gap-0">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1">
            <button
              onClick={() => { if (s.n < step || (s.n === 2 && category)) setStep(s.n as 1|2|3); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-xs transition-all ${
                step === s.n
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25"
                  : step > s.n
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400"
              }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step === s.n ? "bg-white/20" : step > s.n ? "bg-emerald-500 text-white" : "bg-gray-300 dark:bg-gray-600 text-gray-500"}`}>
                {step > s.n ? "✓" : s.n}
              </span>
              {s.label}
            </button>
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-1 rounded ${step > s.n ? "bg-emerald-400" : "bg-gray-200 dark:bg-gray-700"}`} />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Category ── */}
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">What type of template do you need?</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">AI will generate a complete, self-contained HTML file ready to deploy.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {HTML_TEMPLATE_CATEGORIES.map(cat => (
                <motion.button key={cat.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setCategory(cat.id); setStep(2); }}
                  className={`relative flex flex-col gap-2 p-4 rounded-2xl border-2 text-left transition-all overflow-hidden ${
                    category === cat.id
                      ? "border-violet-500 shadow-lg shadow-violet-500/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700"
                  }`}>
                  {/* gradient bg */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradient} opacity-0 ${category === cat.id ? "opacity-5" : "group-hover:opacity-3"} transition-opacity`} />
                  <span className="text-2xl">{cat.icon}</span>
                  <div>
                    <p className="font-bold text-sm text-gray-900 dark:text-white">{cat.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{cat.desc}</p>
                  </div>
                  {category === cat.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute bottom-3 right-3" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: Style & Features ── */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Template Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder={`e.g. "TechVision AI Landing Page"`}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-gray-400" />
            </div>

            {/* Custom prompt (only for custom category) */}
            {category === "custom" && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Describe Your Template *</label>
                <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} rows={3}
                  placeholder="e.g. A dark cyberpunk-themed agency website with neon accents, particle background, animated hero section…"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none placeholder-gray-400" />
              </div>
            )}

            {/* Style preset */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Visual Style</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {HTML_STYLE_PRESETS.map(preset => (
                  <button key={preset.id} onClick={() => setStylePreset(preset.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                      stylePreset === preset.id ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20" : "border-gray-200 dark:border-gray-700 hover:border-violet-300"
                    }`}>
                    <div className={`w-8 h-8 rounded-lg flex-shrink-0 ${preset.preview} border border-white/10`} />
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{preset.label}</span>
                    {stylePreset === preset.id && <CheckCircle2 className="w-3.5 h-3.5 text-violet-600 ml-auto flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Color scheme */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Primary Brand Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={colorScheme} onChange={e => setColorScheme(e.target.value)}
                  className="w-12 h-10 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer bg-transparent" />
                <div className="flex gap-2 flex-wrap">
                  {["#6366f1","#8b5cf6","#ec4899","#06b6d4","#10b981","#f59e0b","#ef4444","#1e293b"].map(c => (
                    <button key={c} onClick={() => setColorScheme(c)} style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${colorScheme === c ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105"}`} />
                  ))}
                </div>
                <span className="text-xs text-gray-400 font-mono">{colorScheme}</span>
              </div>
            </div>

            {/* AI Model selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-500" /> AI Model
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {HTML_AI_MODELS.map(m => (
                  <button key={m.id} onClick={() => setSelectedModel(m.id)}
                    className={`flex flex-col gap-1 p-3 rounded-xl border-2 text-left transition-all ${
                      selectedModel === m.id
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700"
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{m.label}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{m.badge}</span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{m.desc}</span>
                    {selectedModel === m.id && <CheckCircle2 className="w-3 h-3 text-violet-600 mt-0.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature checkboxes */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Include Features</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FEATURE_OPTIONS.map(f => (
                  <button key={f.id} onClick={() => toggleFeature(f.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      features.includes(f.id) ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-violet-300"
                    }`}>
                    <span>{f.icon}</span> {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">← Back</button>
              <button onClick={() => { if (!title.trim()) { toast.error("Please enter a title."); return; } setStep(3); }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-bold transition shadow-lg shadow-violet-500/25">
                Continue → Review
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: Review & Generate ── */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">

            {/* Review card */}
            <div className="relative overflow-hidden rounded-2xl border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 p-5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-400/10 to-transparent rounded-full -translate-y-8 translate-x-8" />
              <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Wand2 className="w-4 h-4 text-violet-600" /> Your Template</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-3">
                  <p className="text-gray-500 font-medium mb-1">Type</p>
                  <p className="font-bold text-gray-900 dark:text-white">{selectedCat?.icon} {selectedCat?.label ?? category}</p>
                </div>
                <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-3">
                  <p className="text-gray-500 font-medium mb-1">Style</p>
                  <p className="font-bold text-gray-900 dark:text-white">{HTML_STYLE_PRESETS.find(s => s.id === stylePreset)?.label}</p>
                </div>
                <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-3 col-span-2">
                  <p className="text-gray-500 font-medium mb-1">Title</p>
                  <p className="font-bold text-gray-900 dark:text-white">{title}</p>
                </div>
                {features.length > 0 && (
                  <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-3 col-span-2">
                    <p className="text-gray-500 font-medium mb-2">Features</p>
                    <div className="flex flex-wrap gap-1.5">
                      {features.map(f => (
                        <span key={f} className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-medium">
                          {FEATURE_OPTIONS.find(o => o.id === f)?.icon} {FEATURE_OPTIONS.find(o => o.id === f)?.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-3">
                  <p className="text-gray-500 font-medium mb-1">Color</p>
                  <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full border border-white shadow-sm" style={{ backgroundColor: colorScheme }} /><span className="font-mono font-bold text-gray-900 dark:text-white">{colorScheme}</span></div>
                </div>
                <div className="bg-white/70 dark:bg-gray-800/70 rounded-xl p-3 col-span-2">
                  <p className="text-gray-500 font-medium mb-1">AI Model</p>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 dark:text-white">{HTML_AI_MODELS.find(m => m.id === selectedModel)?.label ?? selectedModel}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">{HTML_AI_MODELS.find(m => m.id === selectedModel)?.badge}</span>
                    <span className="text-xs text-gray-400">{HTML_AI_MODELS.find(m => m.id === selectedModel)?.desc}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI what-to-expect */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-4 space-y-2">
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-violet-500" /> What AI will generate</p>
              {[
                { icon: <Code2 className="w-3.5 h-3.5 text-cyan-500" />, text: "Complete HTML5 + CSS3 + JavaScript in one file" },
                { icon: <Palette className="w-3.5 h-3.5 text-pink-500" />, text: `${HTML_STYLE_PRESETS.find(s => s.id === stylePreset)?.label} visual design with your brand color` },
                { icon: <Layers className="w-3.5 h-3.5 text-emerald-500" />, text: "Premium sections: hero, features, CTA, footer" },
                { icon: <Zap className="w-3.5 h-3.5 text-amber-500" />, text: "Micro-interactions, animations & hover effects" },
              ].map(({ icon, text }, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">{icon}<span>{text}</span></div>
              ))}
            </div>

            {/* Progress bar */}
            {generating && (
              <div className="rounded-xl bg-gradient-to-r from-violet-900/50 to-indigo-900/50 border border-violet-700/50 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-violet-300 font-semibold flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {progressMsg || "Generating…"}</span>
                  <span className="text-violet-400 font-bold">{progress}%</span>
                </div>
                <div className="h-2 bg-violet-900/50 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-violet-400 to-indigo-400 rounded-full"
                    initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {["Parsing prompt","Designing layout","Writing code","Finalizing"].map((lbl, i) => (
                    <div key={lbl} className={`h-1 rounded-full transition-all duration-500 ${progress > i * 25 ? "bg-violet-400" : "bg-violet-900/50"}`} />
                  ))}
                </div>
              </div>
            )}

            {/* Generated doc preview shortcut */}
            {generatedDoc && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
                  <div><p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Template ready!</p><p className="text-xs text-emerald-600 dark:text-emerald-400">{generatedDoc.title}</p></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    try {
                      const token = useAuthStore.getState().accessToken;
                      const rawBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                      const origin = rawBase.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
                      const res = await fetch(`${origin}/api/v1/documents/${generatedDoc.id}/render/`, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (!res.ok) throw new Error(`${res.status}`);
                      const html = await res.text();
                      const blob = new Blob([html], { type: "text/html" });
                      const blobUrl = URL.createObjectURL(blob);
                      window.open(blobUrl, "_blank", "noopener");
                      // Revoke after a delay so the new tab has time to load
                      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
                    } catch { toast.error("Could not open preview."); }
                  }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition">
                    <Play className="w-3.5 h-3.5" /> Preview
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} disabled={generating} className="px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50">← Back</button>
              <motion.button onClick={handleGenerate} disabled={generating} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:via-indigo-700 hover:to-purple-700 text-white text-sm font-bold transition shadow-xl shadow-violet-500/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating Template…</> : <><Sparkles className="w-4 h-4" /> Generate HTML Template</>}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


// ─── Drive Connection Panel ───────────────────────────────────────────────────

function DriveConnectionPanel({ isConnected, email, onConnect, onDisconnect, isLoading }: {
  isConnected: boolean; email: string | null; onConnect: () => void; onDisconnect: () => void; isLoading: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-4 flex-wrap ${isConnected ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700"}`}>
      <div className={`p-2 rounded-lg ${isConnected ? "bg-green-100 dark:bg-green-900/30" : "bg-gray-100 dark:bg-gray-700"}`}>
        <HardDrive className={`w-5 h-5 ${isConnected ? "text-green-600 dark:text-green-400" : "text-gray-400"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Google Drive</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{isConnected ? `Connected as ${email ?? "unknown"}` : "Connect your Google Drive to upload documents directly"}</p>
      </div>
      {isConnected ? (
        <button onClick={onDisconnect} disabled={isLoading} className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-60">Disconnect</button>
      ) : (
        <button onClick={onConnect} disabled={isLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-60">
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} Connect Drive
        </button>
      )}
    </div>
  );
}

// ─── Document Generate Form (PDF / PPT / Word / Markdown / HTML page) ─────────

function GenerateForm({ onSuccess }: { onSuccess: () => void }) {
  const MODELS = [
    { id: "openai/gpt-4o-mini",                label: "GPT-4o Mini",       badge: "⚡", desc: "Fast & smart",   ctx: "128k", speed: "Fast" },
    { id: "openai/gpt-4o",                     label: "GPT-4o",            badge: "🧠", desc: "Most capable",  ctx: "128k", speed: "Medium" },
    { id: "anthropic/claude-3.5-sonnet",       label: "Claude 3.5 Sonnet", badge: "✨", desc: "Best writing",  ctx: "200k", speed: "Medium" },
    { id: "google/gemini-2.0-flash-001",       label: "Gemini 2.0 Flash",  badge: "🚀", desc: "Ultra fast",    ctx: "1M",   speed: "Ultra" },
    { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B",     badge: "🦙", desc: "Open source",  ctx: "128k", speed: "Fast" },
  ];

  const [docType, setDocType] = useState<GenerateDocType>("pdf");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("");
  const [selectedModel, setSelectedModel] = useState("openai/gpt-4o-mini");
  const [generating, setGenerating] = useState(false);
  const [sseProgress, setSseProgress] = useState(0);
  const [sseStep, setSseStep] = useState("");
  const [sseMessage, setSseMessage] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => { requestNotificationPermission(); }, []);

  const handleGenerate = async () => {
    if (!prompt.trim() || prompt.trim().length < 10) { toast.error("Prompt must be at least 10 characters."); return; }
    if (!title.trim() || title.trim().length < 3) { toast.error("Title must be at least 3 characters."); return; }
    setGenerating(true); setSseProgress(0); setSseStep("start"); setSseMessage("Connecting…");
    try {
      const token = useAuthStore.getState().accessToken;
      const rawBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const baseUrl = rawBase.replace(/\/api\/v1\/?$/, "");
      const response = await fetch(`${baseUrl}/api/v1/documents/generate-stream/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ doc_type: docType, title: title.trim(), prompt: prompt.trim(), subtitle: subtitle.trim(), author: author.trim(), model: selectedModel }),
      });
      if (!response.ok || !response.body) {
        setSseMessage("Generating document…"); setSseProgress(40);
        const { data } = await api.post("/documents/generate/", { doc_type: docType, title: title.trim(), prompt: prompt.trim(), subtitle: subtitle.trim(), author: author.trim() });
        setSseProgress(100); setSseMessage("Done!");
        toast.success("Document generated!"); queryClient.invalidateQueries({ queryKey: ["documents"] }); onSuccess(); return;
      }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.progress !== undefined) setSseProgress(Math.min(evt.progress, 99));
            if (evt.message) setSseMessage(evt.message);
            if (evt.step) setSseStep(evt.step);
            if (evt.step === "done" || evt.document) {
              setSseProgress(100); setSseMessage("Document ready!");
              toast.success("🎉 Document generated!"); queryClient.invalidateQueries({ queryKey: ["documents"] }); onSuccess();
            }
            if (evt.error) toast.error(evt.error);
          } catch {}
        }
      }
    } catch (err: any) { toast.error(err?.response?.data?.error ?? "Generation failed."); } finally { setGenerating(false); }
  };

  const docTypes: GenerateDocType[] = ["pdf", "ppt", "word", "markdown", "html"];

  return (
    <div className="space-y-5">
      {/* Doc type tabs */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Document Type</label>
        <div className="flex flex-wrap gap-2">
          {docTypes.map(dt => {
            const cfg = DOC_TYPE_CONFIG[dt]; const Icon = cfg.icon;
            return (
              <button key={dt} onClick={() => { setDocType(dt); setPrompt(PROMPT_EXAMPLES[dt]); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${docType === dt ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"}`}>
                <Icon className={`w-4 h-4 ${cfg.colour}`} /> {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Title *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. State of AI 2026 Report"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      {/* Prompt */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Prompt *</label>
          <button onClick={() => setPrompt(PROMPT_EXAMPLES[docType])} className="text-xs text-indigo-500 hover:text-indigo-600 transition">Use example ↗</button>
        </div>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4} placeholder="Describe what you want the AI to write…"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        <p className="text-xs text-gray-400 mt-1">{prompt.length} chars</p>
      </div>

      {/* Optional fields */}
      {(docType === "pdf" || docType === "ppt" || docType === "word") && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Subtitle</label>
            <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Optional subtitle" className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
          <div><label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Author</label>
            <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Your name" className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
        </div>
      )}

      {/* Model picker */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">AI Model</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {MODELS.map(m => (
            <button key={m.id} onClick={() => setSelectedModel(m.id)}
              className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 text-left transition-all ${selectedModel === m.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30" : "border-gray-200 dark:border-gray-700 hover:border-indigo-300"}`}>
              <span className="text-lg">{m.badge}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{m.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{m.desc} · {m.speed}</p>
              </div>
              {selectedModel === m.id && <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Progress */}
      {generating && (
        <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-indigo-700 dark:text-indigo-300 font-semibold flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{sseMessage || "Generating…"}</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{sseProgress}%</span>
          </div>
          <div className="h-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-full overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${sseProgress}%` }} transition={{ duration: 0.4 }} />
          </div>
        </div>
      )}

      <motion.button onClick={handleGenerate} disabled={generating} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-bold transition shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
        {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate {DOC_TYPE_CONFIG[docType].label}</>}
      </motion.button>
    </div>
  );
}

// ─── Project Builder Form (others locked, HTML Template unlocked) ─────────────

function ProjectBuilderForm({ onSuccess }: { onSuccess: () => void }) {
  const LOCKED_PROJECTS = [
    { id: "django",      label: "Django REST API",          icon: "🐍", badge: "Python",     desc: "DRF + JWT + PostgreSQL + Docker",              stack: ["Python", "Django", "PostgreSQL", "Docker"] },
    { id: "fastapi",     label: "FastAPI Microservice",     icon: "⚡", badge: "Python",     desc: "SQLAlchemy + Pydantic + Uvicorn + Docker",     stack: ["Python", "FastAPI", "SQLAlchemy", "Redis"] },
    { id: "nextjs",      label: "Next.js App",              icon: "▲",  badge: "TypeScript", desc: "TypeScript + Tailwind + Zustand + API client", stack: ["TypeScript", "Next.js", "Tailwind", "Zustand"] },
    { id: "datascience", label: "Data Science Project",     icon: "📊", badge: "Python",     desc: "Jupyter + pandas + scikit-learn + matplotlib", stack: ["Python", "Jupyter", "pandas", "scikit-learn"] },
    { id: "react_lib",   label: "React Component Library",  icon: "⚛️",  badge: "TypeScript", desc: "TypeScript + Storybook + Rollup + tests",      stack: ["TypeScript", "React", "Storybook", "Rollup"] },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 p-6 text-white">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage:"radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize:"30px 30px"}} />
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center"><FolderGit2 className="w-5 h-5" /></div>
            <div>
              <h2 className="font-bold text-lg">Project Builder</h2>
              <p className="text-violet-200 text-xs">AI-powered project scaffolding</p>
            </div>
          </div>
          <p className="text-sm text-violet-100 leading-relaxed">Choose a project template. <span className="font-bold text-white">HTML Template is available now</span> — other project types are coming soon.</p>
        </div>
      </div>

      {/* ── HTML Template card (UNLOCKED) ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-gradient-to-r from-violet-500/50 to-transparent" />
          <span className="text-xs font-bold text-violet-600 dark:text-violet-400 px-2">✨ AVAILABLE NOW</span>
          <div className="h-px flex-1 bg-gradient-to-l from-violet-500/50 to-transparent" />
        </div>
        <motion.div whileHover={{ scale: 1.01 }} className="relative overflow-hidden rounded-2xl border-2 border-violet-500 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 shadow-xl shadow-violet-500/10">
          {/* Animated glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-400/5 to-indigo-400/5 animate-pulse" />
          <div className="relative p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <LayoutTemplate className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">HTML Template</h3>
                  <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">Landing pages, portfolios, dashboards & more</p>
                </div>
              </div>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-xs font-bold shadow-lg">
                <Sparkles className="w-3 h-3" /> AI Ready
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {["HTML5", "CSS3", "JavaScript", "Responsive", "Self-contained"].map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-xs font-medium">{t}</span>
              ))}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
              Generate stunning, production-ready HTML templates with AI. From landing pages to full dashboards — pixel-perfect, animated, and fully self-contained.
            </p>
            <HtmlTemplateBuilder onSuccess={onSuccess} />
          </div>
        </motion.div>
      </div>

      {/* ── Locked projects ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-gradient-to-r from-gray-300/50 to-transparent dark:from-gray-600/50" />
          <span className="text-xs font-bold text-gray-400 px-2">🔒 COMING SOON</span>
          <div className="h-px flex-1 bg-gradient-to-l from-gray-300/50 to-transparent dark:from-gray-600/50" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LOCKED_PROJECTS.map(proj => (
            <div key={proj.id} className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              {/* lock overlay */}
              <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center gap-2 rounded-2xl">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shadow-inner">
                  <Lock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                </div>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Coming Soon</span>
              </div>
              {/* card content (blurred behind overlay) */}
              <div className="p-4 select-none">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xl">{proj.icon}</div>
                    <div>
                      <p className="font-bold text-sm text-gray-700 dark:text-gray-300">{proj.label}</p>
                      <p className="text-xs text-gray-400">{proj.desc}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${proj.badge === "Python" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"}`}>{proj.badge}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {proj.stack.map(s => <span key={s} className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs">{s}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"documents" | "projects">("documents");
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<DocType | "all">("all");
  const [driveConnecting, setDriveConnecting] = useState(false);

  const { data: docsData, isLoading } = useQuery({ queryKey: ["documents"], queryFn: fetchDocuments });
  const { data: driveStatus } = useQuery({ queryKey: ["driveStatus"], queryFn: fetchDriveStatus });

  const documents = docsData?.results ?? [];
  const driveConnected = driveStatus?.is_connected ?? false;

  const filtered = filterType === "all" ? documents : documents.filter(d => d.doc_type === filterType);

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => { toast.success("Document deleted."); queryClient.invalidateQueries({ queryKey: ["documents"] }); },
    onError: () => toast.error("Delete failed."),
  });

  const disconnectDriveMutation = useMutation({
    mutationFn: disconnectDrive,
    onSuccess: () => { toast.success("Drive disconnected."); queryClient.invalidateQueries({ queryKey: ["driveStatus"] }); },
  });

  const handleDriveConnect = async () => {
    setDriveConnecting(true);
    try {
      const { data } = await api.get("/integrations/drive/connect/");
      if (data.not_configured) { toast.error("Google Drive is not configured on this server."); return; }
      if (data.authorization_url) window.location.href = data.authorization_url;
    } catch (err: any) {
      if (err?.response?.data?.not_configured) toast.error("Google Drive is not configured on this server.");
      else toast.error("Could not connect to Google Drive.");
    } finally { setDriveConnecting(false); }
  };

  // Stats per doc type
  const stats = (Object.entries(DOC_TYPE_CONFIG) as [DocType, typeof DOC_TYPE_CONFIG[DocType]][]).map(([type, cfg]) => ({
    type, cfg, count: documents.filter(d => d.doc_type === type).length,
  }));

  const totalDocs = documents.length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 lg:pb-8 space-y-6">

        {/* ── Hero header ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-8 text-white shadow-2xl shadow-violet-500/20">
          {/* Decorative dots grid */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)", backgroundSize: "24px 24px" }} />
          {/* Glowing orbs */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-20 translate-x-20 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-purple-400/10 rounded-full translate-y-16 -translate-x-16 blur-2xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-bold tracking-widest text-violet-200 uppercase">Document Studio</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight mb-2">Create with AI</h1>
              <p className="text-violet-200 text-sm leading-relaxed max-w-lg">
                Generate professional PDFs, presentations, docs, and stunning HTML templates — all powered by state-of-the-art AI models.
              </p>
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-violet-100">{totalDocs} documents created</span></div>
                <div className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-400" /><span className="text-violet-100">Streaming generation</span></div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => { setActiveTab("documents"); setShowForm(s => !s); }}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-indigo-700 font-bold text-sm shadow-xl hover:bg-indigo-50 transition">
                <Plus className="w-4 h-4" /> New Document
              </motion.button>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => { setActiveTab("projects"); setShowForm(false); }}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 text-white font-bold text-sm transition">
                <FolderGit2 className="w-4 h-4" /> Project Builder
              </motion.button>
            </div>
          </div>
        </div>

        {/* ── Tab switcher ── */}
        <div className="flex items-center gap-1 bg-white dark:bg-gray-800/80 rounded-2xl p-1 border border-gray-200 dark:border-gray-700 shadow-sm w-fit">
          {[
            { id: "documents", label: "Documents", icon: FileText },
            { id: "projects",  label: "Project Builder", icon: FolderGit2 },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id as "documents" | "projects"); if (tab.id === "documents") setShowForm(false); }}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50"
                }`}>
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === "projects" && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-xs font-bold">
                    NEW
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── DOCUMENTS TAB ── */}
        <AnimatePresence mode="wait">
          {activeTab === "documents" && (
            <motion.div key="documents-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

              {/* Generate form panel */}
              <AnimatePresence>
                {showForm && (
                  <motion.div initial={{ opacity: 0, y: -16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.98 }}
                    className="bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center"><Wand2 className="w-4 h-4 text-white" /></div>
                        <div><p className="font-bold text-white text-sm">Generate New Document</p><p className="text-indigo-200 text-xs">AI writes your content in seconds</p></div>
                      </div>
                      <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="p-6"><GenerateForm onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["documents"] }); setShowForm(false); }} /></div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Drive panel */}
              <DriveConnectionPanel
                isConnected={driveConnected}
                email={driveStatus?.google_email ?? null}
                onConnect={handleDriveConnect}
                onDisconnect={() => disconnectDriveMutation.mutate()}
                isLoading={driveConnecting || disconnectDriveMutation.isPending}
              />

              {/* Stats row */}
              <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Total */}
                <div className="rounded-xl p-4 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 col-span-3 sm:col-span-1 lg:col-span-1">
                  <div className="flex items-center gap-2 mb-1"><Layers className="w-4 h-4 text-indigo-500" /><span className="text-xs font-medium text-gray-600 dark:text-gray-400">Total</span></div>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{totalDocs}</p>
                </div>
                {stats.map(({ type, cfg, count }) => {
                  const Icon = cfg.icon;
                  return (
                    <div key={type} className={`rounded-xl p-4 border border-gray-200 dark:border-gray-700 ${cfg.bg}`}>
                      <div className="flex items-center gap-1.5 mb-1"><Icon className={`w-4 h-4 ${cfg.colour}`} /><span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">{cfg.label}</span></div>
                      <p className="text-2xl font-black text-gray-900 dark:text-white">{count}</p>
                    </div>
                  );
                })}
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                {(["all", "pdf", "ppt", "word", "markdown", "html", "project"] as const).map(t => (
                  <button key={t} onClick={() => setFilterType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      filterType === t ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                    }`}>
                    {t === "all" ? "All Documents" : DOC_TYPE_CONFIG[t].label}
                  </button>
                ))}
              </div>

              {/* Document grid */}
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 h-48 animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/30 dark:to-violet-900/30 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-10 h-10 text-indigo-400 dark:text-indigo-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {filterType === "all" ? "No documents yet" : `No ${DOC_TYPE_CONFIG[filterType].label} documents`}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    {filterType === "all" ? "Click \"New Document\" to generate your first AI-powered document." : `Switch to another filter or generate a ${DOC_TYPE_CONFIG[filterType].label}.`}
                  </p>
                  <motion.button whileHover={{ scale: 1.03 }} onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-violet-700 transition">
                    <Plus className="w-4 h-4" /> Generate Document
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {filtered.map(doc => (
                      <DocumentCard key={doc.id} doc={doc} onDelete={id => deleteMutation.mutate(id)} driveConnected={driveConnected} />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── PROJECTS TAB ── */}
          {activeTab === "projects" && (
            <motion.div key="projects-tab" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
                <ProjectBuilderForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["documents"] })} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
