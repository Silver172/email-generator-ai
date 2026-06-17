import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth'
import type {
  TokenResponse,
  User,
  Template,
  TemplateListItem,
  TemplateField,
  SuggestedField,
  GeneratedEmail,
  GeneratedEmailListItem,
  ChatMessage,
} from '@/types'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export class APIError extends Error {
  constructor(
    public status: number,
    public data: Record<string, unknown>,
  ) {
    super(typeof data?.detail === 'string' ? data.detail : 'Request failed')
    this.name = 'APIError'
  }
}

async function req<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const token = getAccessToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...init, headers })

  // Auto-refresh expired access token once
  if (res.status === 401 && !retried) {
    const refresh = getRefreshToken()
    if (refresh) {
      try {
        const r = await fetch(`${BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
        })
        if (r.ok) {
          const tokens: TokenResponse = await r.json()
          setTokens(tokens.access_token, tokens.refresh_token)
          return req<T>(path, init, true)
        }
      } catch {
        // refresh failed — fall through to logout
      }
    }
    clearTokens()
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new APIError(401, { detail: 'session_expired' })
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: 'unknown_error' }))
    throw new APIError(res.status, data)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

const post  = <T>(path: string, body: unknown) =>
  req<T>(path, { method: 'POST', body: JSON.stringify(body) })
const get   = <T>(path: string) => req<T>(path)
const put   = <T>(path: string, body: unknown) =>
  req<T>(path, { method: 'PUT', body: JSON.stringify(body) })
const del   = <T>(path: string) => req<T>(path, { method: 'DELETE' })

// ── Typed API surface ─────────────────────────────────────────────────────────

export const api = {
  auth: {
    register: (d: { email: string; full_name: string; password: string }) =>
      post<TokenResponse>('/api/auth/register', d),
    login: (d: { email: string; password: string }) =>
      post<TokenResponse>('/api/auth/login', d),
    google: (token: string) =>
      post<TokenResponse>('/api/auth/google', { token }),
    me: () => get<User>('/api/auth/me'),
    logout: () => post<{ message: string }>('/api/auth/logout', {}),
  },

  templates: {
    list: () => get<TemplateListItem[]>('/api/templates'),
    get: (id: string) => get<Template>(`/api/templates/${id}`),
    create: (d: { name: string; description?: string; raw_content: string }) =>
      post<Template>('/api/templates', d),
    update: (id: string, d: { name?: string; description?: string; raw_content?: string }) =>
      put<Template>(`/api/templates/${id}`, d),
    delete: (id: string) => del<{ message: string }>(`/api/templates/${id}`),
    analyze: (content: string) =>
      post<{ suggested_fields: SuggestedField[] }>('/api/templates/analyze', { content }),
    saveFields: (id: string, fields: Omit<TemplateField, 'id' | 'template_id'>[]) =>
      post<Template>(`/api/templates/${id}/fields`, { fields }),
    chat: (
      id: string,
      message: string,
      currentFields: Omit<TemplateField, 'id' | 'template_id'>[],
      history: ChatMessage[],
    ) =>
      post<{
        message: string
        updated_fields: Omit<TemplateField, 'id' | 'template_id'>[]
        action: string
      }>(`/api/templates/${id}/chat`, { message, current_fields: currentFields, history }),
    chatPreview: (
      rawContent: string,
      message: string,
      currentFields: Omit<TemplateField, 'id' | 'template_id'>[],
      history: ChatMessage[],
    ) =>
      post<{
        message: string
        updated_fields: Omit<TemplateField, 'id' | 'template_id'>[]
        action: string
      }>('/api/templates/chat-preview', { message, raw_content: rawContent, current_fields: currentFields, history }),
  },

  email: {
    generate: (templateId: string, fieldValues: Record<string, unknown>) =>
      post<GeneratedEmail>('/api/email/generate', {
        template_id: templateId,
        field_values: fieldValues,
      }),
    history: (params?: { template_id?: string; skip?: number; limit?: number }) => {
      const qs = new URLSearchParams()
      if (params?.template_id) qs.set('template_id', params.template_id)
      if (params?.skip != null) qs.set('skip', String(params.skip))
      if (params?.limit != null) qs.set('limit', String(params.limit))
      const q = qs.toString()
      return get<GeneratedEmailListItem[]>(`/api/email/history${q ? `?${q}` : ''}`)
    },
    get: (id: string) => get<GeneratedEmail>(`/api/email/history/${id}`),
    downloadUrl: (id: string, format: 'html' | 'eml' | 'pdf') =>
      `${BASE}/api/email/history/${id}/download?format=${format}`,
  },
}
