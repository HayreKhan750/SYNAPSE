"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Presentation,
  FileCode2,
  File,
  FolderGit2,
  Plus,
  Download,
  Trash2,
  Loader2,
  Sparkles,
  X,
  Archive,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/utils/api";
import { formatDistanceToNow } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

type DocType = "pdf" | "ppt" | "word" | "markdown" | "project";
type ProjectType = "django" | "fastapi" | "nextjs" | "datascience" | "react_lib";
type ProjectFeature = "auth" | "testing" | "ci_cd";

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
  doc_type: Exclude<DocType, "project">;
  title: string;
  prompt: string;
  subtitle?: string;
  author?: string;
}

interface ProjectPayload {
  project_type: ProjectType;
  name: string;
  features: ProjectFeature[];
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
  project: {
    label: "Project",
    icon: FolderGit2,
    colour: "text-violet-500",
    bg: "bg-violet-50 dark:bg-violet-900/20",
  },
};

const PROJECT_TYPE_CONFIG: Record<
  ProjectType,
  { label: string; description: string; badge: string }
> = {
  django: {
    label: "Django REST API",
    description: "DRF + JWT auth + PostgreSQL + Docker",
    badge: "Python",
  },
  fastapi: {
    label: "FastAPI Microservice",
    description: "SQLAlchemy + Pydantic + Uvicorn + Docker",
    badge: "Python",
  },
  nextjs: {
    label: "Next.js App",
    description: "TypeScript + Tailwind + Zustand + API client",
    badge: "TypeScript",
  },
  datascience: {
    label: "Data Science Project",
    description: "Jupyter + pandas + scikit-learn + matplotlib",
    badge: "Python",
  },
  react_lib: {
    label: "React Component Library",
    description: "TypeScript + Storybook + Rollup + tests",
    badge: "TypeScript",
  },
};

const PROMPT_EXAMPLES: Record<Exclude<DocType, "project">, string> = {
  pdf: "Write a comprehensive report on the latest advancements in Large Language Models including key players, benchmark results, and future directions.",
  ppt: "Create a 5-slide presentation on RAG (Retrieval-Augmented Generation) explaining what it is, how it works, use cases, limitations, and future outlook.",
  word: "Generate a technical design document for a microservices architecture for an e-commerce platform with sections on services, data flow, API contracts, and deployment.",
  markdown:
    "Write a developer README for a Python CLI tool that scrapes Hacker News and summarizes top stories using OpenAI.",
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

const generateProject = async (payload: ProjectPayload): Promise<DocumentRecord> => {
  const { data } = await api.post("/api/v1/documents/generate-project/", payload);
  return data;
};

const deleteDocument = async (id: string): Promise<void> => {
  await api.delete(`/api/v1/documents/${id}/`);
};

// ─── Utilities ───────────────────────────────────────────────────────────────

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// ─── Document Card ────────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  onDelete,
}: {
  doc: DocumentRecord;
  onDelete: (id: string) => void;
}) {
  const cfg = DOC_TYPE_CONFIG[doc.doc_type] ?? DOC_TYPE_CONFIG.pdf;
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`p-2 rounded-lg ${cfg.bg}`}>
          <Icon className={`w-5 h-5 ${cfg.colour}`} />
        </div>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.colour}`}
        >
          {cfg.label}
        </span>
      </div>

      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight line-clamp-2">
          {doc.title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
          {doc.agent_prompt}
        </p>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mt-auto">
        <span>{formatBytes(doc.file_size_bytes)}</span>
        <span>{formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}</span>
      </div>

      <div className="flex gap-2">
        <a
          href={doc.download_url}
          download
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
        >
          <Download className="w-3.5 h-3.5" />
          {doc.doc_type === "project" ? "Download .zip" : "Download"}
        </a>
        <button
          onClick={() => onDelete(doc.id)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Document Generate Form ───────────────────────────────────────────────────

function GenerateForm({ onSuccess }: { onSuccess: () => void }) {
  const [docType, setDocType] = useState<Exclude<DocType, "project">>("pdf");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("");

  const mutation = useMutation({
    mutationFn: generateDocument,
    onSuccess: () => {
      toast.success("Document generated!");
      onSuccess();
    },
    onError: () => toast.error("Generation failed. Please try again."),
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Doc type picker */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {(["pdf", "ppt", "word", "markdown"] as const).map((t) => {
          const cfg = DOC_TYPE_CONFIG[t];
          const Icon = cfg.icon;
          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                setDocType(t);
                setPrompt(PROMPT_EXAMPLES[t]);
              }}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-medium transition ${
                docType === t
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
              }`}
            >
              <Icon className={`w-5 h-5 ${docType === t ? "text-indigo-500" : cfg.colour}`} />
              {cfg.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Subtitle
          </label>
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Optional subtitle"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Author
        </label>
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="SYNAPSE AI"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Prompt *
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder={PROMPT_EXAMPLES[docType]}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition disabled:opacity-60"
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Generating…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" /> Generate Document
          </>
        )}
      </button>
    </form>
  );
}

// ─── Project Builder Form ─────────────────────────────────────────────────────

function ProjectBuilderForm({ onSuccess }: { onSuccess: () => void }) {
  const [projectType, setProjectType] = useState<ProjectType>("django");
  const [name, setName] = useState("");
  const [features, setFeatures] = useState<ProjectFeature[]>([]);

  const mutation = useMutation({
    mutationFn: generateProject,
    onSuccess: () => {
      toast.success("Project scaffold generated!");
      onSuccess();
    },
    onError: () => toast.error("Project generation failed. Please try again."),
  });

  const toggleFeature = (f: ProjectFeature) => {
    setFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      toast.error("Project name must be at least 2 characters.");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name.trim())) {
      toast.error("Project name may only contain letters, numbers, hyphens, and underscores.");
      return;
    }
    mutation.mutate({ project_type: projectType, name: name.trim(), features });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Project type picker */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Project Template
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(Object.entries(PROJECT_TYPE_CONFIG) as [ProjectType, typeof PROJECT_TYPE_CONFIG[ProjectType]][]).map(
            ([pt, cfg]) => (
              <button
                key={pt}
                type="button"
                onClick={() => setProjectType(pt)}
                className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition ${
                  projectType === pt
                    ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {cfg.label}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      cfg.badge === "Python"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                    }`}
                  >
                    {cfg.badge}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
                  {cfg.description}
                </span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Project name */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Project Name *
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-awesome-project"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Use kebab-case: letters, numbers, hyphens, underscores only
        </p>
      </div>

      {/* Feature flags */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Optional Features
        </label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "auth" as ProjectFeature, label: "🔒 Auth / JWT", desc: "Add authentication setup" },
              { key: "testing" as ProjectFeature, label: "🧪 Tests", desc: "Include test files" },
              { key: "ci_cd" as ProjectFeature, label: "⚙️ CI/CD", desc: "GitHub Actions workflow" },
            ] as const
          ).map(({ key, label, desc }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleFeature(key)}
              title={desc}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                features.includes(key)
                  ? "bg-violet-600 border-violet-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-violet-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm transition disabled:opacity-60"
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Generating…
          </>
        ) : (
          <>
            <Archive className="w-4 h-4" /> Generate Project (.zip)
          </>
        )}
      </button>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"documents" | "project">("documents");
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<"all" | DocType>("all");

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

  const documents: DocumentRecord[] = data?.results ?? [];
  const filtered =
    filterType === "all" ? documents : documents.filter((d) => d.doc_type === filterType);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Document Studio</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            AI-generated documents and project scaffolds
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab("documents"); setShowForm((v) => !v); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition"
          >
            {showForm && activeTab === "documents" ? (
              <><X className="w-4 h-4" /> Cancel</>
            ) : (
              <><Plus className="w-4 h-4" /> New Document</>
            )}
          </button>
          <button
            onClick={() => { setActiveTab("project"); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm transition"
          >
            <FolderGit2 className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
            activeTab === "documents"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
          }`}
        >
          📄 Documents
        </button>
        <button
          onClick={() => { setActiveTab("project"); setShowForm(true); }}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
            activeTab === "project"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
          }`}
        >
          🗂️ Project Builder
        </button>
      </div>

      {/* Form panel */}
      <AnimatePresence mode="wait">
        {showForm && (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {activeTab === "project" ? "Generate Project Scaffold" : "Generate New Document"}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {activeTab === "project" ? (
                <ProjectBuilderForm
                  onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["documents"] });
                    setShowForm(false);
                    setActiveTab("documents");
                  }}
                />
              ) : (
                <GenerateForm
                  onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["documents"] });
                    setShowForm(false);
                  }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">
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
        {(["all", "pdf", "ppt", "word", "markdown", "project"] as const).map((t) => (
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
          <p className="text-lg font-medium">Nothing here yet</p>
          <p className="text-sm mt-1">
            Use &quot;New Document&quot; or &quot;New Project&quot; to get started
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
