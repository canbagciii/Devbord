import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { jiraEmail, jiraApiToken, jiraBaseUrl } = await req.json();

    if (!jiraEmail || !jiraApiToken || !jiraBaseUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          title: 'Eksik bilgi',
          description: 'Jira e-posta, token ve Base URL zorunludur.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sunucudan Jira'ya istek at (CORS yok)
    const credentials = btoa(`${jiraEmail}:${jiraApiToken}`);
    const jiraRes = await fetch(`${jiraBaseUrl}/rest/api/3/myself`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
      },
    });

    if (jiraRes.ok) {
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hata durumlarına göre anlamlı mesajlar döndür
    const errorMap: Record<number, { title: string; description: string; hint?: string; hintLink?: { label: string; url: string } }> = {
      401: {
        title: 'Kimlik doğrulama başarısız',
        description: 'Jira e-posta adresiniz veya API token\'ınız hatalı.',
        hint: 'API token\'ınızı Atlassian hesabınızdan yeniden oluşturmayı deneyin.',
        hintLink: {
          label: 'API token oluştur →',
          url: 'https://id.atlassian.com/manage-profile/security/api-tokens',
        },
      },
      403: {
        title: 'Erişim izni reddedildi',
        description: 'API token\'ınızın bu işlem için yeterli yetkisi yok.',
        hint: 'Token oluştururken tüm izinlerin verildiğinden emin olun.',
      },
      404: {
        title: 'Jira adresi bulunamadı',
        description: `"${jiraBaseUrl}" adresine ulaşılamıyor.`,
        hint: 'Base URL\'nin https://sirketadi.atlassian.net formatında olduğundan emin olun.',
      },
    };

    const errorDetail = errorMap[jiraRes.status] || {
      title: `Bağlantı hatası (HTTP ${jiraRes.status})`,
      description: 'Jira sunucusundan beklenmedik bir yanıt alındı.',
      hint: 'Bilgilerinizi kontrol edip tekrar deneyin.',
    };

    return new Response(
      JSON.stringify({ success: false, ...errorDetail }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        title: "Jira'ya ulaşılamıyor",
        description: 'Sunucuya bağlanırken bir hata oluştu.',
        hint: 'Base URL\'nin doğru olduğundan emin olun.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});