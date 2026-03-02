import { createClient } from 'npm:@supabase/supabase-js@2.52.0'

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

  console.log('🔍 Fetching Jira config for company:', companyId)

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

  console.log('🔍 Jira config check:', {
    baseUrl: jira_base_url,
    emailExists: !!jira_email,
    tokenExists: !!jira_api_token,
    emailLength: jira_email?.length || 0,
    tokenLength: jira_api_token?.length || 0
  })

  if (!jira_email || !jira_api_token) {
    const missingVars = []
    if (!jira_email) missingVars.push('jira_email')
    if (!jira_api_token) missingVars.push('jira_api_token')

    console.error('❌ Missing Jira credentials:', missingVars)
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
  
  const finalUrl = `${config.baseUrl}${endpoint}`
  console.log(`🌐 Request: ${options.method || 'GET'} ${finalUrl}`)
  
  try {
    const response = await fetch(finalUrl, {
      ...options,
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Atlassian-Token': 'no-check',
        ...options.headers,
      },
    })
    
    console.log(`📡 Response: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Jira API Error: ${response.status} - ${errorText}`)
      
      // Provide more specific error messages
      if (response.status === 401) {
        throw new Error(`Jira Authentication Failed (401): Please check your JIRA_EMAIL and JIRA_TOKEN credentials. Error: ${errorText}`)
      } else if (response.status === 403) {
        throw new Error(`Jira Access Forbidden (403): Your account may not have permission to access this resource. Error: ${errorText}`)
      } else if (response.status === 404) {
        throw new Error(`Jira Resource Not Found (404): The requested endpoint may not exist. Error: ${errorText}`)
      } else if (response.status === 410) {
        throw new Error(`Jira API Endpoint Deprecated (410): This endpoint is no longer available. Error: ${errorText}`)
      } else {
        throw new Error(`Jira API Error (${response.status}): ${errorText}`)
      }
    }
    
    const data = await response.json()
    console.log('✅ Request successful')
    return data
  } catch (error) {
    console.error('🚨 Request failed:', error)
    throw error
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`🚀 Received ${req.method} request to jira-proxy`)

    // Get company ID from header
    const companyId = req.headers.get('x-company-id')
    if (!companyId) {
      console.error('❌ No company ID provided')
      return new Response(
        JSON.stringify({
          error: 'Company ID required',
          details: 'Please provide x-company-id header'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('🏢 Company ID:', companyId)

    // Parse request body
    let requestBody: any = null
    const bodyText = await req.text()
    console.log('📝 Request body length:', bodyText.length)
    
    if (bodyText) {
      try {
        requestBody = JSON.parse(bodyText)
        console.log('📝 Parsed request:', {
          endpoint: requestBody.endpoint,
          method: requestBody.method || 'GET',
          hasBody: !!requestBody.body
        })
      } catch (e) {
        console.error('❌ Failed to parse request body as JSON:', e)
        return new Response(
          JSON.stringify({ 
            error: 'Invalid JSON in request body',
            details: e.message 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // Extract endpoint from request body or URL
    let endpoint: string
    if (requestBody && requestBody.endpoint) {
      endpoint = requestBody.endpoint
    } else {
      const url = new URL(req.url)
      const path = url.pathname.replace('/functions/v1/jira-proxy', '')
      const searchParams = url.searchParams.toString()
      endpoint = `${path}${searchParams ? `?${searchParams}` : ''}`
    }

    if (!endpoint || endpoint === '/') {
      console.error('❌ No endpoint specified')
      return new Response(
        JSON.stringify({ 
          error: 'No endpoint specified',
          details: 'Please provide an endpoint in the request body or URL path'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`🎯 Proxying request to endpoint: ${endpoint}`)

    // Get Jira config for this company
    const config = await getJiraConfig(companyId)

    // Use method from request body or default to GET
    const method = requestBody?.method || 'GET'
    const requestOptions: RequestInit = {
      method: method,
    }

    // Only add body for non-GET requests
    if (method !== 'GET' && requestBody?.body) {
      requestOptions.body = JSON.stringify(requestBody.body)
      console.log('📝 Request body added for', method, 'request')
    }

    console.log(`📡 Making ${method} request to ${endpoint}`)
    const result = await makeJiraRequest(endpoint, config, requestOptions)

    console.log('✅ Request completed successfully')

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('🚨 Jira proxy error:', error)
    
    // Return detailed error information
    const errorResponse = {
      error: error.message || 'Internal server error',
      details: error.toString(),
      timestamp: new Date().toISOString(),
      // Add helpful information for common issues
      help: error.message?.includes('Missing required environment variables') 
        ? 'Go to Supabase Dashboard → Project Settings → Edge Functions and set JIRA_EMAIL and JIRA_TOKEN environment variables'
        : error.message?.includes('410')
        ? 'This Jira API endpoint has been deprecated. The application needs to be updated to use newer endpoints.'
        : 'Check the console logs for more details'
    }
    
    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})