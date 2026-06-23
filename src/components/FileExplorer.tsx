import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Download,
  File,
  FilePen,
  Folder,
  FolderUp,
  Home,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { downloadFileWithAuth, fetchWithAuth, uploadFileWithAuth } from '@/lib/api';
import FileEditor from '@/components/FileEditor';
import LoadingSpinner from '@/components/LoadingSpinner';

interface RemoteFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number | null;
}

interface FileExplorerProps {
  serverId: number;
}

interface ContextMenu {
  x: number;
  y: number;
  file: RemoteFile | null;
}

interface Transfer {
  name: string;
  progress: number;
  type: 'upload' | 'download';
}

function joinPath(basePath: string, name: string): string {
  if (basePath === '/') return `/${name}`;
  return `${basePath.replace(/\/$/, '')}/${name}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function pathStorageKey(serverId: number): string {
  return `file-explorer-path-${serverId}`;
}

function getSavedPath(serverId: number): string {
  return localStorage.getItem(pathStorageKey(serverId)) || '/';
}

function savePath(serverId: number, path: string) {
  localStorage.setItem(pathStorageKey(serverId), path);
}

export default function FileExplorer({ serverId }: FileExplorerProps) {
  const [currentPath, setCurrentPath] = useState(() => getSavedPath(serverId));
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [prompt, setPrompt] = useState<{ title: string; defaultValue: string; onSubmit: (value: string) => void } | null>(null);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [editingFile, setEditingFile] = useState<RemoteFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef('/');
  const cacheRef = useRef<Map<string, RemoteFile[]>>(new Map());

  const loadFiles = useCallback(
    async (path: string, { force = false } = {}) => {
      if (force) cacheRef.current.delete(path);
      const cached = !force ? cacheRef.current.get(path) : undefined;

      if (cached) {
        setFiles(cached);
        setCurrentPath(path);
        setNavigating(true);
      } else {
        setLoading(true);
      }
      setError('');

      try {
        const response = await fetchWithAuth(
          `/api/servers/${serverId}/files?path=${encodeURIComponent(path)}`
        );
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to load files');
        }
        const data: RemoteFile[] = await response.json();
        cacheRef.current.set(path, data);
        setFiles(data);
        setCurrentPath(path);
        savePath(serverId, path);
      } catch (err) {
        if (!cached && path !== '/') {
          savePath(serverId, '/');
          await loadFiles('/', { force: true });
          return;
        }
        if (!cached) {
          setError((err as Error).message);
          setFiles([]);
        }
      } finally {
        setLoading(false);
        setNavigating(false);
      }
    },
    [serverId]
  );

  const refreshCurrent = useCallback(() => {
    cacheRef.current.delete(currentPath);
    return loadFiles(currentPath, { force: true });
  }, [currentPath, loadFiles]);

  useEffect(() => {
    cacheRef.current.clear();
    const savedPath = getSavedPath(serverId);
    setCurrentPath(savedPath);
    loadFiles(savedPath);
  }, [serverId, loadFiles]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, []);

  const createItem = async (name: string, type: 'file' | 'directory', basePath = currentPath) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const path = joinPath(basePath, trimmed);
    const response = await fetchWithAuth(`/api/servers/${serverId}/files`, {
      method: 'POST',
      body: JSON.stringify({ path, type }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || data.error || 'Failed to create');
    }
    await loadFiles(basePath, { force: true });
  };

  const deleteItem = async (file: RemoteFile) => {
    if (!confirm(`Delete ${file.isDirectory ? 'folder' : 'file'} "${file.name}"?`)) return;
    const response = await fetchWithAuth(
      `/api/servers/${serverId}/files?path=${encodeURIComponent(file.path)}&isDirectory=${file.isDirectory}`,
      { method: 'DELETE' }
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || data.error || 'Failed to delete');
    }
    await refreshCurrent();
  };

  const renameItem = async (file: RemoteFile, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === file.name) return;
    const parent = file.path.replace(/\/[^/]+$/, '') || '/';
    const newPath = joinPath(parent, trimmed);
    const response = await fetchWithAuth(`/api/servers/${serverId}/files`, {
      method: 'PATCH',
      body: JSON.stringify({ oldPath: file.path, newPath }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || data.error || 'Failed to rename');
    }
    await refreshCurrent();
  };

  const downloadItem = async (file: RemoteFile) => {
    setTransfer({ name: file.name, progress: 0, type: 'download' });
    try {
      await downloadFileWithAuth(serverId, file.path, file.name, (pct) =>
        setTransfer({ name: file.name, progress: pct, type: 'download' })
      );
    } finally {
      setTransfer(null);
    }
  };

  const uploadFiles = async (fileList: FileList | File[], targetPath = currentPath) => {
    const items = Array.from(fileList);
    for (const file of items) {
      const remotePath = joinPath(targetPath, file.name);
      setTransfer({ name: file.name, progress: 0, type: 'upload' });
      try {
        await uploadFileWithAuth(serverId, remotePath, file, (pct) =>
          setTransfer({ name: file.name, progress: pct, type: 'upload' })
        );
      } finally {
        setTransfer(null);
      }
    }
    cacheRef.current.delete(targetPath);
    await loadFiles(targetPath, { force: true });
  };

  const prefetch = useCallback(
    (path: string) => {
      if (cacheRef.current.has(path)) return;
      fetchWithAuth(`/api/servers/${serverId}/files?path=${encodeURIComponent(path)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) cacheRef.current.set(path, data);
        })
        .catch(() => {});
    },
    [serverId]
  );

  const askName = (title: string, defaultValue: string, onSubmit: (value: string) => Promise<void>) => {
    setPrompt({
      title,
      defaultValue,
      onSubmit: async (value) => {
        setPrompt(null);
        try {
          await onSubmit(value);
        } catch (err) {
          setError((err as Error).message);
        }
      },
    });
  };

  const handleContextMenu = (e: React.MouseEvent, file: RemoteFile | null) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  const runAction = async (action: () => Promise<void>) => {
    setContextMenu(null);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const breadcrumbs = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean);

  const goUp = () => {
    if (currentPath === '/') return;
    const parent = currentPath.replace(/\/[^/]+$/, '') || '/';
    loadFiles(parent);
  };

  const navigateTo = (index: number) => {
    if (index < 0) loadFiles('/');
    else loadFiles('/' + breadcrumbs.slice(0, index + 1).join('/'));
  };

  const menuActions = (file: RemoteFile | null) => {
    if (!file) {
      return [
        { label: 'Upload Files', icon: Upload, onClick: () => { uploadTargetRef.current = currentPath; fileInputRef.current?.click(); } },
        { label: 'New File', icon: Plus, onClick: () => askName('New file name', 'untitled.txt', (n) => createItem(n, 'file')) },
        { label: 'New Folder', icon: FolderUp, onClick: () => askName('New folder name', 'newfolder', (n) => createItem(n, 'directory')) },
        { label: 'Refresh', icon: RefreshCw, onClick: () => refreshCurrent() },
      ];
    }
    if (file.isDirectory) {
      return [
        { label: 'Open', icon: Folder, onClick: () => loadFiles(file.path) },
        { label: 'Upload Here', icon: Upload, onClick: () => { uploadTargetRef.current = file.path; fileInputRef.current?.click(); } },
        { label: 'New File', icon: Plus, onClick: () => askName('New file name', 'untitled.txt', (n) => createItem(n, 'file', file.path)) },
        { label: 'New Folder', icon: FolderUp, onClick: () => askName('New folder name', 'newfolder', (n) => createItem(n, 'directory', file.path)) },
        { label: 'Rename', icon: Pencil, onClick: () => askName('Rename folder', file.name, (n) => renameItem(file, n)) },
        { label: 'Delete', icon: Trash2, onClick: () => deleteItem(file), danger: true },
      ];
    }
    return [
      { label: 'Edit', icon: FilePen, onClick: () => setEditingFile(file) },
      { label: 'Download', icon: Download, onClick: () => downloadItem(file) },
      { label: 'Rename', icon: Pencil, onClick: () => askName('Rename file', file.name, (n) => renameItem(file, n)) },
      { label: 'Delete', icon: Trash2, onClick: () => deleteItem(file), danger: true },
    ];
  };

  return (
    <div className="flex flex-col h-full min-h-0 relative select-none">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) uploadFiles(e.target.files, uploadTargetRef.current);
          uploadTargetRef.current = currentPath;
          e.target.value = '';
        }}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-1 mb-3 shrink-0">
        <button onClick={() => loadFiles('/')} className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="Home">
          <Home size={15} />
        </button>
        <button onClick={() => { uploadTargetRef.current = currentPath; fileInputRef.current?.click(); }} className="p-1.5 rounded-md hover:bg-emerald-500/20 text-emerald-400 transition-colors" title="Upload">
          <Upload size={15} />
        </button>
        <button onClick={() => askName('New file name', 'untitled.txt', (n) => createItem(n, 'file'))} className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="New file">
          <Plus size={15} />
        </button>
        <button onClick={() => askName('New folder name', 'newfolder', (n) => createItem(n, 'directory'))} className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="New folder">
          <FolderUp size={15} />
        </button>
        <button onClick={() => refreshCurrent()} className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors ml-auto" title="Refresh">
          <RefreshCw size={15} className={loading || navigating ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-0.5 text-xs text-slate-400 mb-3 overflow-x-auto pb-1 shrink-0">
        <button onClick={() => navigateTo(-1)} className="hover:text-sky-400 shrink-0 transition-colors">root</button>
        {breadcrumbs.map((part, i) => (
          <span key={i} className="flex items-center gap-0.5 shrink-0">
            <ChevronRight size={12} className="text-slate-600" />
            <button onClick={() => navigateTo(i)} className="hover:text-sky-400 transition-colors">{part}</button>
          </span>
        ))}
      </div>

      {/* Transfer progress */}
      {transfer && (
        <div className="mb-3 p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/50 shrink-0">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-300 truncate mr-2">
              {transfer.type === 'upload' ? 'Uploading' : 'Downloading'} {transfer.name}
            </span>
            <span className="text-sky-400 font-mono shrink-0">{Math.round(transfer.progress)}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full transition-all duration-150"
              style={{ width: `${transfer.progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-3 px-2.5 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex justify-between items-center shrink-0">
          <span className="truncate">{error}</span>
          <button onClick={() => setError('')} className="ml-2 shrink-0 hover:text-red-300">✕</button>
        </div>
      )}

      {/* File list */}
      <div
        className={`flex flex-col flex-1 min-h-0 rounded-lg border transition-colors ${
          dragOver ? 'border-sky-500 bg-sky-500/5' : 'border-slate-700/50 bg-slate-900/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
        }}
        onContextMenu={(e) => handleContextMenu(e, null)}
      >
        <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-700/50 shrink-0">
          <span>Name</span>
          <span>Size</span>
        </div>

        <ul className="flex-1 overflow-y-auto min-h-0 pb-2">
          {loading && files.length === 0 && currentPath === '/' && (
            <li className="px-3 py-8 flex justify-center">
              <LoadingSpinner />
            </li>
          )}
          {(loading || navigating) && files.length > 0 && (
            <li className="px-3 py-1 flex justify-center border-b border-slate-800/50">
              <LoadingSpinner size={16} />
            </li>
          )}
          {currentPath !== '/' && (
            <li>
              <button
                onClick={goUp}
                className="w-full grid grid-cols-[1fr_auto] gap-2 items-center px-3 py-2 hover:bg-white/5 border-b border-slate-800/50 transition-colors group"
              >
                <span className="flex items-center gap-2 min-w-0 text-left">
                  <FolderUp size={16} className="text-slate-500 shrink-0 group-hover:text-sky-400 transition-colors" />
                  <span className="truncate text-sm text-slate-400 group-hover:text-slate-200">..</span>
                </span>
                <span className="text-xs text-slate-600 shrink-0">parent</span>
              </button>
            </li>
          )}
          {files.map((file) => (
            <li key={file.path}>
              <button
                onClick={() => (file.isDirectory ? loadFiles(file.path) : setEditingFile(file))}
                onMouseEnter={() => file.isDirectory && prefetch(file.path)}
                onDoubleClick={() => !file.isDirectory && setEditingFile(file)}
                onContextMenu={(e) => handleContextMenu(e, file)}
                className="w-full grid grid-cols-[1fr_auto] gap-2 items-center px-3 py-2 hover:bg-white/5 border-b border-slate-800/50 transition-colors group"
              >
                <span className="flex items-center gap-2 min-w-0 text-left">
                  {file.isDirectory ? (
                    <Folder size={16} className="text-amber-400 shrink-0" />
                  ) : (
                    <File size={16} className="text-slate-400 shrink-0 group-hover:text-sky-400 transition-colors" />
                  )}
                  <span className={`truncate text-sm ${file.isDirectory ? 'text-slate-200' : 'text-slate-300'}`}>
                    {file.name}
                  </span>
                </span>
                <span className="text-xs text-slate-500 font-mono shrink-0">
                  {file.isDirectory ? '' : formatSize(file.size)}
                </span>
              </button>
            </li>
          ))}
          {!loading && !error && files.length === 0 && (
            <li className="px-3 py-10 text-center">
              <Upload size={24} className="mx-auto text-slate-600 mb-2" />
              <p className="text-slate-500 text-sm">Drop files here to upload</p>
            </li>
          )}
        </ul>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[180px] bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 text-sm backdrop-blur-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {menuActions(contextMenu.file).map((action) => (
            <button
              key={action.label}
              onClick={() => runAction(action.onClick)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors ${
                action.danger ? 'text-red-400' : 'text-slate-200'
              }`}
            >
              <action.icon size={14} className={action.danger ? 'text-red-400' : 'text-slate-400'} />
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Prompt modal */}
      {prompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPrompt(null)}>
          <form
            className="bg-slate-900 border border-slate-700 p-5 rounded-xl shadow-2xl w-80"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.elements.namedItem('name') as HTMLInputElement).value;
              prompt.onSubmit(input);
            }}
          >
            <label className="block text-sm font-medium text-slate-200 mb-3">{prompt.title}</label>
            <input
              name="name"
              defaultValue={prompt.defaultValue}
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 focus:border-sky-500 focus:outline-none mb-4 text-sm text-slate-100"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPrompt(null)} className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-sm font-medium transition-colors">
                OK
              </button>
            </div>
          </form>
        </div>
      )}

      {editingFile && (
        <FileEditor
          serverId={serverId}
          file={editingFile}
          onClose={() => setEditingFile(null)}
          onSaved={() => refreshCurrent()}
        />
      )}
    </div>
  );
}
