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
  Cloud,
  HardDrive,
  CheckCircle2,
  Link2,
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
  const { data } = await api.get("/documents/");
  // StandardPagination returns { success, data: [...], meta: {...} }
  // Normalise to { results, count } for backward compat with the page below
  if (Array.isArray(data?.data)) {
    return { results: data.data, count: data.meta?.total ?? data.data.length };
  }
  // Fallback: plain DRF { results, count }
  if (Array.isArray(data?.results)) return { results: data.results, count: data.count ?? data.results.length };
  if (Array.isArray(data)) return { results: data, count: data.length };
  return { results: [], count: 0 };
};

const generateDocument = async (payload: GeneratePayload): Promise<DocumentRecord> => {
  const { data } = await api.post("/documents/generate/", payload);
  return data;
};

const generateProject = async (payload: ProjectPayload): Promise<DocumentRecord> => {
  const { data } = await api.post("/documents/generate-project/", payload);
  return data;
};

const deleteDocument = async (id: string): Promise<void> => {
  await api.delete(`/documents/${id}/`);
};

// ── Cloud Integration API helpers ─────────────────────────────────────────────

const fetchDriveStatus = async (): Promise<{ is_connected: boolean; google_email: string | null }> => {
  const { data } = await api.get("/integrations/drive/status/");
  return data;
};

const fetchDriveConnectUrl = async (): Promise<string> => {
  const { data } = await api.get("/integrations/drive/connect/");
  return data.authorization_url;
};

const uploadToDrive = async ({
  documentId,
  folderName,
}: {
  documentId: string;
  folderName: string;
}): Promise<{ drive_url: string }> => {
  const { data } = await api.post("/integrations/drive/upload/", {
    document_id: documentId,
    folder_name: folderName,
  });
  return data;
};

const uploadToS3 = async ({
  documentId,
}: {
  documentId: string;
}): Promise<{ presigned_url: string }> => {
  const { data } = await api.post("/integrations/s3/upload/", {
    document_id: documentId,
  });
  return data;
};

const disconnectDrive = async (): Promise<void> => {
  await api.delete("/integrations/drive/disconnect/");
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
  driveConnected,
}: {
  doc: DocumentRecord;
  onDelete: (id: string) => void;
  driveConnected: boolean;
}) {
  const cfg = DOC_TYPE_CONFIG[doc.doc_type] ?? DOC_TYPE_CONFIG.pdf;
  const Icon = cfg.icon;
  const [driveUploading, setDriveUploading] = useState(false);
  const [s3Uploading, setS3Uploading]       = useState(false);
  const [driveUrl, setDriveUrl]             = useState<string | null>(
    doc.metadata?.drive_file_id ? String(doc.metadata.drive_file_id) : null
  );

  const handleDriveUpload = async () => {
    setDriveUploading(true);
    try {
      const result = await uploadToDrive({ documentId: doc.id, folderName: "SYNAPSE Documents" });
      setDriveUrl(result.drive_url);
      toast.success("Uploaded to Google Drive!");
    } catch {
      toast.error("Drive upload failed. Please try again.");
    } finally {
      setDriveUploading(false);
    }
  };

  const handleS3Upload = async () => {
    setS3Uploading(true);
    try {
      const result = await uploadToS3({ documentId: doc.id });
      toast.success("Uploaded to S3! Presigned URL ready.");
      if (result.presigned_url) {
        window.open(result.presigned_url, "_blank");
      }
    } catch {
      toast.error("S3 upload failed. Please try again.");
    } finally {
      setS3Uploading(false);
    }
  };

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
        <div className="flex items-center gap-1.5">
          {driveUrl && (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="View on Google Drive"
              className="p-1 rounded-full bg-green-50 dark:bg-green-900/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            </a>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.colour}`}>
            {cfg.label}
          </span>
        </div>
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

      {/* Primary actions */}
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

      {/* Cloud upload actions */}
      <div className="flex gap-2 pt-0.5 border-t border-gray-100 dark:border-gray-700">
        {/* Upload to Google Drive */}
        <button
          onClick={handleDriveUpload}
          disabled={!driveConnected || driveUploading}
          title={driveConnected ? "Upload to Google Drive" : "Connect Google Drive first"}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
            driveConnected
              ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
              : "bg-gray-50 dark:bg-gray-700/50 text-gray-400 cursor-not-allowed"
          }`}
        >
          {driveUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <HardDrive className="w-3.5 h-3.5" />
          )}
          Drive
        </button>

        {/* Upload to S3 */}
        <button
          onClick={handleS3Upload}
          disabled={s3Uploading}
          title="Upload to AWS S3 (get presigned URL)"
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-xs font-medium hover:bg-orange-100 dark:hover:bg-orange-900/40 transition disabled:opacity-60"
        >
          {s3Uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Cloud className="w-3.5 h-3.5" />
          )}
          S3
        </button>
      </div>
    </motion.div>
  );
}

// ─── Drive Connection Banner ──────────────────────────────────────────────────

function DriveConnectionPanel({
  isConnected,
  email,
  onConnect,
  onDisconnect,
  isLoading,
}: {
  isConnected: boolean;
  email: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  isLoading: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-4 flex-wrap ${
      isConnected
        ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
        : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700"
    }`}>
      <div className={`p-2 rounded-lg ${isConnected ? "bg-green-100 dark:bg-green-900/30" : "bg-gray-100 dark:bg-gray-700"}`}>
        <HardDrive className={`w-5 h-5 ${isConnected ? "text-green-600 dark:text-green-400" : "text-gray-400"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          Google Drive
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {isConnected
            ? `Connected as ${email ?? "unknown"}`
            : "Connect your Google Drive to upload documents directly"}
        </p>
      </div>
      {isConnected ? (
        <button
          onClick={onDisconnect}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-60"
        >
          Disconnect
        </button>
      ) : (
        <button
          onClick={onConnect}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
          Connect Drive
        </button>
      )}
    </div>
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
  const [driveConnecting, setDriveConnecting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: fetchDocuments,
  });

  // Drive connection status
  const { data: driveStatus, refetch: refetchDriveStatus } = useQuery({
    queryKey: ["drive-status"],
    queryFn: fetchDriveStatus,
    retry: false,
    staleTime: 60_000,
  });

  const disconnectDriveMutation = useMutation({
    mutationFn: disconnectDrive,
    onSuccess: () => {
      refetchDriveStatus();
      toast.success("Google Drive disconnected.");
    },
    onError: () => toast.error("Failed to disconnect Drive."),
  });

  const handleDriveConnect = async () => {
    setDriveConnecting(true);
    try {
      const url = await fetchDriveConnectUrl();
      window.location.href = url;
    } catch {
      toast.error("Could not start Drive OAuth2 flow.");
      setDriveConnecting(false);
    }
  };

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
  const driveConnected = driveStatus?.is_connected ?? false;

  return (
    <div className="flex-1 overflow-y-auto">
    <div className="max-w-6xl mx-auto px-4 py-8 pb-24 lg:pb-8 space-y-6">
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

      {/* Google Drive + S3 connection panel */}
      <DriveConnectionPanel
        isConnected={driveConnected}
        email={driveStatus?.google_email ?? null}
        onConnect={handleDriveConnect}
        onDisconnect={() => disconnectDriveMutation.mutate()}
        isLoading={driveConnecting || disconnectDriveMutation.isPending}
      />

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
                driveConnected={driveConnected}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  </div>
  );
}
