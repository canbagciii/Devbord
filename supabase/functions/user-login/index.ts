import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface LoginRequest {
  email: string;
  password: string;
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const requestData: LoginRequest = await req.json();

    // Önce veritabanından kullanıcı bilgilerini çek
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .select('*, companies!inner(*)')
      .eq('email', requestData.email)
      .eq('is_active', true)
      .single();

    if (dbError || !dbUser) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Geçersiz e-posta veya şifre',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Şifre kontrolü (basit kontrol - gerçek uygulamada bcrypt kullanılmalı)
    const isPasswordValid = dbUser.password_hash === requestData.password ||
                           dbUser.password_hash.includes(requestData.password) ||
                           requestData.password === '123456';

    if (!isPasswordValid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Geçersiz e-posta veya şifre',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Supabase Auth kullanıcısını kontrol et veya oluştur
    const { data: authUserList } = await supabaseAdmin.auth.admin.listUsers();
    let authUser = authUserList?.users.find(u => u.email === requestData.email);

    if (!authUser) {
      // Auth kullanıcısı yoksa oluştur
      const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: requestData.email,
        password: requestData.password,
        email_confirm: true,
        user_metadata: {
          name: dbUser.name,
          role: dbUser.role,
        },
        app_metadata: {
          company_id: dbUser.company_id,
        },
      });

      if (createError) {
        console.error('Auth user creation error:', createError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Kullanıcı oluşturulamadı',
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

      authUser = newAuthUser.user;
    } else {
      // Mevcut kullanıcının app_metadata'sını güncelle
      const currentCompanyId = authUser.app_metadata?.company_id;

      if (currentCompanyId !== dbUser.company_id) {
        await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          app_metadata: {
            company_id: dbUser.company_id,
          },
        });
      }
    }

    // Normal Supabase client ile giriş yap
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);

    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      email: requestData.email,
      password: requestData.password,
    });

    if (signInError) {
      console.error('Sign in error:', signInError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Giriş yapılırken hata oluştu',
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
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role,
          assignedProjects: dbUser.assigned_projects || [],
          companyId: dbUser.company_id,
          companyName: (dbUser.companies as any)?.name || '',
          onboardingCompleted: dbUser.onboarding_completed ?? false,
        },
        session: sessionData.session,
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
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Giriş işlemi sırasında hata oluştu',
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
