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

// Types for saved reports (items optional when listing; full when loading one report)
export type SavedReport = {
  id: string
  user_id: string
  folder_id: string | null
  name: string
  items?: ReportItemData[]
  created_at: string
  updated_at: string
  // Joined fields
  user_email?: string
}

export type ReportItemData = {
  id: string
  type: 'chart' | 'table' | 'text' | 'dashboard_snapshot'
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
  // Select only list-needed columns; omit heavy `items` JSONB for fast list load
  const { data, error } = await supabase
    .from('saved_reports')
    .select('id, user_id, folder_id, name, created_at, updated_at')
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

// =============================================================================
// CALCULATED COLUMNS TYPES & OPERATIONS
// =============================================================================

export type CalculatedColumn = {
  id: string
  user_id: string
  folder_id: string | null
  name: string
  description: string | null
  expression: string
  output_column: string
  input_columns: string[]
  is_validated: boolean
  created_at: string
  updated_at: string
  // Joined fields
  user_email?: string
}

export async function listAllCalculatedColumns(): Promise<CalculatedColumn[]> {
  const { data, error } = await supabase
    .from('calculated_columns')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
      // Table doesn't exist yet - return empty array instead of throwing
      // User can still create calculated columns, they just won't be saved to Supabase
      console.warn('calculated_columns table not found. Run migration SQL to enable saving calculated columns.')
      return []
    }
    throw error
  }
  return data || []
}

export async function getCalculatedColumn(columnId: string): Promise<CalculatedColumn | null> {
  const { data, error } = await supabase
    .from('calculated_columns')
    .select('*')
    .eq('id', columnId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return data
}

export async function createCalculatedColumn(
  name: string,
  description: string | null,
  expression: string,
  outputColumn: string,
  inputColumns: string[],
  folderId: string | null = null
): Promise<CalculatedColumn> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be logged in to create calculated columns')

  const { data, error } = await supabase
    .from('calculated_columns')
    .insert({
      user_id: user.id,
      folder_id: folderId,
      name,
      description,
      expression,
      output_column: outputColumn,
      input_columns: inputColumns,
      is_validated: true, // Columns are validated before saving
    })
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
      throw new Error('Database table not set up. Please run the migration SQL in your Supabase Dashboard to save calculated columns.')
    }
    throw error
  }
  return data
}

export async function updateCalculatedColumn(
  columnId: string,
  updates: Partial<Pick<CalculatedColumn, 'name' | 'description' | 'expression' | 'output_column' | 'input_columns' | 'folder_id'>>
): Promise<void> {
  const { error } = await supabase
    .from('calculated_columns')
    .update(updates)
    .eq('id', columnId)

  if (error) throw error
}

export async function deleteCalculatedColumn(columnId: string): Promise<void> {
  const { error } = await supabase
    .from('calculated_columns')
    .delete()
    .eq('id', columnId)

  if (error) throw error
}

export async function moveCalculatedColumnToFolder(columnId: string, folderId: string | null): Promise<void> {
  const { error } = await supabase
    .from('calculated_columns')
    .update({ folder_id: folderId })
    .eq('id', columnId)

  if (error) throw error
}

// =============================================================================
// CUSTOM DASHBOARDS TYPES & OPERATIONS
// =============================================================================

export type DashboardParameter = {
  name: string
  type: 'string' | 'date' | 'number' | 'select' | 'multiselect'
  default: string | null
  label: string
  options?: string[]
  optional?: boolean
}

export type GlobalParameterOption = {
  param_key: string
  display_label: string
  options: string[]
}

export async function getGlobalParameterOptions(): Promise<GlobalParameterOption[]> {
  const { data, error } = await supabase
    .from('global_parameter_options')
    .select('param_key, display_label, options')

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
      console.warn('global_parameter_options table not found. Run supabase_multiselect_migration.sql.')
      return []
    }
    throw error
  }
  return data || []
}

export type ChartConfig = {
  id: string
  title: string
  chartType: 'line' | 'bar' | 'area' | 'scatter'
  xAxis: string
  yAxes: string[]
  seriesColumns: string[]
  aggregation: 'sum' | 'mean' | 'count' | 'unique_count' | 'median' | 'p25' | 'p75' | 'p90'
}

export type CustomDashboard = {
  id: string
  user_id: string
  name: string
  slug: string
  folder: string
  description: string | null
  sql_query: string
  parameters: DashboardParameter[]
  chart_configs?: ChartConfig[]
  created_at: string
  updated_at: string
}

export async function listAllCustomDashboards(): Promise<CustomDashboard[]> {
  const { data, error } = await supabase
    .from('custom_dashboards')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
      console.warn('custom_dashboards table not found. Run supabase_custom_dashboards_migration.sql.')
      return []
    }
    throw error
  }
  return data || []
}

export async function getCustomDashboardBySlug(folder: string, slug: string): Promise<CustomDashboard | null> {
  const { data, error } = await supabase
    .from('custom_dashboards')
    .select('*')
    .eq('folder', folder)
    .eq('slug', slug)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) return null
    throw error
  }
  return data
}

export async function createCustomDashboard(
  name: string,
  slug: string,
  folder: string,
  sqlQuery: string = '',
  parameters: DashboardParameter[] = [],
  description: string | null = null
): Promise<CustomDashboard> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be logged in to create dashboards')

  const { data, error } = await supabase
    .from('custom_dashboards')
    .insert({
      user_id: user.id,
      name,
      slug,
      folder,
      description,
      sql_query: sqlQuery,
      parameters,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCustomDashboard(
  dashboardId: string,
  updates: Partial<Pick<CustomDashboard, 'name' | 'description' | 'sql_query' | 'parameters' | 'chart_configs'>>
): Promise<void> {
  const { error } = await supabase
    .from('custom_dashboards')
    .update(updates)
    .eq('id', dashboardId)

  if (error) throw error
}

export async function deleteCustomDashboard(dashboardId: string): Promise<void> {
  const { error } = await supabase
    .from('custom_dashboards')
    .delete()
    .eq('id', dashboardId)

  if (error) throw error
}

// =============================================================================
// RESEARCHER CHAT OPERATIONS
// =============================================================================

export type ResearcherChat = {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export type ResearcherChatMessage = {
  id: string
  chat_id: string
  role: 'user' | 'assistant'
  blocks: unknown[]
  sequence_num: number
  created_at: string
}

export type ResearcherRuleRow = {
  id: string
  user_id: string
  chat_id: string | null
  type: 'table' | 'filter' | 'analysis' | 'custom'
  content: string
  created_at: string
  updated_at: string
}

export async function listResearcherChats(): Promise<ResearcherChat[]> {
  const { data, error } = await supabase
    .from('researcher_chats')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
      console.warn('researcher_chats table not found. Run supabase_researcher_chat_migration.sql.')
      return []
    }
    throw error
  }
  return data || []
}

export async function createResearcherChat(title: string): Promise<ResearcherChat> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be logged in')

  const { data, error } = await supabase
    .from('researcher_chats')
    .insert({ user_id: user.id, title })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateResearcherChatTitle(chatId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('researcher_chats')
    .update({ title })
    .eq('id', chatId)

  if (error) throw error
}

export async function deleteResearcherChat(chatId: string): Promise<void> {
  const { error } = await supabase
    .from('researcher_chats')
    .delete()
    .eq('id', chatId)

  if (error) throw error
}

export async function loadChatMessages(chatId: string): Promise<ResearcherChatMessage[]> {
  const { data, error } = await supabase
    .from('researcher_chat_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('sequence_num', { ascending: true })

  if (error) throw error
  return data || []
}

export async function saveChatMessage(
  chatId: string,
  role: 'user' | 'assistant',
  blocks: unknown[],
  sequenceNum: number
): Promise<ResearcherChatMessage> {
  const { data, error } = await supabase
    .from('researcher_chat_messages')
    .insert({
      chat_id: chatId,
      role,
      blocks,
      sequence_num: sequenceNum,
    })
    .select()
    .single()

  if (error) throw error

  // Touch the chat's updated_at
  await supabase
    .from('researcher_chats')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', chatId)

  return data
}

// =============================================================================
// RESEARCHER RULES OPERATIONS
// =============================================================================

export async function listResearcherRules(chatId?: string): Promise<ResearcherRuleRow[]> {
  let query = supabase
    .from('researcher_rules')
    .select('*')
    .order('created_at', { ascending: true })

  if (chatId) {
    // Global rules (chat_id is null) + chat-scoped rules
    query = query.or(`chat_id.is.null,chat_id.eq.${chatId}`)
  } else {
    // Global rules only
    query = query.is('chat_id', null)
  }

  const { data, error } = await query
  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
      console.warn('researcher_rules table not found. Run supabase_researcher_chat_migration.sql.')
      return []
    }
    throw error
  }
  return data || []
}

export async function createResearcherRule(
  type: string,
  content: string,
  chatId: string | null = null
): Promise<ResearcherRuleRow> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be logged in')

  const { data, error } = await supabase
    .from('researcher_rules')
    .insert({
      user_id: user.id,
      chat_id: chatId,
      type,
      content,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateResearcherRule(
  ruleId: string,
  updates: Partial<Pick<ResearcherRuleRow, 'content' | 'type'>>
): Promise<void> {
  const { error } = await supabase
    .from('researcher_rules')
    .update(updates)
    .eq('id', ruleId)

  if (error) throw error
}

export async function deleteResearcherRule(ruleId: string): Promise<void> {
  const { error } = await supabase
    .from('researcher_rules')
    .delete()
    .eq('id', ruleId)

  if (error) throw error
}
