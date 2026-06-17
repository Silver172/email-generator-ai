'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { api, APIError } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'
import { formatDateTime } from '@/lib/utils'
import type { FieldType, GeneratedEmail, Template, TemplateListItem, ValidationRules } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateValue(
  value: string,
  type: FieldType,
  required: boolean,
  label: string,
  rules: ValidationRules | null,
): string {
  const v = value.trim()
  if (!v) return required ? `${label} is required` : ''

  switch (type) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter a valid email address'
    case 'url':
      try { new URL(v); return '' } catch { return 'Enter a valid URL (include https://)' }
    case 'number': {
      const n = Number(v)
      if (isNaN(n)) return 'Enter a valid number'
      if (rules?.min != null && n < rules.min) return `Minimum value is ${rules.min}`
      if (rules?.max != null && n > rules.max) return `Maximum value is ${rules.max}`
      return ''
    }
    case 'text':
    case 'textarea':
      if (rules?.min_length && v.length < rules.min_length) return `At least ${rules.min_length} characters`
      if (rules?.max_length && v.length > rules.max_length) return `At most ${rules.max_length} characters`
      return ''
    default:
      return ''
  }
}

async function triggerDownload(id: string, format: 'html' | 'eml' | 'pdf') {
  const token = getAccessToken()
  const url = api.email.downloadUrl(id, format)
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = `email_${id.slice(0, 8)}.${format}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}

function downloadBlob(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType })
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}

const ERROR_MSGS: Record<string, string> = {
  llm_rate_limit: 'AI rate limit reached — please wait a moment and try again.',
  llm_not_configured: 'LLM API key not configured in .env',
  validation_error: 'Check your field values and try again',
}

// ── Inner component (uses useSearchParams) ────────────────────────────────────

function GenerateContent() {
  const searchParams = useSearchParams()
  const preselected = searchParams.get('template') ?? ''

  const [templates, setTemplates] = useState<TemplateListItem[]>([])
  const [templateId, setTemplateId] = useState(preselected)
  const [template, setTemplate] = useState<Template | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<GeneratedEmail | null>(null)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState<'html' | 'eml' | 'pdf' | null>(null)

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [editedContent, setEditedContent] = useState<string | null>(null)

  const displayContent = editedContent ?? result?.generated_content ?? ''

  useEffect(() => {
    api.templates.list()
      .then(setTemplates)
      .catch(() => toast.error('Failed to load templates'))
  }, [])

  useEffect(() => {
    if (!templateId) { setTemplate(null); setValues({}); setErrors({}); setResult(null); return }
    setTemplateLoading(true)
    api.templates.get(templateId)
      .then(t => {
        setTemplate(t)
        const defaults: Record<string, string> = {}
        for (const f of t.fields) {
          if (f.default_value) defaults[f.field_key] = f.default_value
        }
        setValues(defaults)
        setErrors({})
        setResult(null)
      })
      .catch(() => toast.error('Failed to load template'))
      .finally(() => setTemplateLoading(false))
  }, [templateId])

  const updateValue = (key: string, val: string) => {
    setValues(p => ({ ...p, [key]: val }))
    setErrors(p => ({ ...p, [key]: '' }))
  }

  const validate = (): boolean => {
    if (!template) return false
    const errs: Record<string, string> = {}
    for (const f of template.fields) {
      const effective = (values[f.field_key] ?? f.default_value ?? '').trim()
      const e = validateValue(effective, f.field_type, f.is_required, f.label, f.validation_rules)
      if (e) errs[f.field_key] = e
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleGenerate = async () => {
    if (!template || !validate()) return
    setGenerating(true)
    setResult(null)
    setEditing(false)
    setEditedContent(null)
    try {
      const fieldValues = Object.fromEntries(
        template.fields.map(f => [f.field_key, values[f.field_key] ?? f.default_value ?? ''])
      )
      const email = await api.email.generate(template.id, fieldValues)
      setResult(email)
    } catch (err) {
      if (err instanceof APIError) {
        toast.error(ERROR_MSGS[err.data?.detail as string] ?? 'Failed to generate email')
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleEditToggle = () => {
    if (!editing) {
      setEditedContent(result?.generated_content ?? '')
    }
    setEditing(v => !v)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard')
  }

  const handleDownload = async (format: 'html' | 'eml' | 'pdf') => {
    if (!result) return

    // If the user edited the content, serve HTML and EML from the edited text locally
    if (editedContent !== null) {
      const slug = result.id.slice(0, 8)
      if (format === 'html') {
        const safe = editedContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><pre style="font-family:sans-serif;font-size:14px;white-space:pre-wrap;line-height:1.6">${safe}</pre></body></html>`
        downloadBlob(html, 'text/html', `email_${slug}_edited.html`)
        return
      }
      if (format === 'eml') {
        const eml = `MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${editedContent}`
        downloadBlob(eml, 'message/rfc822', `email_${slug}_edited.eml`)
        return
      }
      // PDF — generated server-side from original content
      toast.info('PDF is generated from the original AI content. Copy your edits to use them.')
    }

    setDownloading(format)
    try { await triggerDownload(result.id, format) }
    catch { toast.error('Download failed') }
    finally { setDownloading(null) }
  }

  const inputCls = (key: string) =>
    `w-full rounded-lg border bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors ${
      errors[key]
        ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
        : 'border-white/10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10'
    }`

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Left: form ─────────────────────────────────────────── */}
      <div className="w-[360px] shrink-0 border-r border-white/8 overflow-y-auto flex flex-col">
        <div className="p-7 space-y-6">
          <div>
            <h1 className="text-lg font-semibold text-white">Generate Email</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Select a template and fill in the fields</p>
          </div>

          {/* Template selector */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-300">Template</label>
            {templates.length === 0 ? (
              <p className="text-xs text-zinc-600 py-1">
                No templates yet.{' '}
                <a href="/dashboard/templates/new" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                  Create one →
                </a>
              </p>
            ) : (
              <select
                value={templateId}
                onChange={e => setTemplateId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                <option value="" className="bg-[#111118]">Select a template…</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id} className="bg-[#111118]">{t.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Loading skeleton */}
          {templateLoading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          )}

          {/* Dynamic form */}
          {!templateLoading && template && (
            <div className="space-y-4">
              {template.fields.length === 0 ? (
                <div className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
                  <p className="text-xs text-zinc-500">This template has no configurable fields.</p>
                </div>
              ) : (
                template.fields.map(field => (
                  <div key={field.field_key} className="space-y-1.5">
                    <label htmlFor={field.field_key} className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                      {field.label}
                      {field.default_value
                        ? <span className="text-[10px] text-zinc-600 font-normal">has default</span>
                        : field.is_required
                          ? <span className="text-red-400 text-xs leading-none">*</span>
                          : <span className="text-[10px] text-zinc-600 font-normal">optional</span>}
                    </label>
                    {field.field_type === 'textarea' ? (
                      <textarea
                        id={field.field_key}
                        rows={3}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        value={values[field.field_key] ?? ''}
                        onChange={e => updateValue(field.field_key, e.target.value)}
                        className={`${inputCls(field.field_key)} resize-none`}
                      />
                    ) : (
                      <input
                        id={field.field_key}
                        type={field.field_type === 'phone' ? 'tel' : field.field_type}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        value={values[field.field_key] ?? ''}
                        onChange={e => updateValue(field.field_key, e.target.value)}
                        className={inputCls(field.field_key)}
                      />
                    )}
                    {errors[field.field_key] && (
                      <p className="flex items-center gap-1.5 text-xs text-red-400">
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 10.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm.75-3.75a.75.75 0 0 1-1.5 0V5.75a.75.75 0 0 1 1.5 0v2z" />
                        </svg>
                        {errors[field.field_key]}
                      </p>
                    )}
                  </div>
                ))
              )}

              <div className="pt-2">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {generating ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Generating…
                    </>
                  ) : 'Generate Email →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: preview ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {!result && !generating ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Your email will appear here</p>
              <p className="text-xs text-zinc-600 mt-1">Select a template, fill in the fields, and click Generate</p>
            </div>
          </div>
        ) : generating ? (
          /* Generating spinner */
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-400 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-sm text-zinc-500">Generating your email…</p>
          </div>
        ) : result ? (
          <>
            {/* Action bar */}
            <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-white/8">
              <div>
                <p className="text-sm font-medium text-white">Generated Email</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {editing
                    ? <span className="text-amber-400/80">Editing — changes are local only</span>
                    : formatDateTime(result.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">

                {/* Edit toggle */}
                <button
                  onClick={handleEditToggle}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    editing
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15'
                      : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {editing ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Done
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                      </svg>
                      Edit
                    </>
                  )}
                </button>

                {/* Copy */}
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-zinc-300 hover:bg-white/10 transition-colors"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>

                {/* Downloads */}
                {(['html', 'eml', 'pdf'] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => handleDownload(fmt)}
                    disabled={!!downloading}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-colors uppercase disabled:opacity-40"
                  >
                    {downloading === fmt ? (
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    )}
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Email content — view or edit */}
            {editing ? (
              <textarea
                value={editedContent ?? ''}
                onChange={e => setEditedContent(e.target.value)}
                spellCheck
                className="flex-1 w-full px-7 py-6 bg-transparent text-sm text-zinc-200 font-sans leading-relaxed resize-none outline-none border-none focus:ring-0"
                style={{ minHeight: 0 }}
              />
            ) : (
              <div className="flex-1 overflow-y-auto p-7">
                <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {displayContent}
                </pre>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}

// ── Page (wraps with Suspense for useSearchParams) ────────────────────────────

export default function GeneratePage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    }>
      <GenerateContent />
    </Suspense>
  )
}
