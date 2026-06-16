'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { api, APIError } from '@/lib/api'
import { FieldConfigurator, type LocalField } from '@/components/templates/FieldConfigurator'
import type { ChatMessage, Template } from '@/types'

type Status = 'loading' | 'reanalyzing' | 'ready' | 'error'

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [status, setStatus] = useState<Status>('loading')
  const [template, setTemplate] = useState<Template | null>(null)
  const [fields, setFields] = useState<LocalField[]>([])
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([])

  // Re-analyze state
  const [showReanalyze, setShowReanalyze] = useState(false)
  const [newContent, setNewContent] = useState('')

  useEffect(() => {
    api.templates.get(id)
      .then(t => {
        setTemplate(t)
        setNewContent(t.raw_content)

        const localFields: LocalField[] = t.fields.map(f => ({
          key: f.id,
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          is_required: f.is_required,
          selected: true,
          default_value: f.default_value ?? null,
          validation_rules: f.validation_rules ?? null,
        }))

        setFields(localFields)
        setInitialMessages([{
          role: 'assistant',
          content:
            localFields.length > 0
              ? `Loaded ${localFields.length} existing field${localFields.length !== 1 ? 's' : ''}. Edit them directly or ask me to help refine them.`
              : `This template has no fields yet. Ask me to suggest some, or add them manually.`,
        }])
        setStatus('ready')
      })
      .catch(err => {
        if (err instanceof APIError && err.status === 404) {
          toast.error('Template not found')
          router.push('/dashboard/templates')
        } else {
          toast.error('Failed to load template')
          setStatus('error')
        }
      })
  }, [id, router])

  const handleReanalyze = async () => {
    if (!newContent.trim()) { toast.error('Template content cannot be empty'); return }
    setStatus('reanalyzing')
    try {
      // Save the new content
      await api.templates.update(id, { raw_content: newContent.trim() })
      // Re-analyze
      const { suggested_fields } = await api.templates.analyze(newContent.trim())
      const localFields: LocalField[] = suggested_fields.map(sf => ({
        key: crypto.randomUUID(),
        field_key: sf.field_key,
        label: sf.label,
        field_type: sf.suggested_type,
        is_required: sf.is_required,
        selected: true,
        default_value: null,
        validation_rules: null,
      }))
      setFields(localFields)
      setInitialMessages([{
        role: 'assistant',
        content: `Re-analyzed the updated content and found ${localFields.length} field${localFields.length !== 1 ? 's' : ''}. Previous fields have been replaced.`,
      }])
      setShowReanalyze(false)
      setStatus('ready')
      toast.success('Content updated and re-analyzed')
    } catch {
      toast.error('Re-analysis failed')
      setStatus('ready')
    }
  }

  if (status === 'loading' || status === 'reanalyzing') {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-indigo-400 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-white">
          {status === 'reanalyzing' ? 'Re-analyzing…' : 'Loading template…'}
        </p>
      </div>
    )
  }

  if (status === 'error' || !template) return null

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 px-8 py-4 border-b border-white/8 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold text-white">{template.name}</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Edit fields for this template</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowReanalyze(v => !v)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showReanalyze ? 'Cancel' : 'Edit content & re-analyze'}
            </button>
            <button
              onClick={() => router.push('/dashboard/templates')}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Re-analyze panel */}
        {showReanalyze && (
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3">
            <p className="text-xs text-yellow-400/80">
              Editing content and re-analyzing will replace the current fields with new AI suggestions.
            </p>
            <textarea
              rows={6}
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none font-mono resize-none focus:border-indigo-500 transition-colors"
            />
            <button
              onClick={handleReanalyze}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Save & Re-analyze →
            </button>
          </div>
        )}
      </div>

      {/* Configurator */}
      <div className="flex-1 overflow-hidden p-6 flex">
        <FieldConfigurator
          templateId={id}
          initialFields={fields}
          initialMessages={initialMessages}
          onSaved={() => router.push('/dashboard/templates')}
        />
      </div>
    </div>
  )
}
