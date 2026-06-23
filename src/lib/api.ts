import { useAuthStore } from '@/stores/useAuthStore';

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, logout } = useAuthStore.getState();
  if (!refreshToken) {
    logout();
    return null;
  }

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      logout();
      return null;
    }

    const { accessToken, refreshToken: newRefreshToken } = await response.json();
    setTokens(accessToken, newRefreshToken);
    return accessToken;
  } catch {
    logout();
    return null;
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const token = useAuthStore.getState().token;
  return token || null;
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const doFetch = (accessToken: string | null) =>
    fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });

  let token = useAuthStore.getState().token;
  let response = await doFetch(token);

  if (response.status === 401) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    token = await refreshPromise;
    if (token) {
      response = await doFetch(token);
    }
  }

  return response;
}

export function getWebSocketUrl(serverId: number): string {
  const token = useAuthStore.getState().token;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.DEV
    ? `${window.location.hostname}:3001`
    : window.location.host;
  return `${protocol}//${host}/ws?token=${encodeURIComponent(token || '')}&serverId=${serverId}`;
}

async function withTokenRetry<T>(request: (token: string) => Promise<T>): Promise<T> {
  let token = useAuthStore.getState().token;
  if (!token) throw new Error('Not authenticated');

  try {
    return await request(token);
  } catch (err) {
    if ((err as { status?: number }).status !== 401) throw err;
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    token = await refreshPromise;
    if (!token) throw new Error('Not authenticated');
    return request(token);
  }
}

export async function downloadFileWithAuth(
  serverId: number,
  remotePath: string,
  filename: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  await withTokenRetry(async (token) => {
    const response = await fetch(
      `/api/servers/${serverId}/files/download?path=${encodeURIComponent(remotePath)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.status === 401) throw { status: 401 };
    if (!response.ok) throw new Error('Download failed');

    const contentLength = Number(response.headers.get('Content-Length') || 0);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Download failed');

    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (onProgress && contentLength) onProgress((received / contentLength) * 100);
    }

    const blob = new Blob(chunks);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}

export async function fetchFileContent(serverId: number, remotePath: string): Promise<string> {
  const response = await fetchWithAuth(
    `/api/servers/${serverId}/files/content?path=${encodeURIComponent(remotePath)}`
  );
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || data.message || 'Failed to load file');
  }
  const data = await response.json();
  return data.content;
}

export async function saveFileContent(
  serverId: number,
  remotePath: string,
  content: string
): Promise<void> {
  const response = await fetchWithAuth(
    `/api/servers/${serverId}/files/content?path=${encodeURIComponent(remotePath)}`,
    { method: 'PUT', body: JSON.stringify({ content }) }
  );
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || data.message || 'Failed to save file');
  }
}

export function uploadFileWithAuth(
  serverId: number,
  remotePath: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<void> {
  return withTokenRetry(
    (token) =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', `/api/servers/${serverId}/files/upload?path=${encodeURIComponent(remotePath)}`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100);
        };

        xhr.onload = () => {
          if (xhr.status === 401) reject({ status: 401 });
          else if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error('Upload failed'));
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(file);
      })
  );
}
