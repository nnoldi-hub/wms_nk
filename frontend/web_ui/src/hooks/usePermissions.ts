/**
 * usePermissions.ts — Faza 6.2: Permisiuni Granulare
 *
 * Hook pentru citirea si validarea permisiunilor granulare ale userului curent.
 * Permisiunile sunt incarcate din API si cachate in context.
 */

import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export type ResourcePermissions = {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
};

export type PermissionsMap = Record<string, ResourcePermissions>;

const DEFAULT_PERMS: ResourcePermissions = {
  can_view: true,
  can_create: false,
  can_edit: false,
  can_delete: false,
  can_approve: false,
};

// Admins au toate permisiunile, managerii pot crea/edita dar nu sterge
const ROLE_DEFAULTS: Record<string, Partial<ResourcePermissions>> = {
  admin:    { can_view: true, can_create: true, can_edit: true, can_delete: true, can_approve: true },
  manager:  { can_view: true, can_create: true, can_edit: true, can_delete: false, can_approve: true },
  operator: { can_view: true, can_create: true, can_edit: false, can_delete: false, can_approve: false },
  sofer:    { can_view: true, can_create: false, can_edit: false, can_delete: false, can_approve: false },
};

const AUTH_URL = import.meta.env.VITE_AUTH_URL as string || 'http://localhost:3001';

export function usePermissions(resource?: string) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<PermissionsMap>({});
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('accessToken');

  const userId = user?.id;
  const userRole = user?.role;

  useEffect(() => {
    if (!userId || !userRole) return;
    if (userRole === 'admin') return;
    if (!token) return;

    let cancelled = false;
    setLoading(true);

    fetch(`${AUTH_URL}/api/v1/users/${userId}/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.success) {
          setPermissions(data.data || {});
        }
      })
      .catch(() => {/* fallback la role defaults */})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [userId, userRole, token]);

  /**
   * Returneaza permisiunile pentru o resursa specifica.
   * Fallback: role-based defaults daca nu exista permisiuni granulare.
   */
  const getResourcePermissions = (res: string): ResourcePermissions => {
    const role = user?.role ?? 'operator';

    // Admin: full access
    if (role === 'admin') {
      return { can_view: true, can_create: true, can_edit: true, can_delete: true, can_approve: true };
    }

    // Permisiuni granulare suprascriau role defaults
    if (permissions[res]) {
      return permissions[res];
    }

    // Fallback la role defaults
    return { ...DEFAULT_PERMS, ...(ROLE_DEFAULTS[role] ?? {}) };
  };

  const can = (action: keyof ResourcePermissions, res?: string): boolean => {
    const target = res ?? resource ?? '';
    if (!target) return true;
    const p = getResourcePermissions(target);
    return p[action] ?? false;
  };

  return {
    permissions,
    loading,
    getResourcePermissions,
    can,
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager' || user?.role === 'admin',
  };
}
