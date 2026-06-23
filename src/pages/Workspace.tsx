import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Server } from 'lucide-react';
import { useServerStore } from '@/stores/useServerStore';
import SshTerminal from '@/components/SshTerminal';
import FileExplorer from '@/components/FileExplorer';
import HorizontalResizeHandle from '@/components/HorizontalResizeHandle';

const FILES_PANEL_MIN = 180;
const TERMINAL_MIN = 100;
const FILES_PANEL_DEFAULT = 320;
const SERVERS_SIDEBAR_WIDTH = 192;
const RESIZE_HANDLE_WIDTH = 6;

function clampFilesPanelWidth(width: number, containerWidth: number, serversOpen: boolean): number {
  const serversWidth = serversOpen ? SERVERS_SIDEBAR_WIDTH : 0;
  const maxFiles = containerWidth - serversWidth - TERMINAL_MIN - RESIZE_HANDLE_WIDTH;
  return Math.min(maxFiles, Math.max(FILES_PANEL_MIN, width));
}

function getSavedFilesPanelWidth(): number {
  const saved = localStorage.getItem('files-panel-width');
  const n = saved ? parseInt(saved, 10) : FILES_PANEL_DEFAULT;
  if (Number.isNaN(n)) return FILES_PANEL_DEFAULT;
  return Math.max(FILES_PANEL_MIN, n);
}

export default function WorkspacePage() {
  const { id } = useParams();
  const serverId = parseInt(id || '0', 10);
  const { servers, fetchServers } = useServerStore();
  const server = servers.find((s) => s.id === serverId);
  const [serversOpen, setServersOpen] = useState(
    () => localStorage.getItem('servers-sidebar') !== 'closed'
  );
  const [filesPanelWidth, setFilesPanelWidth] = useState(getSavedFilesPanelWidth);
  const contentRef = useRef<HTMLDivElement>(null);

  const clampToContainer = useCallback(
    (width: number) => {
      const containerWidth = contentRef.current?.clientWidth ?? window.innerWidth;
      return clampFilesPanelWidth(width, containerWidth, serversOpen);
    },
    [serversOpen]
  );

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  useEffect(() => {
    setFilesPanelWidth((w) => clampToContainer(w));
  }, [clampToContainer]);

  useEffect(() => {
    const onWindowResize = () => setFilesPanelWidth((w) => clampToContainer(w));
    window.addEventListener('resize', onWindowResize);
    return () => window.removeEventListener('resize', onWindowResize);
  }, [clampToContainer]);

  useEffect(() => {
    localStorage.setItem('servers-sidebar', serversOpen ? 'open' : 'closed');
  }, [serversOpen]);

  useEffect(() => {
    localStorage.setItem('files-panel-width', String(filesPanelWidth));
  }, [filesPanelWidth]);

  const onFilesPanelResize = useCallback(
    (deltaX: number) => {
      setFilesPanelWidth((w) => clampToContainer(w - deltaX));
    },
    [clampToContainer]
  );

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
      <div ref={contentRef} className="flex flex-grow overflow-hidden min-h-0">
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

        <div className="flex-grow bg-black p-2 min-w-0" style={{ minWidth: TERMINAL_MIN }}>
          <SshTerminal serverId={serverId} />
        </div>

        <HorizontalResizeHandle onDrag={onFilesPanelResize} />

        <div
          style={{ width: filesPanelWidth }}
          className="bg-slate-950 border-l border-slate-800 p-4 overflow-hidden shrink-0 flex flex-col min-h-0"
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4 shrink-0">Files</h2>
          <div className="flex-1 min-h-0">
            <FileExplorer serverId={serverId} />
          </div>
        </div>
      </div>
    </div>
  );
}
