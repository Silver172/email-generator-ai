'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { api, APIError } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FieldConfigurator, type LocalField } from '@/components/templates/FieldConfigurator'
import type { ChatMessage } from '@/types'

type Phase = 'setup' | 'analyzing' | 'configuring'

export default function NewTemplatePage() {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('setup')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rawContent, setRawContent] = useState('')
  const [nameError, setNameError] = useState('')
  const [contentError, setContentError] = useState('')

  const [fields, setFields] = useState<LocalField[]>([])
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([])
  const [showPreview, setShowPreview] = useState(false)

  const handleAnalyze = async () => {
    let valid = true
    if (!name.trim()) { setNameError('Template name is required'); valid = false }
    else setNameError('')
    if (!rawContent.trim()) { setContentError('Paste your email template content'); valid = false }
    else setContentError('')
    if (!valid) return

    setPhase('analyzing')

    try {
      // Analyze only — template is NOT created in DB yet
      const { suggested_fields } = await api.templates.analyze(rawContent.trim())

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

      const aiGreeting: ChatMessage = {
        role: 'assistant',
        content:
          localFields.length > 0
            ? `I found ${localFields.length} editable field${localFields.length !== 1 ? 's' : ''} in your template. Review them on the right — check the ones you want, adjust types, and toggle required/optional. Ask me to add or change anything.`
            : `I didn't find any obvious editable fields. Use the chat or the "Add field manually" button on the right to define the fields you need.`,
      }

      setFields(localFields)
      setInitialMessages([aiGreeting])
      setPhase('configuring')
    } catch (err) {
      setPhase('setup')
      if (err instanceof APIError) {
        toast.error(err.message ?? 'Failed to analyze template')
      }
    }
  }

  // Called by FieldConfigurator when the user clicks "Save Template"
  const handleCreate = async (): Promise<string> => {
    const template = await api.templates.create({
      name: name.trim(),
      description: description.trim() || undefined,
      raw_content: rawContent.trim(),
    })
    return template.id
  }

  if (phase === 'analyzing') {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-indigo-400 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-white">Analyzing your template…</p>
          <p className="text-xs text-zinc-500 mt-1">The AI is identifying editable fields</p>
        </div>
      </div>
    )
  }

  if (phase === 'configuring') {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Top bar */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-8 py-4 border-b border-white/8">
          <div>
            <h1 className="text-sm font-semibold text-white">{name}</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Configure editable fields for this template</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Template preview toggle */}
            <button
              onClick={() => setShowPreview(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showPreview
                  ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
                  : 'border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {showPreview ? 'Hide template' : 'Preview template'}
            </button>
            <button
              onClick={() => router.push('/dashboard/templates')}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Main area: configurator + optional template preview */}
        <div className="flex-1 min-h-0 overflow-hidden flex">
          <div className="flex-1 overflow-hidden p-6 flex min-h-0">
            <FieldConfigurator
              rawContent={rawContent}
              onCreate={handleCreate}
              initialFields={fields}
              initialMessages={initialMessages}
              onSaved={() => router.push('/dashboard/templates')}
            />
          </div>

          {/* Template preview panel */}
          {showPreview && (
            <div className="w-[300px] shrink-0 border-l border-white/8 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8 shrink-0 flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-400">Template content</p>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-zinc-700 hover:text-zinc-400 transition-colors"
                  aria-label="Close preview"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <pre className="text-xs text-zinc-500 whitespace-pre-wrap font-mono leading-relaxed">
                  {rawContent}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Setup phase ────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-2xl">
      {/* Back */}
      <button
        onClick={() => router.push('/dashboard/templates')}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Templates
      </button>

      <div className="mb-7">
        <h1 className="text-lg font-semibold text-white">New Template</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Paste your email template and we'll identify the fields you can personalise
        </p>
      </div>

      <div className="space-y-5">
        <Input
          id="name"
          label="Template name"
          placeholder="e.g. Sales Outreach, Welcome Email"
          value={name}
          onChange={e => setName(e.target.value)}
          error={nameError}
        />

        <Input
          id="description"
          label="Description"
          placeholder="Optional short description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          hint="Helps you identify the template later"
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-zinc-300">
            Email content
          </label>
          <p className="text-xs text-zinc-600">
            Paste your full email template below. Use placeholders like{' '}
            <code className="text-zinc-500 bg-white/5 px-1 rounded">{'{{name}}'}</code>{' '}
            or just write the email — the AI will find the dynamic parts.
          </p>
          <textarea
            id="rawContent"
            rows={14}
            placeholder={`Subject: Following up on our conversation

Hi {{recipient_name}},

I wanted to follow up on our meeting about {{product_name}}...

Best regards,
{{sender_name}}`}
            value={rawContent}
            onChange={e => setRawContent(e.target.value)}
            className={`w-full rounded-lg border bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors font-mono resize-none ${
              contentError
                ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                : 'border-white/10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10'
            }`}
          />
          {contentError && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 10.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm.75-3.75a.75.75 0 0 1-1.5 0V5.75a.75.75 0 0 1 1.5 0v2z" />
              </svg>
              {contentError}
            </p>
          )}
        </div>

        <div className="pt-2">
          <Button variant="primary" size="lg" onClick={handleAnalyze}>
            Analyze with AI →
          </Button>
        </div>
      </div>
    </div>
  )
}
