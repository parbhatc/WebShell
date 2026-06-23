import { create } from 'zustand';
import { fetchWithAuth } from '@/lib/api';

interface Server {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: string;
}

interface ServerState {
  servers: Server[];
  fetchServers: () => Promise<void>;
  addServer: (serverData: Omit<Server, 'id'> & { credentials: string }) => Promise<void>;
  updateServer: (id: number, serverData: Partial<Omit<Server, 'id'>>) => Promise<void>;
  deleteServer: (id: number) => Promise<void>;
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  fetchServers: async () => {
    try {
      const response = await fetchWithAuth('/api/servers');
      if (response.ok) {
        const servers = await response.json();
        set({ servers });
      } else {
        set({ servers: [] });
      }
    } catch {
      set({ servers: [] });
    }
  },
  addServer: async (serverData) => {
    await fetchWithAuth('/api/servers', { method: 'POST', body: JSON.stringify(serverData) });
    await get().fetchServers();
  },
  updateServer: async (id, serverData) => {
    await fetchWithAuth(`/api/servers/${id}`, { method: 'PUT', body: JSON.stringify(serverData) });
    await get().fetchServers();
  },
  deleteServer: async (id) => {
    await fetchWithAuth(`/api/servers/${id}`, { method: 'DELETE' });
    set((state) => ({ servers: state.servers.filter((s) => s.id !== id) }));
  },
}));

export type { Server };
