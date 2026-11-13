import { supabase } from './supabaseClient';
import { UserProfile } from '../domain/types';

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  async getCurrentProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Erro ao buscar perfil do usuário:', error);
      return {
        id: user.id,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
        role: user.user_metadata?.role || 'recepcao',
        created_at: new Date().toISOString(),
      };
    }

    return data as UserProfile;
  },

  onAuthStateChange(callback: (profile: UserProfile | null) => void) {
    return supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        callback(null);
      } else {
        const profile = await authService.getCurrentProfile();
        callback(profile);
      }
    });
  },
};
