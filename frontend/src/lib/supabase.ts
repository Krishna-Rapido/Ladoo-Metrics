import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://croniadpudboidlouhuu.supabase.co'
const supabaseAnonKey = 'sb_publishable_XVL1eAexg-C1MpKPPC-b2Q_hl2pFTpT'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper to validate email domain
export function isRapidoEmail(email: string): boolean {
  return email.toLowerCase().endsWith('@rapido.bike')
}

// Types for report folders
export type ReportFolder = {
  id: string
  name: string
  parent_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// Types for saved reports
export type SavedReport = {
  id: string
  user_id: string
  folder_id: string | null
  name: string
  items: ReportItemData[]
  created_at: string
  updated_at: string
  // Joined fields
  user_email?: string
}

export type ReportItemData = {
  id: string
  type: 'chart' | 'table' | 'text'
  title: string
  content: Record<string, unknown>
  comment: string
  timestamp: string
}

// =============================================================================
// FOLDER OPERATIONS
// =============================================================================

export async function listFolders(): Promise<ReportFolder[]> {
  const { data, error } = await supabase
    .from('report_folders')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return data || []
}

export async function createFolder(name: string, parentId: string | null = null): Promise<ReportFolder> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be logged in to create folders')

  const { data, error } = await supabase
    .from('report_folders')
    .insert({
      name,
      parent_id: parentId,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function renameFolder(folderId: string, newName: string): Promise<void> {
  const { error } = await supabase
    .from('report_folders')
    .update({ name: newName })
    .eq('id', folderId)

  if (error) throw error
}

export async function deleteFolder(folderId: string): Promise<void> {
  const { error } = await supabase
    .from('report_folders')
    .delete()
    .eq('id', folderId)

  if (error) throw error
}

// =============================================================================
// REPORT OPERATIONS (all users can view)
// =============================================================================

export async function listAllReports(): Promise<SavedReport[]> {
  const { data, error } = await supabase
    .from('saved_reports')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
      throw new Error('Database table not set up. Please run the migration SQL in your Supabase Dashboard.')
    }
    throw error
  }
  return data || []
}

export async function moveReportToFolder(reportId: string, folderId: string | null): Promise<void> {
  const { error } = await supabase
    .from('saved_reports')
    .update({ folder_id: folderId })
    .eq('id', reportId)

  if (error) throw error
}

// =============================================================================
// FUNCTION FOLDERS TYPES & OPERATIONS
// =============================================================================

export type FunctionFolder = {
  id: string
  name: string
  parent_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type FunctionParameter = {
  name: string
  type: 'string' | 'date' | 'number' | 'select'
  default: string | null
  label: string
  options?: string[]
}

export type MetricFunction = {
  id: string
  user_id: string
  folder_id: string | null
  name: string
  description: string | null
  code: string
  parameters: FunctionParameter[]
  output_columns: string[]
  is_validated: boolean
  created_at: string
  updated_at: string
  // Joined fields
  user_email?: string
}

export async function listFunctionFolders(): Promise<FunctionFolder[]> {
  const { data, error } = await supabase
    .from('function_folders')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
      throw new Error('Database table not set up. Please run the migration SQL in your Supabase Dashboard.')
    }
    throw error
  }
  return data || []
}

export async function createFunctionFolder(name: string, parentId: string | null = null): Promise<FunctionFolder> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be logged in to create folders')

  const { data, error } = await supabase
    .from('function_folders')
    .insert({
      name,
      parent_id: parentId,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function renameFunctionFolder(folderId: string, newName: string): Promise<void> {
  const { error } = await supabase
    .from('function_folders')
    .update({ name: newName })
    .eq('id', folderId)

  if (error) throw error
}

export async function deleteFunctionFolder(folderId: string): Promise<void> {
  const { error } = await supabase
    .from('function_folders')
    .delete()
    .eq('id', folderId)

  if (error) throw error
}

// =============================================================================
// METRIC FUNCTIONS OPERATIONS
// =============================================================================

export async function listAllFunctions(): Promise<MetricFunction[]> {
  const { data, error } = await supabase
    .from('metric_functions')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
      throw new Error('Database table not set up. Please run the migration SQL in your Supabase Dashboard.')
    }
    throw error
  }
  return data || []
}

export async function getFunction(functionId: string): Promise<MetricFunction | null> {
  const { data, error } = await supabase
    .from('metric_functions')
    .select('*')
    .eq('id', functionId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return data
}

export async function createFunction(
  name: string,
  description: string | null,
  code: string,
  parameters: FunctionParameter[],
  outputColumns: string[],
  folderId: string | null = null
): Promise<MetricFunction> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be logged in to create functions')

  const { data, error } = await supabase
    .from('metric_functions')
    .insert({
      user_id: user.id,
      folder_id: folderId,
      name,
      description,
      code,
      parameters,
      output_columns: outputColumns,
      is_validated: true, // Functions are validated before saving
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateFunction(
  functionId: string,
  updates: Partial<Pick<MetricFunction, 'name' | 'description' | 'code' | 'parameters' | 'output_columns' | 'folder_id'>>
): Promise<void> {
  const { error } = await supabase
    .from('metric_functions')
    .update(updates)
    .eq('id', functionId)

  if (error) throw error
}

export async function deleteFunction(functionId: string): Promise<void> {
  const { error } = await supabase
    .from('metric_functions')
    .delete()
    .eq('id', functionId)

  if (error) throw error
}

export async function moveFunctionToFolder(functionId: string, folderId: string | null): Promise<void> {
  const { error } = await supabase
    .from('metric_functions')
    .update({ folder_id: folderId })
    .eq('id', functionId)

  if (error) throw error
}
