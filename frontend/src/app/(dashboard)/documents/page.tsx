"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Presentation,
  FileCode2,
  File,
  Plus,
  Download,
  Trash2,
  Loader2,
  ChevronDown,
  Sparkles,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/utils/api";
import { formatDistanceToNow } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

type DocType = "pdf" | "ppt" | "word" | "markdown";

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
}

interface GeneratePayload {
  doc_type: DocType;
  title: string;
  prompt: string;
  subtitle?: string;
  author?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DOC_TYPE_CONFIG: Record<
  DocType,
  { label: string; icon: React.ElementType; colour: string; bg: string }
> = {
  pdf: {
    label: "PDF Report",
    icon: FileText,
    colour: "text-red-500",
    bg: "bg-red-50 dark:bg-red-900/20",
  },
  ppt: {
    label: "PowerPoint",
    icon: Presentation,
    colour: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
  word: {
    label: "Word Doc",
    icon: File,
    colour: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  markdown: {
    label: "Markdown",
    icon: FileCode2,
    colour: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
};

const PROMPT_EXAMPLES: Record<DocType, string> = {
  pdf: "Write a comprehensive report on the latest advancements in Large Language Models including key players, benchmark results, and future directions.",
  ppt: "Create a 5-slide presentation on RAG (Retrieval-Augmented Generation) explaining what it is, how it works, use cases, limitations, and future outlook.",
  word: "Generate a technical design document for a microservices architecture for an e-commerce platform with sections on services, data flow, API contracts, and deployment.",
  markdown: "Write a developer README for a Python CLI tool that scrapes Hacker News and summarizes top stories using OpenAI.",
};

// ─── API helpers ─────────────────────────────────────────────────────────────

const fetchDocuments = async (): Promise<{ results: DocumentRecord[]; count: number }> => {
  const { data } = await api.get("/api/v1/documents/");
  return data;
};

const generateDocument = async (payload: GeneratePayload): Promise<DocumentRecord> => {
  const { data } = await api.post("/api/v1/documents/generate/", payload);
  return data;
};

const deleteDocument = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/documents/${id}/`);
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function DocTypePicker({
  value,
  onChange,
}: {
  value: DocType;
  onChange: (t: DocType) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {(Object.entries(DOC_TYPE_CONFIG) as [DocType, typeof DOC_TYPE_CONFIG[DocType]][]).map(
        ([type, cfg]) => {
          const Icon = cfg.icon;
          const active = value === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                active
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-indigo-300"
              }`}
            >
              <Icon className={`w-6 h-6 ${active ? "text-indigo-600" : cfg.colour}`} />
              <span
                className={`text-xs font-medium ${
                  active ? "text-indigo-700 dark:text-indigo-300" : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {cfg.label}
              </span>
            </button>
          );
        }
      )}
    </div>
  );
}

function GenerateForm({ onSuccess }: { onSuccess: () => void }) {
  const [docType, setDocType] = useState<DocType>("pdf");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("SYNAPSE AI");

  const mutation = useMutation({
    mutationFn: generateDocument,
    onSuccess: () => {
      toast.success("Document generated successfully!");
      setTitle("");
      setPrompt("");
      setSubtitle("");
      onSuccess();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Generation failed. Please try again.";
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !prompt.trim()) {
      toast.error("Title and prompt are required.");
      return;
    }
    mutation.mutate({ doc_type: docType, title, prompt, subtitle, author });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Doc type picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Document Type
        </label>
        <DocTypePicker value={docType} onChange={setDocType} />
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Q1 2025 AI Trends Report"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
          disabled={mutation.isPending}
        />
      </div>

      {/* Subtitle (PDF/PPT only) */}
      {(docType === "pdf" || docType === "ppt") && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Subtitle <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="e.g. An Analysis by SYNAPSE AI"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition"
            disabled={mutation.isPending}
          />
        </div>
      )}

      {/* Prompt */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Content Prompt <span className="text-red-400">*</span>
          </label>
          <button
            type="button"
            onClick={() => setPrompt(PROMPT_EXAMPLES[docType])}
            className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" /> Use example
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          placeholder="Describe what you want the AI to generate in this document..."
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none"
          disabled={mutation.isPending}
        />
      </div>

      {/* Author */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Author
        </label>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition"
          disabled={mutation.isPending}
        />
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate Document
          </>
        )}
      </button>
    </form>
  );
}

function DocumentCard({
  doc,
  onDelete,
}: {
  doc: DocumentRecord;
  onDelete: (id: string) => void;
}) {
  const cfg = DOC_TYPE_CONFIG[doc.doc_type];
  const Icon = cfg.icon;
  const sizeKb = doc.file_size_bytes ? (doc.file_size_bytes / 1024).toFixed(1) : null;

  const handleDownload = () => {
    window.open(doc.download_url, "_blank");
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-lg ${cfg.bg} flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${cfg.colour}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm">
            {doc.title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {cfg.label}
            {sizeKb && <span className="ml-2">· {sizeKb} KB</span>}
          </p>
        </div>
      </div>

      {/* Prompt preview */}
      {doc.agent_prompt && (
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 italic">
          "{doc.agent_prompt}"
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={!doc.download_url}
            className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition disabled:opacity-40"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(doc.id)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentStudioPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<DocType | "all">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: fetchDocuments,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document deleted.");
    },
    onError: () => toast.error("Failed to delete document."),
  });

  const documents = data?.results ?? [];
  const filtered =
    filterType === "all" ? documents : documents.filter((d) => d.doc_type === filterType);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-500" />
            Document Studio
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generate AI-powered PDFs, presentations, Word docs, and Markdown files
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Close" : "New Document"}
        </button>
      </div>

      {/* Generation form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">
                Generate New Document
              </h2>
              <GenerateForm
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ["documents"] });
                  setShowForm(false);
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(Object.entries(DOC_TYPE_CONFIG) as [DocType, typeof DOC_TYPE_CONFIG[DocType]][]).map(
          ([type, cfg]) => {
            const Icon = cfg.icon;
            const count = documents.filter((d) => d.doc_type === type).length;
            return (
              <div
                key={type}
                className={`rounded-xl p-4 border ${cfg.bg} border-gray-200 dark:border-gray-700`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${cfg.colour}`} />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {cfg.label}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{count}</p>
              </div>
            );
          }
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "pdf", "ppt", "word", "markdown"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filterType === t
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {t === "all" ? "All" : DOC_TYPE_CONFIG[t].label}
          </button>
        ))}
      </div>

      {/* Document grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-100 dark:bg-gray-800 rounded-xl h-40 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No documents yet</p>
          <p className="text-sm mt-1">
            Click &quot;New Document&quot; to generate your first AI document
          </p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
