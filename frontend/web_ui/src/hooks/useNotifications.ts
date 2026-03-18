/**
 * useNotifications.ts — Hook Socket.IO la notifications-service (port 3017)
 *
 * Conectează autentificat cu JWT, ascultă evenimentele de job asignat,
 * returnează contorul de joburi neasigurate + ultimul job primit.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface JobAssignedEvent {
  jobId: string;
  priority: 'NORMAL' | 'URGENT' | 'CRITIC';
  orderRef?: string;
  itemsCount?: number;
  assignedBy?: string;
}

interface UseNotificationsResult {
  connected: boolean;
  assignedJobCount: number;
  lastJobAssigned: JobAssignedEvent | null;
  clearLastJob: () => void;
}

const NOTIF_URL =
  (import.meta.env.VITE_NOTIFICATIONS_URL as string) || 'http://localhost:3017';

export function useNotifications(): UseNotificationsResult {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [assignedJobCount, setAssignedJobCount] = useState(0);
  const [lastJobAssigned, setLastJobAssigned] = useState<JobAssignedEvent | null>(null);

  const clearLastJob = useCallback(() => setLastJobAssigned(null), []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = io(NOTIF_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30_000,
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('job:assigned', (event: JobAssignedEvent) => {
      setAssignedJobCount((c) => c + 1);
      setLastJobAssigned(event);
    });

    // La reconectare: re-solicită contorul actual din server via REST
    socket.on('connect', () => {
      setConnected(true);
      const inventoryBase =
        (import.meta.env.VITE_INVENTORY_URL as string) || 'http://localhost:3011';
      fetch(`${inventoryBase}/api/v1/pick-jobs?mine=1&status=ASSIGNED&limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.pagination?.total !== undefined) {
            setAssignedJobCount(data.pagination.total);
          }
        })
        .catch(() => {/* silent – badge va fi actualizat la next event */});
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { connected, assignedJobCount, lastJobAssigned, clearLastJob };
}
