import { createClient } from 'npm:@supabase/supabase-js@2.52.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-company-id, x-jira-validate, x-jira-base-url, x-jira-credentials',
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

  if (!jira_email || !jira_api_token) {
    const missingVars = []
    if (!jira_email) missingVars.push('jira_email')
    if (!jira_api_token) missingVars.push('jira_api_token')
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`🚀 Received ${req.method} request to jira-proxy`)

    // ─────────────────────────────────────────────────────────────
    // KAYIT DOĞRULAMA MODU: x-jira-validate: true header'ı varsa
    // DB'ye gitmeden, gelen credentials ile direkt Jira'yı kontrol et
    // ─────────────────────────────────────────────────────────────
    const isValidationMode = req.headers.get('x-jira-validate') === 'true'

    if (isValidationMode) {
      console.log('🔑 Registration validation mode — using provided credentials')

      const jiraBaseUrl = req.headers.get('x-jira-base-url')
      const jiraCredentials = req.headers.get('x-jira-credentials') // base64 email:token

      if (!jiraBaseUrl || !jiraCredentials) {
        return new Response(
          JSON.stringify({ error: 'Missing x-jira-base-url or x-jira-credentials header' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const finalUrl = `${jiraBaseUrl}/rest/api/3/myself`
      console.log(`🌐 Validation request: GET ${finalUrl}`)

      const jiraRes = await fetch(finalUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${jiraCredentials}`,
          'Accept': 'application/json',
        },
      })

      console.log(`📡 Validation response: ${jiraRes.status}`)

      if (jiraRes.ok) {
        const data = await jiraRes.json()
        return new Response(JSON.stringify({ success: true, user: data }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const errorText = await jiraRes.text()
      let errorMessage = `Jira API Error (${jiraRes.status}): ${errorText}`

      if (jiraRes.status === 401) errorMessage = `Jira Authentication Failed (401): ${errorText}`
      else if (jiraRes.status === 403) errorMessage = `Jira Access Forbidden (403): ${errorText}`
      else if (jiraRes.status === 404) errorMessage = `Jira Resource Not Found (404): ${errorText}`

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─────────────────────────────────────────────────────────────
    // NORMAL MOD: x-company-id ile DB'den config çek
    // ─────────────────────────────────────────────────────────────
    const companyId = req.headers.get('x-company-id')
    if (!companyId) {
      console.error('❌ No company ID provided')
      return new Response(
        JSON.stringify({ error: 'Company ID required', details: 'Please provide x-company-id header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🏢 Company ID:', companyId)

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
          JSON.stringify({ error: 'Invalid JSON in request body', details: e.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

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
      return new Response(
        JSON.stringify({ error: 'No endpoint specified', details: 'Please provide an endpoint in the request body or URL path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const config = await getJiraConfig(companyId)
    const method = requestBody?.method || 'GET'
    const requestOptions: RequestInit = { method }

    if (method !== 'GET' && requestBody?.body) {
      requestOptions.body = JSON.stringify(requestBody.body)
    }

    const result = await makeJiraRequest(endpoint, config, requestOptions)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('🚨 Jira proxy error:', error)

    const errorResponse = {
      error: error.message || 'Internal server error',
      details: error.toString(),
      timestamp: new Date().toISOString(),
      help: error.message?.includes('Missing required environment variables')
        ? 'Go to Supabase Dashboard → Project Settings → Edge Functions and set JIRA_EMAIL and JIRA_TOKEN environment variables'
        : error.message?.includes('410')
        ? 'This Jira API endpoint has been deprecated. The application needs to be updated to use newer endpoints.'
        : 'Check the console logs for more details'
    }

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})