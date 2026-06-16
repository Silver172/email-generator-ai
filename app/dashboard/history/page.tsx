'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { GeneratedEmail, GeneratedEmailListItem } from '@/types'

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

export default function HistoryPage() {
  const [history, setHistory] = useState<GeneratedEmailListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<GeneratedEmail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [downloading, setDownloading] = useState<'html' | 'eml' | 'pdf' | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.email.history({ limit: 100 })
      .then(setHistory)
      .catch(() => toast.error('Failed to load history'))
      .finally(() => setLoading(false))
  }, [])

  const selectEmail = async (id: string) => {
    if (selectedId === id) return
    setSelectedId(id)
    setSelected(null)
    setCopied(false)
    setDetailLoading(true)
    try {
      const email = await api.email.get(id)
      setSelected(email)
    } catch {
      toast.error('Failed to load email')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDownload = async (format: 'html' | 'eml' | 'pdf') => {
    if (!selected) return
    setDownloading(format)
    try { await triggerDownload(selected.id, format) }
    catch { toast.error('Download failed') }
    finally { setDownloading(null) }
  }

  const handleCopy = async () => {
    if (!selected) return
    await navigator.clipboard.writeText(selected.generated_content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden flex-col">

      {/* Page header */}
      <div className="shrink-0 px-8 py-5 border-b border-white/8">
        <h1 className="text-lg font-semibold text-white">Email History</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {loading ? 'Loading…' : `${history.length} generated email${history.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left: list ──────────────────────────────────────── */}
        <div className="w-72 shrink-0 border-r border-white/8 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 gap-3 text-center">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-zinc-400 font-medium">No history yet</p>
                <p className="text-xs text-zinc-600 mt-1">Generated emails will appear here</p>
              </div>
            </div>
          ) : (
            <div className="p-2">
              {history.map(item => (
                <button
                  key={item.id}
                  onClick={() => selectEmail(item.id)}
                  className={`w-full text-left px-3 py-3 rounded-lg mb-1 transition-colors border ${
                    selectedId === item.id
                      ? 'bg-indigo-500/10 border-indigo-500/20'
                      : 'hover:bg-white/5 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    {item.template_name ? (
                      <p className="text-xs font-medium text-zinc-200 truncate">{item.template_name}</p>
                    ) : (
                      <p className="text-xs font-medium text-zinc-600 italic truncate">Deleted template</p>
                    )}
                    <p className="shrink-0 text-[10px] text-zinc-600">{formatDate(item.created_at)}</p>
                  </div>
                  <p className="text-[11px] text-zinc-600 line-clamp-2 leading-relaxed text-left">{item.preview}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: detail ───────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-white/[0.03] flex items-center justify-center">
                <svg className="w-6 h-6 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-zinc-600">Select an email from the list to view it</p>
            </div>
          ) : detailLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : selected ? (
            <>
              {/* Detail header */}
              <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-white/8">
                <div>
                  <p className="text-sm font-medium text-white">
                    {selected.template_name ?? <span className="text-zinc-500 italic font-normal">Deleted template</span>}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">{formatDateTime(selected.created_at)}</p>
                </div>

                <div className="flex items-center gap-2">
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

              {/* Email content */}
              <div className="flex-1 overflow-y-auto p-7">
                <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {selected.generated_content}
                </pre>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
