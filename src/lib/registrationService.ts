export interface CompanyRegistrationData {
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

export interface RegistrationResult {
  success: boolean;
  companyId?: string;
  userId?: string;
  error?: string;
}

export const registrationService = {
  async registerCompany(data: CompanyRegistrationData): Promise<RegistrationResult> {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/company-registration`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || 'Kayıt işlemi başarısız oldu',
        };
      }

      return {
        success: true,
        companyId: result.companyId,
        userId: result.userId,
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Kayıt işlemi sırasında hata oluştu',
      };
    }
  },
};
