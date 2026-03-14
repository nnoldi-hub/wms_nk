/**
 * useActivityLog.ts — Faza 6.3: Log acțiuni utilizatori în UI
 *
 * Hook simplu pentru a trimite evenimente de activitate UI la backend.
 * Folosit pentru a înregistra acțiuni cheie (navigare, export, creare, confirmare).
 *
 * Utilizare:
 *   const { logAction } = useActivityLog();
 *   await logAction('PAGE_VIEW', 'page', undefined, '/orders');
 */

import { useCallback } from 'react';
import { useAuth } from './useAuth';
import warehouseConfigService from '../services/warehouseConfig.service';

export function useActivityLog() {
  const { user } = useAuth();

  /**
   * @param action_type  Tip acțiune (ex: PAGE_VIEW, EXPORT_CSV, ORDER_CREATE)
   * @param entity_type  Tipul entității (ex: page, order, batch) — opțional
   * @param entity_id    ID-ul entității acționate — opțional
   * @param entity_code  Codul/titlul entității (ex: /orders, CMD-001) — opțional
   * @param extra_info   Date suplimentare (filtre, parametri) — opțional
   */
  const logAction = useCallback(
    async (
      action_type: string,
      entity_type?: string,
      entity_id?: string,
      entity_code?: string,
      extra_info?: Record<string, unknown>,
    ) => {
      if (!user) return; // nu logam dacă user-ul nu e autentificat
      try {
        await warehouseConfigService.postUiEvent({
          action_type,
          entity_type,
          entity_id,
          entity_code,
          extra_info,
        });
      } catch {
        // log UI actions sunt non-critice — nu aruncam erori
      }
    },
    [user],
  );

  return { logAction };
}
