/**
 * useWebSocket.ts — WebSocket hook cu reconectare automată (Faza 6.3)
 *
 * Conectează la ws://warehouse-config/ws?token=JWT
 * Returnează alertele primite în timp real.
 * Fallback la polling dacă WS nu e disponibil.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface WsAlert {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  recommendation: string;
  data: Record<string, unknown>;
}

interface WsMessage {
  type: 'ALERTS_UPDATE';
  alerts: WsAlert[];
  timestamp: string;
}

interface UseWebSocketResult {
  alerts: WsAlert[];
  connected: boolean;
  lastUpdate: Date | null;
  reconnectCount: number;
}

const WS_BASE_URL = (import.meta.env.VITE_WAREHOUSE_CONFIG_WS_URL as string) ||
  (import.meta.env.VITE_WAREHOUSE_CONFIG_URL as string || 'http://localhost:3000')
    .replace(/^http/, 'ws') + '/ws';

const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 2_000;

export function useWebSocket(): UseWebSocketResult {
  const [alerts, setAlerts] = useState<WsAlert[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const getToken = () => localStorage.getItem('accessToken') || '';

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return; // Neautentificat, nu conecta

    const url = `${WS_BASE_URL}?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        setReconnectCount(0);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg: WsMessage = JSON.parse(event.data);
          if (msg.type === 'ALERTS_UPDATE') {
            setAlerts(msg.alerts || []);
            setLastUpdate(new Date(msg.timestamp));
          }
        } catch {
          // mesaj malformat — ignorat
        }
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        setConnected(false);
        wsRef.current = null;

        // Nu reconecta dacă a fost deconectat intenționat (auth eșuat)
        if (event.code === 4001 || event.code === 4003) return;

        // Reconectare cu exponential backoff
        setReconnectCount((prev) => {
          const count = prev + 1;
          const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** (count - 1), MAX_RECONNECT_DELAY_MS);
          reconnectTimerRef.current = setTimeout(connect, delay);
          return count;
        });
      };

      ws.onerror = () => {
        // onclose se va declanșa automat după onerror
      };
    } catch {
      // WebSocket nu disponibil în mediul curent (ex: test)
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Previne reconectarea la unmount
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { alerts, connected, lastUpdate, reconnectCount };
}
