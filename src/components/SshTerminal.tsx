import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { getWebSocketUrl } from '@/lib/api';
import { useAuthStore } from '@/stores/useAuthStore';

interface SshTerminalProps {
  serverId: number;
}

const encoder = new TextEncoder();

export default function SshTerminal({ serverId }: SshTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!containerRef.current || !token) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      smoothScrollDuration: 0,
      theme: {
        background: '#000000',
        foreground: '#ffffff',
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;

      const isCopy = (event.ctrlKey || event.metaKey) && event.key === 'c';
      if (isCopy && term.hasSelection()) {
        event.preventDefault();
        const selection = term.getSelection();
        if (selection) {
          void navigator.clipboard.writeText(selection);
        }
        return false;
      }

      return true;
    });

    const ws = new WebSocket(getWebSocketUrl(serverId));
    ws.binaryType = 'arraybuffer';

    const sendResize = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    ws.onopen = () => {
      sendResize();
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data);
      } else {
        term.write(new Uint8Array(event.data));
      }
    };

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31mWebSocket connection failed\x1b[0m');
    };

    ws.onclose = () => {
      term.writeln('\r\n\x1b[33mConnection closed\x1b[0m');
    };

    const dataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data));
      }
    });

    const resizeDisposable = term.onResize(() => sendResize());

    const handleResize = () => {
      fitAddon.fit();
      sendResize();
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(containerRef.current);

    return () => {
      dataDisposable.dispose();
      resizeDisposable.dispose();
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
    // Only reconnect when switching servers — not on token refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  return <div ref={containerRef} className="h-full w-full" />;
}
