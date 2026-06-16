'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { api, APIError } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import type { TemplateListItem } from '@/types'

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  useEffect(() => {
    api.templates.list()
      .then(setTemplates)
      .catch(() => toast.error('Failed to load templates'))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await api.templates.delete(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
      toast.success('Template deleted')
    } catch (err) {
      if (err instanceof APIError) toast.error('Failed to delete template')
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <PageHeader
        title="Templates"
        description="Create and manage your email templates"
        action={
          <Button variant="primary" size="sm" onClick={() => router.push('/dashboard/templates/new')}>
            + New Template
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-44 rounded-xl bg-white/[0.03] border border-white/8 animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-white/8 bg-white/[0.02]">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </div>
          <p className="text-sm text-zinc-400 font-medium">No templates yet</p>
          <p className="text-xs text-zinc-600 mt-1 mb-4">Create your first template to get started</p>
          <Button variant="primary" size="sm" onClick={() => router.push('/dashboard/templates/new')}>
            + New Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div
              key={t.id}
              className="flex flex-col bg-[#111118] border border-white/8 rounded-xl p-5 hover:border-white/[0.14] transition-colors"
            >
              {/* Header */}
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-white leading-snug">{t.name}</h3>
                  <span className="shrink-0 text-[10px] font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-md px-2 py-0.5">
                    {t.field_count} field{t.field_count !== 1 ? 's' : ''}
                  </span>
                </div>
                {t.description && (
                  <p className="text-xs text-zinc-500 line-clamp-2 mb-2">{t.description}</p>
                )}
                <p className="text-[11px] text-zinc-700">{formatDate(t.created_at)}</p>
              </div>

              {/* Actions */}
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                {confirmId === t.id ? (
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-xs text-zinc-500">Delete this template?</p>
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deletingId === t.id}
                      className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                      {deletingId === t.id ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/generate?template=${t.id}`}
                      className="flex-1 text-center py-1.5 text-xs font-medium text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                    >
                      Generate
                    </Link>
                    <Link
                      href={`/dashboard/templates/${t.id}/edit`}
                      className="px-3 py-1.5 text-xs font-medium text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => setConfirmId(t.id)}
                      className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
