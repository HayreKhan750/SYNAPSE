// Auth
export interface User {
  id: string
  username: string
  email: string
  first_name: string
  last_name: string
  role: 'free' | 'pro' | 'enterprise' | 'admin'
  preferences: Record<string, unknown>
  date_joined: string
  avatar_url?: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterData {
  username: string
  email: string
  password: string
  password2: string
  first_name?: string
  last_name?: string
}

// Article / Source
export interface Source {
  id: string
  name: string
  url: string
  source_type: 'news' | 'github' | 'arxiv' | 'youtube' | 'blog'
}

export interface Article {
  id: string
  title: string
  content: string
  summary: string
  url: string
  source: Source | null
  author: string
  published_at: string | null
  scraped_at: string
  topic: string
  tags: string[]
  keywords: string[]
  sentiment_score: number | null
  trending_score: number
  view_count: number
  metadata: Record<string, unknown>
}

// Repository
export interface Repository {
  id: string
  github_id: number
  name: string
  full_name: string
  description: string
  url: string
  clone_url: string
  stars: number
  forks: number
  watchers: number
  open_issues: number
  language: string
  topics: string[]
  owner: string
  is_trending: boolean
  stars_today: number
  repo_created_at: string | null
  metadata: Record<string, unknown>
}

// Research Paper
export interface ResearchPaper {
  id: string
  arxiv_id: string
  title: string
  abstract: string
  summary: string
  authors: string[]
  categories: string[]
  published_date: string | null
  url: string
  pdf_url: string
  citation_count: number
  difficulty_level: 'beginner' | 'intermediate' | 'advanced'
  key_contributions: string
  applications: string
  fetched_at: string
}

// Video
export interface Video {
  id: string
  youtube_id: string
  title: string
  description: string
  summary: string
  channel_name: string
  channel_id: string
  url: string
  thumbnail_url: string
  duration_seconds: number
  view_count: number
  like_count: number
  published_at: string | null
  topics: string[]
  fetched_at: string
}

// Pagination
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// API Error
export interface ApiError {
  message: string
  errors?: Record<string, string[]>
  status?: number
}
