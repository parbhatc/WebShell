import { Readable } from 'stream';
import type { Response } from 'express';
import { Client, SFTPWrapper } from 'ssh2';
import { getServerDetails } from './server.service';

export interface RemoteFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: number | null;
}

type ServerDetails = Awaited<ReturnType<typeof getServerDetails>>;

interface PooledSession {
  conn: Client;
  sftp: SFTPWrapper;
  lastUsed: number;
}

const sessionPool = new Map<string, PooledSession>();
const pendingConnects = new Map<string, Promise<PooledSession>>();
const IDLE_TIMEOUT_MS = 60_000;

function poolKey(userId: number, serverId: number): string {
  return `${userId}:${serverId}`;
}

function connect(serverDetails: ServerDetails): Promise<{ conn: Client; sftp: SFTPWrapper }> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }
          resolve({ conn, sftp });
        });
      })
      .on('error', reject)
      .connect({
        host: serverDetails.host,
        port: serverDetails.port,
        username: serverDetails.username,
        password: serverDetails.auth_method === 'password' ? serverDetails.credentials : undefined,
        privateKey: serverDetails.auth_method === 'key' ? serverDetails.credentials : undefined,
        readyTimeout: 10000,
        keepaliveInterval: 10000,
      });
  });
}

async function getSession(serverId: number, userId: number): Promise<PooledSession> {
  const key = poolKey(userId, serverId);
  const existing = sessionPool.get(key);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing;
  }

  const pending = pendingConnects.get(key);
  if (pending) return pending;

  const connectPromise = (async () => {
    const serverDetails = await getServerDetails(serverId, userId);
    const { conn, sftp } = await connect(serverDetails);
    const session: PooledSession = { conn, sftp, lastUsed: Date.now() };

    const remove = () => {
      sessionPool.delete(key);
      pendingConnects.delete(key);
    };

    conn.on('close', remove);
    conn.on('error', remove);

    sessionPool.set(key, session);
    pendingConnects.delete(key);
    return session;
  })();

  pendingConnects.set(key, connectPromise);
  return connectPromise;
}

function touchSession(userId: number, serverId: number) {
  const session = sessionPool.get(poolKey(userId, serverId));
  if (session) session.lastUsed = Date.now();
}

export function invalidateSession(userId: number, serverId: number) {
  const key = poolKey(userId, serverId);
  const session = sessionPool.get(key);
  if (session) {
    session.conn.end();
    sessionPool.delete(key);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessionPool) {
    if (now - session.lastUsed > IDLE_TIMEOUT_MS) {
      session.conn.end();
      sessionPool.delete(key);
    }
  }
}, 15_000);

export async function withSftp<T>(
  serverId: number,
  userId: number,
  fn: (sftp: SFTPWrapper) => Promise<T>
): Promise<T> {
  const session = await getSession(serverId, userId);
  session.lastUsed = Date.now();
  try {
    return await fn(session.sftp);
  } catch (err) {
    // Drop stale connections so the next call reconnects
    invalidateSession(userId, serverId);
    throw err;
  }
}

function sftpCallback<T>(
  fn: (callback: (err: Error | null | undefined, result?: T) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((err, result) => {
      if (err) reject(err);
      else resolve(result as T);
    });
  });
}

function parseDirEntries(path: string, list: import('ssh2').FileEntry[]): RemoteFile[] {
  return list
    .filter((entry) => entry.filename !== '.' && entry.filename !== '..')
    .map((entry) => {
      const isDirectory = (entry.attrs.mode & 0o40000) !== 0;
      return {
        name: entry.filename,
        path: joinPath(path, entry.filename),
        isDirectory,
        size: entry.attrs.size,
        modifiedAt: entry.attrs.mtime ? entry.attrs.mtime * 1000 : null,
      };
    })
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function joinPath(basePath: string, name: string): string {
  if (basePath === '/') return `/${name}`;
  return `${basePath.replace(/\/$/, '')}/${name}`;
}

export const listRemoteFiles = async (
  serverId: number,
  userId: number,
  remotePath = '/'
): Promise<RemoteFile[]> => {
  const path = remotePath || '/';

  return withSftp(serverId, userId, (sftp) =>
    sftpCallback((cb) => sftp.readdir(path, cb)).then((list) => parseDirEntries(path, list))
  );
};

export const createRemoteFile = async (
  serverId: number,
  userId: number,
  remotePath: string,
  content = ''
): Promise<void> => {
  await withSftp(serverId, userId, (sftp) =>
    sftpCallback((cb) => sftp.writeFile(remotePath, content, cb))
  );
  touchSession(userId, serverId);
};

export const createRemoteDirectory = async (
  serverId: number,
  userId: number,
  remotePath: string
): Promise<void> => {
  await withSftp(serverId, userId, (sftp) =>
    sftpCallback((cb) => sftp.mkdir(remotePath, cb))
  );
  touchSession(userId, serverId);
};

export const deleteRemotePath = async (
  serverId: number,
  userId: number,
  remotePath: string,
  isDirectory: boolean
): Promise<void> => {
  await withSftp(serverId, userId, (sftp) =>
    isDirectory
      ? sftpCallback((cb) => sftp.rmdir(remotePath, cb))
      : sftpCallback((cb) => sftp.unlink(remotePath, cb))
  );
  touchSession(userId, serverId);
};

export const renameRemotePath = async (
  serverId: number,
  userId: number,
  oldPath: string,
  newPath: string
): Promise<void> => {
  await withSftp(serverId, userId, (sftp) =>
    sftpCallback((cb) => sftp.rename(oldPath, newPath, cb))
  );
  touchSession(userId, serverId);
};

const MAX_EDIT_BYTES = 1024 * 1024;

function isBinaryBuffer(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  return sample.includes(0);
}

export const readRemoteFileContent = async (
  serverId: number,
  userId: number,
  remotePath: string
): Promise<{ content: string; size: number }> => {
  const buffer = await withSftp(serverId, userId, (sftp) =>
    sftpCallback<Buffer>((cb) => sftp.readFile(remotePath, cb))
  );

  if (buffer.length > MAX_EDIT_BYTES) {
    throw new Error(`File too large to edit (max ${MAX_EDIT_BYTES / 1024 / 1024}MB)`);
  }
  if (isBinaryBuffer(buffer)) {
    throw new Error('Cannot edit binary files');
  }

  touchSession(userId, serverId);
  return { content: buffer.toString('utf8'), size: buffer.length };
};

export const writeRemoteFileContent = async (
  serverId: number,
  userId: number,
  remotePath: string,
  content: string
): Promise<void> => {
  if (Buffer.byteLength(content, 'utf8') > MAX_EDIT_BYTES) {
    throw new Error(`File too large to save (max ${MAX_EDIT_BYTES / 1024 / 1024}MB)`);
  }
  await withSftp(serverId, userId, (sftp) =>
    sftpCallback((cb) => sftp.writeFile(remotePath, content, 'utf8', cb))
  );
  touchSession(userId, serverId);
};

export const writeRemoteBinaryFile = async (
  serverId: number,
  userId: number,
  remotePath: string,
  data: Buffer
): Promise<void> => {
  await withSftp(serverId, userId, (sftp) =>
    sftpCallback((cb) => sftp.writeFile(remotePath, data, cb))
  );
  touchSession(userId, serverId);
};

const CHUNK_SIZE = 256 * 1024;

export const streamRemoteFileDownload = async (
  serverId: number,
  userId: number,
  remotePath: string,
  res: Response
): Promise<void> => {
  const session = await getSession(serverId, userId);
  const { conn, sftp } = session;
  const filename = remotePath.split('/').pop() || 'download';

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

  await new Promise<void>((resolve, reject) => {
    const readStream = sftp.createReadStream(remotePath, { highWaterMark: CHUNK_SIZE });

    const cleanup = () => {
      session.lastUsed = Date.now();
    };

    readStream.on('error', (err) => {
      invalidateSession(userId, serverId);
      cleanup();
      reject(err);
    });
    res.on('error', (err) => {
      readStream.destroy();
      cleanup();
      reject(err);
    });
    res.on('finish', () => {
      cleanup();
      resolve();
    });
    readStream.pipe(res);
  });
};

export const streamRemoteFileUpload = async (
  serverId: number,
  userId: number,
  remotePath: string,
  source: Readable
): Promise<void> => {
  const session = await getSession(serverId, userId);
  const { sftp } = session;

  await new Promise<void>((resolve, reject) => {
    const writeStream = sftp.createWriteStream(remotePath, { highWaterMark: CHUNK_SIZE });

    const cleanup = () => {
      session.lastUsed = Date.now();
    };

    writeStream.on('close', () => {
      cleanup();
      resolve();
    });
    writeStream.on('error', (err) => {
      source.destroy();
      invalidateSession(userId, serverId);
      cleanup();
      reject(err);
    });
    source.on('error', (err) => {
      writeStream.destroy();
      invalidateSession(userId, serverId);
      cleanup();
      reject(err);
    });
    source.pipe(writeStream);
  });
};
