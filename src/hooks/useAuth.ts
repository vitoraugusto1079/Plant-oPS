// ==============================================================================
// PlantãoPS - Hook de Autenticação (useAuth)
// ==============================================================================

import { useState, useEffect, useCallback } from 'react';
import { UserProfile, UserRole } from '../domain/types';
import { authService } from '../services/authService';

export function useAuth() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    // Carregar perfil inicial
    authService.getCurrentProfile().then((p) => {
      if (mounted) {
        setProfile(p);
        setIsLoading(false);
      }
    }).catch((err) => {
      console.error('Erro ao obter perfil do usuário:', err);
      if (mounted) {
        setIsLoading(false);
      }
    });

    // Observar mudanças na sessão
    const { data: { subscription } } = authService.onAuthStateChange((p) => {
      if (mounted) {
        setProfile(p);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await authService.signIn(email, pass);
      const userProfile = await authService.getCurrentProfile();
      setProfile(userProfile);
      return res;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.signOut();
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasRole = useCallback(
    (allowedRoles: UserRole[]): boolean => {
      if (!profile) return false;
      return allowedRoles.includes(profile.role);
    },
    [profile]
  );

  return {
    profile,
    user: profile,
    role: profile?.role,
    isAuthenticated: !!profile,
    isLoading,
    login,
    logout,
    hasRole,
  };
}
