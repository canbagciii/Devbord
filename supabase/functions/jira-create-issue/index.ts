import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface JiraConfig {
  baseUrl: string
  email: string
  token: string
}

const getJiraConfig = (): JiraConfig => {
  const baseUrl = Deno.env.get('JIRA_BASE_URL') || 'https://acerpro.atlassian.net'
  const email = Deno.env.get('JIRA_EMAIL')
  const token = Deno.env.get('JIRA_TOKEN')
  
  if (!email || !token) {
    throw new Error('JIRA_EMAIL and JIRA_TOKEN environment variables are required')
  }
  
  return { baseUrl, email, token }
}

const makeJiraRequest = async (endpoint: string, options: RequestInit = {}) => {
  const config = getJiraConfig()
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

const addIssueToSprint = async (issueId: string, sprintId: string): Promise<void> => {
  await makeJiraRequest(`/rest/agile/1.0/sprint/${sprintId}/issue`, {
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
    
    // Check environment variables first
    const jiraEmail = Deno.env.get('JIRA_EMAIL')
    const jiraToken = Deno.env.get('JIRA_TOKEN')
    const jiraBaseUrl = Deno.env.get('JIRA_BASE_URL') || 'https://acerpro.atlassian.net'
    
    console.log('🔍 Environment check:', {
      baseUrl: jiraBaseUrl,
      emailExists: !!jiraEmail,
      tokenExists: !!jiraToken,
      emailLength: jiraEmail?.length || 0,
      tokenLength: jiraToken?.length || 0
    })
    
    if (!jiraEmail || !jiraToken) {
      const missingVars = []
      if (!jiraEmail) missingVars.push('JIRA_EMAIL')
      if (!jiraToken) missingVars.push('JIRA_TOKEN')
      
      console.error('❌ Missing environment variables:', missingVars)
      return new Response(
        JSON.stringify({ 
          error: `Missing required environment variables: ${missingVars.join(', ')}`,
          details: 'Please configure JIRA_EMAIL and JIRA_TOKEN in Supabase Dashboard → Project Settings → Edge Functions',
          help: 'Go to your Supabase project settings and add the missing environment variables'
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }
    
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

    const response = await makeJiraRequest('/rest/api/3/issue', {
      method: 'POST',
      body: JSON.stringify(payload)
    })

    console.log('✅ Issue created successfully:', response)
    
    // If sprint is provided, add issue to sprint
    if (issueData.sprintId && response.key) {
      try {
        console.log(`🔄 Adding issue ${response.key} to sprint ${issueData.sprintId}`)
        await addIssueToSprint(response.id, issueData.sprintId)
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