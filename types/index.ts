export interface User {
  id: string
  email: string
  full_name: string
  provider: 'local' | 'google'
  is_active: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export interface Template {
  id: string
  name: string
  description: string | null
  raw_content: string
  fields: TemplateField[]
  created_at: string
  updated_at: string
}

export interface TemplateListItem {
  id: string
  name: string
  description: string | null
  field_count: number
  created_at: string
  updated_at: string
}

export interface TemplateField {
  id: string
  template_id: string
  field_key: string
  label: string
  field_type: FieldType
  is_required: boolean
  default_value: string | null
  validation_rules: ValidationRules | null
  display_order: number
}

export type FieldType = 'text' | 'email' | 'number' | 'date' | 'phone' | 'textarea' | 'url'

export interface ValidationRules {
  min_length?: number
  max_length?: number
  pattern?: string
  min?: number
  max?: number
}

export interface GeneratedEmail {
  id: string
  template_id: string | null
  template_name: string | null
  field_values: Record<string, unknown>
  generated_content: string
  created_at: string
}

export interface GeneratedEmailListItem {
  id: string
  template_id: string | null
  template_name: string | null
  preview: string
  created_at: string
}

export interface SuggestedField {
  field_key: string
  label: string
  suggested_type: FieldType
  is_required: boolean
  reason: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
