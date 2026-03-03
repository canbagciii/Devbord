const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface KolayIKConfig {
  baseUrl: string
  apiToken: string
}

const getKolayIKConfig = (): KolayIKConfig => {
  const baseUrl = 'https://api.kolayik.com/v2'
  const apiToken = Deno.env.get('KOLAYIK_API_TOKEN')
  
  console.log('🔍 Kolay İK Environment variables check:', {
    baseUrl,
    apiTokenExists: !!apiToken,
    apiTokenLength: apiToken?.length || 0,
    apiTokenPreview: apiToken ? `${apiToken.substring(0, 10)}...` : 'undefined'
  })
  
  if (!apiToken) {
    console.error('❌ Missing required environment variable: KOLAYIK_API_TOKEN')
    throw new Error('Missing required environment variable: KOLAYIK_API_TOKEN. Please configure this in your Supabase project settings under Edge Functions.')
  }
  
  return { baseUrl, apiToken }
}

const makeKolayIKRequest = async (endpoint: string, options: RequestInit = {}) => {
  const config = getKolayIKConfig()
  
  const finalUrl = `${config.baseUrl}${endpoint}`
  console.log(`🌐 Making Kolay İK request to: ${finalUrl}`)
  
  try {
    let requestOptions: RequestInit
    
    // /person/list endpoint'i için form data kullan
    if (endpoint === '/person/list') {
      const formData = new FormData()
      formData.append('status', '1') // 1 for active, 0 for terminated employees
      // Optional: Add page parameter for pagination
      formData.append('page', '1')
      
      requestOptions = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          // Don't set Content-Type for FormData - let browser set multipart/form-data automatically
        },
        body: formData
      }
    } else if (endpoint.startsWith('/leave/list') || endpoint.startsWith('/leave/type/list') || endpoint.startsWith('/publicholiday/list')) {
      //  İzin ve resmi tatil endpoint'leri için GET method kullan
      requestOptions = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Accept': 'application/json',
        },

      }
    } else {
      // Diğer endpoint'ler için normal JSON
      requestOptions = {
        ...options,
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options.headers,
        },
      }
    }
    
    const response = await fetch(finalUrl, requestOptions)
    
    console.log(`📡 Kolay İK Response: ${response.status} ${response.statusText}`)
    
    // Response body'yi oku
    const responseText = await response.text()
    console.log(`📄 Response body length: ${responseText.length}`)
    console.log(`📄 Response body preview: ${responseText.substring(0, 200)}...`)
    
    if (!response.ok) {
      console.error(`❌ Kolay İK API Error: ${response.status} - ${responseText}`)
      
      // Provide more specific error messages
      if (response.status === 401) {
        throw new Error(`Kolay İK Authentication Failed (401): Please check your KOLAYIK_API_TOKEN. Response: ${responseText}`)
      } else if (response.status === 403) {
        throw new Error(`Kolay İK Access Forbidden (403): Your API token may not have permission to access this resource. Response: ${responseText}`)
      } else if (response.status === 404) {
        throw new Error(`Kolay İK Resource Not Found (404): The requested endpoint may not exist. Response: ${responseText}`)
      } else if (response.status === 400) {
        // 400 hatası için daha detaylı analiz
        let errorDetails = responseText
        try {
          const errorJson = JSON.parse(responseText)
          if (errorJson.message) {
            errorDetails = errorJson.message
          }
          if (errorJson.details) {
            errorDetails += ` - ${errorJson.details}`
          }
        } catch (e) {
          // JSON parse edilemezse raw text kullan
        }
        throw new Error(`Kolay İK Bad Request (400): ${errorDetails}`)
      } else {
        throw new Error(`Kolay İK API Error (${response.status}): ${responseText}`)
      }
    }
    
    // Log successful response for debugging
    console.log(`✅ Kolay İK API Response (${response.status}):`, {
      endpoint,
      responseLength: responseText.length,
      contentType: response.headers.get('content-type')
    })
    
    // JSON parse et
    let data
    try {
      data = JSON.parse(responseText)
      console.log('✅ Kolay İK Request successful, JSON parsed')
    } catch (parseError) {
      console.error('❌ Failed to parse JSON response:', parseError)
      throw new Error(`Invalid JSON response from Kolay İK API: ${responseText}`)
    }
    
    return data
  } catch (error) {
    console.error('🚨 Kolay İK Request failed:', error)
    throw error
  }
}

const validateRequest = (requestBody: any) => {
  if (!requestBody || !requestBody.endpoint) {
    throw new Error('Missing endpoint in request body')
  }
  
  // Log request details for debugging
  console.log('📋 Request validation:', {
    endpoint: requestBody.endpoint,
    method: requestBody.method || 'GET',
    hasBody: !!requestBody.body
  })
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`🚀 Received ${req.method} request to kolayik-proxy`)
    
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
    let endpoint: string = '/employees' // Default endpoint for testing
    
    if (requestBody && requestBody.endpoint) {
      endpoint = requestBody.endpoint
    } else {
      // Try to extract from URL path
      const url = new URL(req.url)
      const path = url.pathname.replace('/functions/v1/kolayik-proxy', '')
      if (path && path !== '/') {
        const searchParams = url.searchParams.toString()
        endpoint = `${path}${searchParams ? `?${searchParams}` : ''}`
      }
    }
    
    // Validate request
    validateRequest({ endpoint, ...requestBody })

    console.log(`🎯 Proxying request to Kolay İK endpoint: ${endpoint}`)

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
    const result = await makeKolayIKRequest(endpoint, requestOptions)

    console.log('✅ Kolay İK proxy request completed successfully')

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('🚨 Kolay İK proxy error:', error)
    
    // Return detailed error information
    const errorResponse = {
      error: error.message || 'Internal server error',
      details: error.toString(),
      timestamp: new Date().toISOString(),
      help: getErrorHelp(error.message || '')
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

const getErrorHelp = (errorMessage: string): string => {
  if (errorMessage.includes('Missing required environment variable')) {
    return 'Go to Supabase Dashboard → Project Settings → Edge Functions and set KOLAYIK_API_TOKEN environment variable'
  }
  if (errorMessage.includes('401')) {
    return 'Check your Kolay İK API token in Supabase environment variables - it may be invalid or expired'
  }
  if (errorMessage.includes('400')) {
    return 'Kolay İK API returned Bad Request. Please verify: 1) KOLAYIK_API_TOKEN is correct, 2) API token has proper permissions in Kolay İK admin panel, 3) API endpoint is valid'
  }
  if (errorMessage.includes('403')) {
    return 'API token does not have permission to access this resource. Check permissions in Kolay İK admin panel'
  }
  return 'Check the console logs for more details'
}