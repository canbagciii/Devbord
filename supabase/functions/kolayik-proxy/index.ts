const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-jwt',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface KolayIKConfig {
  baseUrl: string
  apiToken: string
}

/**
 * Şirket bazlı Kolay İK ayarı.
 * - companyId geçerliyse o şirketin token'ı DB'den okunur.
 * - Yoksa env KOLAYIK_API_TOKEN (fallback).
 */
const getKolayIKConfig = async (companyId: string | null): Promise<KolayIKConfig> => {
  if (companyId) {
    const { createClient } = await import('npm:@supabase/supabase-js@2.52.0')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: company, error } = await supabase
      .from('companies')
      .select('kolayik_base_url, kolayik_api_token')
      .eq('id', companyId)
      .single()
    if (!error && company?.kolayik_api_token?.trim()) {
      const baseUrl = (company.kolayik_base_url || 'https://api.kolayik.com/v2').replace(/\/$/, '')
      console.log('🔍 Kolay İK config from DB for company:', companyId, 'baseUrl:', baseUrl)
      return { baseUrl, apiToken: company.kolayik_api_token.trim() }
    }
    if (companyId) {
      console.error('❌ Kolay İK: Company', companyId, 'has no kolayik_api_token')
      throw new Error('Bu şirket için Kolay İK ayarları tanımlı değil. Lütfen Kullanıcı & Filtre Yönetimi → Kolay İK Bağlantısı bölümünden API Token ve Base URL girin.')
    }
  }
  const baseUrl = 'https://api.kolayik.com/v2'
  const apiToken = Deno.env.get('KOLAYIK_API_TOKEN')
  if (!apiToken) {
    throw new Error('Kolay İK API ayarları bulunamadı. Şirket ayarlarında Kolay İK Token girin veya Supabase ortam değişkeninde KOLAYIK_API_TOKEN tanımlayın.')
  }
  console.log('🔍 Kolay İK config from env (no company or fallback)')
  return { baseUrl, apiToken }
}

const makeKolayIKRequest = async (endpoint: string, config: KolayIKConfig, options: RequestInit = {}) => {

  const finalUrl = `${config.baseUrl}${endpoint}`
  console.log(`🌐 Making Kolay İK request to: ${finalUrl}`)

  try {
    let requestOptions: RequestInit

    if (endpoint === '/person/list') {
      const formData = new FormData()
      formData.append('status', '1')
      formData.append('page', '1')

      requestOptions = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
        },
        body: formData
      }
    } else if (endpoint.startsWith('/leave/list') || endpoint.startsWith('/leave/type/list') || endpoint.startsWith('/publicholiday/list')) {
      requestOptions = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Accept': 'application/json',
        },
      }
    } else {
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

    const responseText = await response.text()
    console.log(`📄 Response body length: ${responseText.length}`)
    console.log(`📄 Response body preview: ${responseText.substring(0, 200)}...`)

    if (!response.ok) {
      console.error(`❌ Kolay İK API Error: ${response.status} - ${responseText}`)

      if (response.status === 401) {
        throw new Error(`Kolay İK Authentication Failed (401): Please check your KOLAYIK_API_TOKEN. Response: ${responseText}`)
      } else if (response.status === 403) {
        throw new Error(`Kolay İK Access Forbidden (403): Your API token may not have permission to access this resource. Response: ${responseText}`)
      } else if (response.status === 404) {
        throw new Error(`Kolay İK Resource Not Found (404): The requested endpoint may not exist. Response: ${responseText}`)
      } else if (response.status === 400) {
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
          // ignore
        }
        throw new Error(`Kolay İK Bad Request (400): ${errorDetails}`)
      } else {
        throw new Error(`Kolay İK API Error (${response.status}): ${responseText}`)
      }
    }

    console.log(`✅ Kolay İK API Response (${response.status}):`, {
      endpoint,
      responseLength: responseText.length,
      contentType: response.headers.get('content-type')
    })

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

  console.log('📋 Request validation:', {
    endpoint: requestBody.endpoint,
    method: requestBody.method || 'GET',
    hasBody: !!requestBody.body
  })
}

/** X-User-JWT header'ından kullanıcı token'ını doğrula, company_id döndür. Yok/geçersizse null (body companyId kullanılır). */
const getCompanyIdFromUserJwt = async (req: Request): Promise<string | null> => {
  const token = req.headers.get('x-user-jwt')?.trim()
  if (!token) return null
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const { createClient } = await import('npm:@supabase/supabase-js@2.52.0')
  const supabase = createClient(supabaseUrl, anonKey)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return (user.app_metadata?.company_id as string) ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`🚀 Received ${req.method} request to kolayik-proxy`)

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

    let endpoint: string = '/employees'

    if (requestBody && requestBody.endpoint) {
      endpoint = requestBody.endpoint
    } else {
      const url = new URL(req.url)
      const path = url.pathname.replace('/functions/v1/kolayik-proxy', '')
      if (path && path !== '/') {
        const searchParams = url.searchParams.toString()
        endpoint = `${path}${searchParams ? `?${searchParams}` : ''}`
      }
    }

    validateRequest({ endpoint, ...requestBody })

    const companyIdFromJwt = await getCompanyIdFromUserJwt(req)
    const companyId = companyIdFromJwt ?? requestBody?.companyId ?? null
    if (companyIdFromJwt) {
      console.log('🔒 Şirket JWT\'den alındı (güvenli)')
    } else if (requestBody?.companyId) {
      console.log('⚠️ Şirket body\'den alındı (X-User-JWT yok veya geçersiz)')
    }

    const config = await getKolayIKConfig(companyId)

    console.log(`🎯 Proxying request to Kolay İK endpoint: ${endpoint} (company: ${companyId || 'env'})`)

    const method = requestBody?.method || 'GET'
    const requestOptions: RequestInit = {
      method: method,
    }

    if (method !== 'GET' && requestBody?.body) {
      requestOptions.body = JSON.stringify(requestBody.body)
      console.log('📝 Request body added for', method, 'request')
    }

    console.log(`📡 Making ${method} request to ${endpoint}`)
    const result = await makeKolayIKRequest(endpoint, config, requestOptions)

    console.log('✅ Kolay İK proxy request completed successfully')

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('🚨 Kolay İK proxy error:', error)

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
  if (errorMessage.includes('Oturum gerekli') || errorMessage.includes('giriş yapın')) {
    return 'Çıkış yapıp tekrar giriş yapın. Şirket bazlı istek için geçerli oturum gereklidir.'
  }
  if (errorMessage.includes('Missing required environment variable')) {
    return 'Supabase Dashboard → Project Settings → Edge Functions bölümünde KOLAYIK_API_TOKEN ortam değişkenini tanımlayın'
  }
  if (errorMessage.includes('401')) {
    return 'Supabase ortam değişkenlerindeki Kolay İK API token\'ı kontrol edin veya oturumunuzu yenileyin (çıkış yapıp tekrar giriş yapın).'
  }
  if (errorMessage.includes('400')) {
    return 'Kolay İK API Bad Request döndü. KOLAYIK_API_TOKEN doğru mu, Kolay İK panelinde API yetkileri var mı kontrol edin'
  }
  if (errorMessage.includes('403')) {
    return 'API token bu kaynağa erişim yetkisine sahip değil. Kolay İK panelinde yetkileri kontrol edin'
  }
  return 'Konsol loglarını kontrol edin'
}
