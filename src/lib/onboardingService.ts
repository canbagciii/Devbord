import { supabase } from './supabase';

export const onboardingService = {
  async completeOnboarding(userId: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ onboarding_completed: true })
      .eq('id', userId);

    if (error) {
      console.error('Error completing onboarding:', error);
      throw new Error('Onboarding tamamlanamadı');
    }

    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      userData.onboardingCompleted = true;
      localStorage.setItem('user', JSON.stringify(userData));
    }
  },

  async checkOnboardingRequired(userId: string): Promise<boolean> {
    const { data: selectedProjects } = await supabase
      .from('jira_filters')
      .select('id')
      .eq('company_id', localStorage.getItem('companyId'))
      .eq('filter_type', 'project')
      .limit(1);

    const { data: selectedDevelopers } = await supabase
      .from('jira_filters')
      .select('id')
      .eq('company_id', localStorage.getItem('companyId'))
      .eq('filter_type', 'developer')
      .limit(1);

    return !selectedProjects || selectedProjects.length === 0 || !selectedDevelopers || selectedDevelopers.length === 0;
  }
};
