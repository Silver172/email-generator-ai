'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { api, APIError } from '@/lib/api'
import type { FieldType, ChatMessage, ValidationRules } from '@/types'

export interface LocalField {
  key: string
  field_key: string
  label: string
  field_type: FieldType
  is_required: boolean
  selected: boolean
  default_value: string | null
  validation_rules: ValidationRules | null
}

interface Props {
  templateId: string
  initialFields: LocalField[]
  initialMessages?: ChatMessage[]
  onSaved: () => void
}

const FIELD_TYPES: FieldType[] = ['text', 'email', 'number', 'date', 'phone', 'textarea', 'url']

const NUMERIC_RULES = new Set<keyof ValidationRules>(['min_length', 'max_length', 'min', 'max'])

export function FieldConfigurator({ templateId, initialFields, initialMessages = [], onSaved }: Props) {
  const [fields, setFields] = useState<LocalField[]>(initialFields)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  const selectedCount = fields.filter(f => f.selected).length

  const toApiFields = (list: LocalField[]) =>
    list.filter(f => f.selected).map((f, i) => ({
      field_key: f.field_key,
      label: f.label,
      field_type: f.field_type,
      is_required: f.is_required,
      default_value: f.default_value ?? null,
      validation_rules: f.validation_rules ?? null,
      display_order: i,
    }))

  const mergeUpdated = (
    existing: LocalField[],
    updated: Array<{
      field_key: string; label: string; field_type: FieldType; is_required: boolean;
      default_value?: string | null; validation_rules?: ValidationRules | null
    }>,
  ): LocalField[] => {
    const byKey = new Map(existing.map(f => [f.field_key, f]))
    return updated.map(f => ({
      key: byKey.get(f.field_key)?.key ?? crypto.randomUUID(),
      field_key: f.field_key,
      label: f.label,
      field_type: f.field_type,
      is_required: f.is_required,
      selected: byKey.get(f.field_key)?.selected ?? true,
      default_value: f.default_value ?? byKey.get(f.field_key)?.default_value ?? null,
      validation_rules: f.validation_rules ?? byKey.get(f.field_key)?.validation_rules ?? null,
    }))
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || chatLoading) return
    const userMsg: ChatMessage = { role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setChatLoading(true)
    try {
      const res = await api.templates.chat(templateId, text, toApiFields(fields), history)
      setMessages(h => [...h, { role: 'assistant', content: res.message }])
      if (res.updated_fields?.length) {
        setFields(prev => mergeUpdated(prev, res.updated_fields))
      }
    } catch (err) {
      if (err instanceof APIError) toast.error('Could not reach the AI. Try again.')
    } finally {
      setChatLoading(false)
    }
  }

  const handleSave = async () => {
    if (!selectedCount) { toast.error('Select at least one field'); return }
    setSaving(true)
    try {
      await api.templates.saveFields(templateId, toApiFields(fields))
      toast.success('Template saved')
      onSaved()
    } catch {
      toast.error('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const addField = () =>
    setFields(prev => [
      ...prev,
      {
        key: crypto.randomUUID(),
        field_key: `custom_field_${prev.length + 1}`,
        label: '',
        field_type: 'text',
        is_required: false,
        selected: true,
        default_value: null,
        validation_rules: null,
      },
    ])

  const update = (key: string, patch: Partial<LocalField>) =>
    setFields(prev => prev.map(f => f.key === key ? { ...f, ...patch } : f))

  const updateValidation = (key: string, ruleKey: keyof ValidationRules, rawValue: string) =>
    setFields(prev => prev.map(f => {
      if (f.key !== key) return f
      const current: ValidationRules = f.validation_rules ?? {}
      if (!rawValue.trim()) {
        const next = { ...current }
        delete next[ruleKey]
        return { ...f, validation_rules: Object.keys(next).length ? next : null }
      }
      const value = NUMERIC_RULES.has(ruleKey) ? Number(rawValue) : rawValue
      return { ...f, validation_rules: { ...current, [ruleKey]: value } }
    }))

  const remove = (key: string) => {
    setFields(prev => prev.filter(f => f.key !== key))
    if (expandedKey === key) setExpandedKey(null)
  }

  const toggleExpand = (key: string) =>
    setExpandedKey(prev => prev === key ? null : key)

  const getRuleValue = (field: LocalField, ruleKey: keyof ValidationRules): string => {
    const v = field.validation_rules?.[ruleKey]
    return v != null ? String(v) : ''
  }

  return (
    <div className="flex gap-4 min-h-0 flex-1">

      {/* ── Chat panel ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-[#111118] border border-white/8 rounded-xl overflow-hidden min-h-0">
        <div className="px-5 py-3.5 border-b border-white/8 shrink-0">
          <p className="text-sm font-medium text-white">AI Assistant</p>
          <p className="text-xs text-zinc-500 mt-0.5">Ask me to add, remove, or change fields</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {messages.length === 0 && (
            <p className="text-center text-xs text-zinc-700 pt-6">
              No messages yet — ask me anything about the fields
            </p>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-zinc-600 px-1">{msg.role === 'user' ? 'You' : 'AI'}</span>
              <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-white/5 text-zinc-300 rounded-tl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex items-start">
              <div className="bg-white/5 px-3.5 py-3 rounded-xl rounded-tl-sm flex gap-1 items-center">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-white/8 shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder="e.g. Add a field for the customer's company name"
              disabled={chatLoading}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || chatLoading}
              className="px-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Fields panel ──────────────────────────────────────── */}
      <div className="w-80 shrink-0 flex flex-col bg-[#111118] border border-white/8 rounded-xl overflow-hidden min-h-0">
        <div className="px-5 py-3.5 border-b border-white/8 shrink-0">
          <p className="text-sm font-medium text-white">Fields</p>
          <p className="text-xs text-zinc-500 mt-0.5">{selectedCount} of {fields.length} selected</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {fields.length === 0 && (
            <p className="text-center text-xs text-zinc-700 pt-6">
              No fields yet — analyze your template or add manually
            </p>
          )}

          {fields.map(field => {
            const isExpanded = expandedKey === field.key
            const showValidation = ['text', 'textarea', 'number'].includes(field.field_type)

            return (
              <div
                key={field.key}
                className={`rounded-lg border transition-all ${
                  field.selected ? 'border-white/10 bg-white/[0.03]' : 'border-white/[0.04] opacity-40'
                }`}
              >
                {/* Row 1: checkbox + label + delete */}
                <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                  <input
                    type="checkbox"
                    checked={field.selected}
                    onChange={e => update(field.key, { selected: e.target.checked })}
                    className="w-3.5 h-3.5 shrink-0 rounded border-zinc-600 accent-indigo-500 cursor-pointer"
                  />
                  <input
                    value={field.label}
                    onChange={e => update(field.key, { label: e.target.value })}
                    placeholder="Field label"
                    className="flex-1 min-w-0 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
                  />
                  <button
                    onClick={() => remove(field.key)}
                    className="shrink-0 text-zinc-700 hover:text-zinc-400 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Row 2: type + required + expand toggle */}
                <div className="flex items-center gap-2 px-3 pb-3 pl-8">
                  <select
                    value={field.field_type}
                    onChange={e => update(field.key, { field_type: e.target.value as FieldType })}
                    className="flex-1 bg-[#0d0d12] border border-white/10 rounded-md px-2 py-1 text-xs text-zinc-400 outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button
                    onClick={() => update(field.key, { is_required: !field.is_required })}
                    className={`shrink-0 text-[10px] font-medium px-2 py-1 rounded-md border transition-colors ${
                      field.is_required
                        ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
                        : 'border-white/8 text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    {field.is_required ? 'Required' : 'Optional'}
                  </button>
                  <button
                    onClick={() => toggleExpand(field.key)}
                    title="Default value & validation"
                    className={`shrink-0 p-1 rounded-md border transition-colors ${
                      isExpanded
                        ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
                        : 'border-white/8 text-zinc-700 hover:text-zinc-400'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                    </svg>
                  </button>
                </div>

                {/* Expanded: default value + validation */}
                {isExpanded && (
                  <div className="border-t border-white/8 px-3 py-3 space-y-2.5">

                    {/* Default value */}
                    <div className="flex items-center gap-2">
                      <label className="shrink-0 text-[10px] text-zinc-600 w-20">Default</label>
                      <input
                        type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                        placeholder="No default"
                        value={field.default_value ?? ''}
                        onChange={e => update(field.key, { default_value: e.target.value || null })}
                        className="flex-1 bg-[#0d0d12] border border-white/10 rounded-md px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    {/* text / textarea validation */}
                    {(field.field_type === 'text' || field.field_type === 'textarea') && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className="shrink-0 text-[10px] text-zinc-600 w-20">Min length</label>
                          <input
                            type="number" min={0} placeholder="—"
                            value={getRuleValue(field, 'min_length')}
                            onChange={e => updateValidation(field.key, 'min_length', e.target.value)}
                            className="w-16 bg-[#0d0d12] border border-white/10 rounded-md px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-indigo-500 transition-colors"
                          />
                          <label className="shrink-0 text-[10px] text-zinc-600">Max length</label>
                          <input
                            type="number" min={0} placeholder="—"
                            value={getRuleValue(field, 'max_length')}
                            onChange={e => updateValidation(field.key, 'max_length', e.target.value)}
                            className="flex-1 bg-[#0d0d12] border border-white/10 rounded-md px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-indigo-500 transition-colors"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="shrink-0 text-[10px] text-zinc-600 w-20">Pattern</label>
                          <input
                            type="text" placeholder="Regex, e.g. ^[A-Z]"
                            value={getRuleValue(field, 'pattern')}
                            onChange={e => updateValidation(field.key, 'pattern', e.target.value)}
                            className="flex-1 bg-[#0d0d12] border border-white/10 rounded-md px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-indigo-500 font-mono transition-colors"
                          />
                        </div>
                      </>
                    )}

                    {/* number validation */}
                    {field.field_type === 'number' && (
                      <div className="flex items-center gap-2">
                        <label className="shrink-0 text-[10px] text-zinc-600 w-20">Min value</label>
                        <input
                          type="number" placeholder="—"
                          value={getRuleValue(field, 'min')}
                          onChange={e => updateValidation(field.key, 'min', e.target.value)}
                          className="w-16 bg-[#0d0d12] border border-white/10 rounded-md px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-indigo-500 transition-colors"
                        />
                        <label className="shrink-0 text-[10px] text-zinc-600">Max value</label>
                        <input
                          type="number" placeholder="—"
                          value={getRuleValue(field, 'max')}
                          onChange={e => updateValidation(field.key, 'max', e.target.value)}
                          className="flex-1 bg-[#0d0d12] border border-white/10 rounded-md px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    )}

                    {!showValidation && (
                      <p className="text-[10px] text-zinc-700 italic">No validation rules for this field type</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="p-3 border-t border-white/8 space-y-2 shrink-0">
          <button
            onClick={addField}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-white/10 text-xs text-zinc-600 hover:text-zinc-400 hover:border-white/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add field manually
          </button>
          <button
            onClick={handleSave}
            disabled={selectedCount === 0 || saving}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : `Save Template (${selectedCount} field${selectedCount !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </div>
  )
}
