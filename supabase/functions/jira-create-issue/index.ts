import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.52.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-company-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface JiraConfig {
  baseUrl: string
  email: string
  token: string
}

const getJiraConfig = async (companyId: string): Promise<JiraConfig> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('🔍 Fetching Jira config for company (create-issue):', companyId)

  const { data: company, error } = await supabase
    .from('companies')
    .select('jira_base_url, jira_email, jira_api_token')
    .eq('id', companyId)
    .single()

  if (error) {
    console.error('❌ Error fetching company:', error)
    throw new Error(`Failed to fetch company data: ${error.message}`)
  }

  if (!company) {
    throw new Error('Company not found')
  }

  const { jira_base_url, jira_email, jira_api_token } = company

  console.log('🔍 Jira config check (create-issue):', {
    baseUrl: jira_base_url,
    emailExists: !!jira_email,
    tokenExists: !!jira_api_token,
    emailLength: jira_email?.length || 0,
    tokenLength: jira_api_token?.length || 0
  })

  if (!jira_email || !jira_api_token) {
    const missingVars: string[] = []
    if (!jira_email) missingVars.push('jira_email')
    if (!jira_api_token) missingVars.push('jira_api_token')

    console.error('❌ Missing Jira credentials for company:', missingVars)
    throw new Error(`Missing Jira credentials for company: ${missingVars.join(', ')}`)
  }

  return {
    baseUrl: jira_base_url || 'https://acerpro.atlassian.net',
    email: jira_email,
    token: jira_api_token
  }
}

const makeJiraRequest = async (endpoint: string, config: JiraConfig, options: RequestInit = {}) => {
  const authHeader = btoa(`${config.email}:${config.token}`)
  
  const url = `${config.baseUrl}${endpoint}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Atlassian-Token': 'no-check',
      ...options.headers,
    },
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Jira API Error (${response.status}): ${errorText}`)
  }
  
  return response.json()
}

const addIssueToSprint = async (issueId: string, sprintId: string, config: JiraConfig): Promise<void> => {
  await makeJiraRequest(`/rest/agile/1.0/sprint/${sprintId}/issue`, config, {
    method: 'POST',
    body: JSON.stringify({
      issues: [issueId]
    })
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    })
  }

  try {
    console.log('🚀 Starting issue creation process...')
    
    // Get company ID from header
    const companyId = req.headers.get('x-company-id')
    if (!companyId) {
      console.error('❌ No company ID provided for issue creation')
      return new Response(
        JSON.stringify({
          error: 'Company ID required',
          details: 'Please provide x-company-id header'
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const config = await getJiraConfig(companyId)
    
    const issueData = await req.json()
    console.log('📝 Received issue data:', JSON.stringify(issueData, null, 2))
    
    // Validate required fields
    if (!issueData.projectKey || !issueData.summary) {
      console.error('❌ Missing required fields:', { projectKey: issueData.projectKey, summary: issueData.summary })
      throw new Error('Missing required fields: projectKey and summary are required')
    }
    
    const payload: any = {
      fields: {
        project: {
          key: issueData.projectKey
        },
        summary: issueData.summary,
        description: {
          type: 'doc',
          version: 1,
          content: issueData.description ? [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: issueData.description || ''
                }
              ]
            }
          ] : []
        },
        issuetype: {
          name: issueData.issueType || 'Task'
        }
      }
    }

    // Remove description if empty to avoid ADF format issues
    if (!issueData.description || issueData.description.trim() === '') {
      delete payload.fields.description
      console.log('📝 Removed empty description field')
    }

    console.log('🔍 Project key being used:', issueData.projectKey)

    // Add assignee if provided
    if (issueData.assignee) {
      // First try to find the user by display name
      try {
        console.log(`🔍 Searching for user: ${issueData.assignee}`)
        const userSearchResponse = await makeJiraRequest(`/rest/api/3/user/search?query=${encodeURIComponent(issueData.assignee)}`)
        
        if (userSearchResponse && userSearchResponse.length > 0) {
          const user = userSearchResponse.find((u: any) => 
            u.displayName.toLowerCase() === issueData.assignee.toLowerCase()
          ) || userSearchResponse[0]
          
          payload.fields.assignee = {
            accountId: user.accountId
          }
          console.log(`✅ Found user: ${user.displayName} (${user.accountId})`)
        } else {
          console.warn(`⚠️ User not found: ${issueData.assignee}, creating without assignee`)
        }
      } catch (userError) {
        console.warn(`⚠️ Could not search for user ${issueData.assignee}:`, userError)
      }
    }

    // Add time estimate if provided
    if (issueData.estimatedHours) {
  payload.fields.timetracking = {
    originalEstimate: `${issueData.estimatedHours}h`
  }
}

    console.log('🚀 Creating Jira issue with payload:', JSON.stringify(payload, null, 2))

    const response = await makeJiraRequest('/rest/api/3/issue', config, {
      method: 'POST',
      body: JSON.stringify(payload)
    })

    console.log('✅ Issue created successfully:', response)
    
    // If sprint is provided, add issue to sprint
    if (issueData.sprintId && response.key) {
      try {
        console.log(`🔄 Adding issue ${response.key} to sprint ${issueData.sprintId}`)
        await addIssueToSprint(response.id, issueData.sprintId, config)
        console.log(`Issue ${response.key} added to sprint ${issueData.sprintId}`)
      } catch (sprintError) {
        console.warn('⚠️ Issue created but could not add to sprint:', sprintError)
      }
    }

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('❌ Create issue error:', error)
    
    // Log the full error for debugging
    if (error.message && error.message.includes('400')) {
      console.error('🔍 Full 400 error details:', {
        message: error.message,
        stack: error.stack,
        toString: error.toString()
      })
    }
    
    // Provide more detailed error information
    let errorMessage = error.message || 'Internal server error'
    let statusCode = 500
    
    // Check for specific Jira API errors
    if (error.message?.includes('400')) {
      statusCode = 400
      errorMessage = `Invalid request data: ${error.message}. Please check project key, issue type, and other fields.`
    } else if (error.message?.includes('401')) {
      statusCode = 401
      errorMessage = 'Authentication failed. Please check JIRA_EMAIL and JIRA_TOKEN environment variables.'
    } else if (error.message?.includes('403')) {
      statusCode = 403
      errorMessage = 'Permission denied. Your Jira account may not have permission to create issues in this project.'
    } else if (error.message?.includes('404')) {
      statusCode = 404
      errorMessage = 'Project not found. Please check the project key.'
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.toString(),
        timestamp: new Date().toISOString(),
        help: statusCode === 401 
          ? 'Go to Supabase Dashboard → Project Settings → Edge Functions and verify JIRA_EMAIL and JIRA_TOKEN'
          : statusCode === 403
          ? 'Check if your Jira account has permission to create issues in the selected project'
          : 'Check the console logs for more details'
      }),
      {
        status: statusCode,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})