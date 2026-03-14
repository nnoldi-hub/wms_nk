/**
 * PermissionGuard.tsx — Faza 6.2: Restricții UI bazate pe permisiuni
 *
 * Wrapper care ascunde sau dezactivează un element în funcție de permisiunile
 * utilizatorului curent. Folosește hook-ul usePermissions existent.
 *
 * Utilizare:
 *   <PermissionGuard resource="orders" action="can_create">
 *     <Button>Adauga comanda</Button>
 *   </PermissionGuard>
 *
 *   <PermissionGuard resource="users" action="can_delete" mode="disable">
 *     <IconButton>...</IconButton>
 *   </PermissionGuard>
 */

import React from 'react';
import { Tooltip } from '@mui/material';
import { usePermissions, type ResourcePermissions } from '../hooks/usePermissions';

interface PermissionGuardProps {
  /** Resursa verificată (ex: 'orders', 'batches', 'config'). */
  resource: string;
  /** Acțiunea necesară (ex: 'can_create', 'can_edit', 'can_delete'). */
  action: keyof ResourcePermissions;
  /**
   * 'hide'    — ascunde complet elementul dacă nu are permisiune (default)
   * 'disable' — afișează elementul dar dezactivat (+ tooltip)
   */
  mode?: 'hide' | 'disable';
  /** Mesajul Tooltip când mode='disable' și nu există permisiune. */
  tooltip?: string;
  children: React.ReactElement;
}

export default function PermissionGuard({
  resource,
  action,
  mode = 'hide',
  tooltip = 'Nu ai permisiunea necesară pentru această acțiune.',
  children,
}: PermissionGuardProps) {
  const { can, loading } = usePermissions(resource);

  // Cât timp se încarcă, nu ascunde nimic (evităm flash de UI)
  if (loading) return children;

  const allowed = can(action, resource);

  if (allowed) return children;

  if (mode === 'disable') {
    // Clonăm elementul cu `disabled` + înfășurăm în Tooltip
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const disabled = React.cloneElement(children as React.ReactElement<any>, { disabled: true });
    return <Tooltip title={tooltip}><span>{disabled}</span></Tooltip>;
  }

  // mode === 'hide' — nu randăm nimic
  return null;
}
