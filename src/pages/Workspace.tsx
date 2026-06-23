import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Server } from 'lucide-react';
import { useServerStore } from '@/stores/useServerStore';
import SshTerminal from '@/components/SshTerminal';
import FileExplorer from '@/components/FileExplorer';

export default function WorkspacePage() {
  const { id } = useParams();
  const serverId = parseInt(id || '0', 10);
  const { servers, fetchServers } = useServerStore();
  const server = servers.find((s) => s.id === serverId);
  const [serversOpen, setServersOpen] = useState(
    () => localStorage.getItem('servers-sidebar') !== 'closed'
  );

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  useEffect(() => {
    localStorage.setItem('servers-sidebar', serversOpen ? 'open' : 'closed');
  }, [serversOpen]);

  if (!serverId) {
    return (
      <div className="h-screen bg-gray-900 text-white flex items-center justify-center">
        Invalid server ID
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      <header className="bg-gray-800 p-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-blue-400 hover:underline">
            ← Dashboard
          </Link>
          <button
            onClick={() => setServersOpen((v) => !v)}
            className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title={serversOpen ? 'Hide servers' : 'Show servers'}
          >
            {serversOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
        </div>
        <span>
          Connected to{' '}
          <strong>
            {server ? `${server.name} (${server.username}@${server.host}:${server.port})` : `Server #${serverId}`}
          </strong>
        </span>
        <span className="w-24" />
      </header>
      <div className="flex flex-grow overflow-hidden min-h-0">
        {serversOpen && (
          <div className="w-48 bg-slate-900 border-r border-slate-800 p-4 overflow-y-auto shrink-0">
            <div className="flex items-center gap-2 mb-4 text-slate-400">
              <Server size={15} />
              <h2 className="text-xs font-semibold uppercase tracking-wider">Servers</h2>
            </div>
            <ul className="space-y-0.5 text-sm">
              {servers.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/server/${s.id}/session`}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors ${
                      s.id === serverId
                        ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                        : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <Server size={14} className={s.id === serverId ? 'text-sky-400' : 'text-slate-500'} />
                    <span className="truncate">{s.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex-grow bg-black p-2 min-w-0">
          <SshTerminal serverId={serverId} />
        </div>

        <div className="w-80 bg-slate-950 border-l border-slate-800 p-4 overflow-hidden shrink-0 flex flex-col min-h-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4 shrink-0">Files</h2>
          <div className="flex-1 min-h-0">
            <FileExplorer serverId={serverId} />
          </div>
        </div>
      </div>
    </div>
  );
}
