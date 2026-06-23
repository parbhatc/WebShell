import { useCallback, useEffect, useRef, useState } from 'react';
import { FileCode, Save, X } from 'lucide-react';
import { fetchFileContent, saveFileContent } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

interface RemoteFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number | null;
}

interface FileEditorProps {
  serverId: number;
  file: RemoteFile;
  onClose: () => void;
  onSaved: () => void;
}

export default function FileEditor({ serverId, file, onClose, onSaved }: FileEditorProps) {
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = content !== savedContent;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchFileContent(serverId, file.path)
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setSavedContent(text);
        }
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverId, file.path]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      await saveFileContent(serverId, file.path, content);
      setSavedContent(content);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [serverId, file.path, content, onSaved]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!loading && !saving) handleSave();
      }
      if (e.key === 'Escape') {
        if (isDirty && !confirm('Discard unsaved changes?')) return;
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, isDirty, loading, onClose, saving]);

  const handleClose = () => {
    if (isDirty && !confirm('Discard unsaved changes?')) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 backdrop-blur-sm">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
        <FileCode size={18} className="text-sky-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-100 truncate">{file.name}</p>
          <p className="text-xs text-slate-500 truncate">{file.path}</p>
        </div>
        {isDirty && <span className="text-xs text-amber-400 shrink-0">Unsaved</span>}
        <button
          onClick={handleSave}
          disabled={loading || saving || !isDirty}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors shrink-0"
        >
          <Save size={14} />
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={handleClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
          title="Close (Esc)"
        >
          <X size={18} />
        </button>
      </header>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 p-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <LoadingSpinner size={32} />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="w-full h-full resize-none bg-slate-900 border border-slate-700 rounded-lg p-4 font-mono text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-sky-500/50"
            autoFocus
          />
        )}
      </div>

      <footer className="px-4 py-2 border-t border-slate-800 text-xs text-slate-500 shrink-0">
        Ctrl+S to save · Esc to close · Max 1MB text files
      </footer>
    </div>
  );
}
