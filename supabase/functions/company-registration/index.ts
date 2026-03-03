import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RegistrationRequest {
  companyName: string;
  companyEmail: string;
  firstName: string;
  lastName: string;
  userEmail: string;
  password: string;
  jiraEmail: string;
  jiraApiToken: string;
  jiraBaseUrl: string;
  kolayikApiToken?: string;
  kolayikBaseUrl?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const requestData: RegistrationRequest = await req.json();

    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('email', requestData.companyEmail)
      .maybeSingle();

    if (existingCompany) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Bu e-posta adresi ile kayıtlı bir şirket zaten mevcut',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', requestData.userEmail)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Bu e-posta adresi ile kayıtlı bir kullanıcı zaten mevcut',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: requestData.companyName,
        email: requestData.companyEmail,
        jira_email: requestData.jiraEmail,
        jira_api_token: requestData.jiraApiToken,
        jira_base_url: requestData.jiraBaseUrl,
        kolayik_api_token: requestData.kolayikApiToken || '',
        kolayik_base_url: requestData.kolayikBaseUrl || '',
        is_active: true,
      })
      .select()
      .single();

    if (companyError) {
      console.error('Company creation error:', companyError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Şirket kaydı oluşturulamadı: ' + companyError.message,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        company_id: company.id,
        email: requestData.userEmail,
        password_hash: requestData.password,
        name: `${requestData.firstName} ${requestData.lastName}`,
        role: 'admin',
        assigned_projects: [],
        is_active: true,
      })
      .select()
      .single();

    if (userError) {
      console.error('User creation error:', userError);

      await supabase.from('companies').delete().eq('id', company.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Kullanıcı kaydı oluşturulamadı: ' + userError.message,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        companyId: company.id,
        userId: user.id,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Kayıt işlemi sırasında hata oluştu',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
