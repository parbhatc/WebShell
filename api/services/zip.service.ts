import { ZipArchive, type Archiver } from 'archiver';
import type { Response } from 'express';
import { PassThrough } from 'stream';
import type { SFTPWrapper } from 'ssh2';
import { joinPath, withSftp, writeRemoteBinaryFile } from './sftp.service.js';

const MAX_ZIP_BYTES = 200 * 1024 * 1024;

export interface ZipEntry {
  path: string;
  isDirectory: boolean;
}

function sftpReaddir(sftp: SFTPWrapper, path: string) {
  return new Promise<import('ssh2').FileEntry[]>((resolve, reject) => {
    sftp.readdir(path, (err, list) => (err ? reject(err) : resolve(list)));
  });
}

function sftpReadFile(sftp: SFTPWrapper, path: string) {
  return new Promise<Buffer>((resolve, reject) => {
    sftp.readFile(path, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

async function addPathToArchive(
  archive: Archiver,
  sftp: SFTPWrapper,
  remotePath: string,
  archiveName: string,
  isDirectory: boolean
): Promise<number> {
  let totalBytes = 0;

  if (isDirectory) {
    async function walk(dirPath: string, prefix: string) {
      const list = await sftpReaddir(sftp, dirPath);
      for (const entry of list) {
        if (entry.filename === '.' || entry.filename === '..') continue;
        const fullPath = joinPath(dirPath, entry.filename);
        const entryArchivePath = `${prefix}/${entry.filename}`;
        const isDir = (entry.attrs.mode & 0o40000) !== 0;
        if (isDir) {
          await walk(fullPath, entryArchivePath);
        } else {
          const data = await sftpReadFile(sftp, fullPath);
          totalBytes += data.length;
          if (totalBytes > MAX_ZIP_BYTES) throw new Error('Zip exceeds maximum size (200MB)');
          archive.append(data, { name: entryArchivePath });
        }
      }
    }
    await walk(remotePath, archiveName);
  } else {
    const data = await sftpReadFile(sftp, remotePath);
    totalBytes += data.length;
    if (totalBytes > MAX_ZIP_BYTES) throw new Error('Zip exceeds maximum size (200MB)');
    archive.append(data, { name: archiveName });
  }

  return totalBytes;
}

async function buildArchive(serverId: number, userId: number, entries: ZipEntry[]): Promise<Buffer> {
  return withSftp(serverId, userId, async (sftp) => {
    const archive = new ZipArchive({ zlib: { level: 6 } });
    const pass = new PassThrough();
    const chunks: Buffer[] = [];

    pass.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve, reject) => {
      pass.on('end', () => resolve(Buffer.concat(chunks)));
      pass.on('error', reject);
      archive.on('error', reject);
    });

    archive.pipe(pass);

    for (const entry of entries) {
      const name = entry.path.split('/').filter(Boolean).pop() || 'file';
      await addPathToArchive(archive, sftp, entry.path, name, entry.isDirectory);
    }

    await archive.finalize();
    return done;
  });
}

export async function zipPathsToDownload(
  serverId: number,
  userId: number,
  entries: ZipEntry[],
  res: Response,
  filename: string
): Promise<void> {
  const buffer = await buildArchive(serverId, userId, entries);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(buffer);
}

export async function zipPathsToRemote(
  serverId: number,
  userId: number,
  entries: ZipEntry[],
  outputPath: string
): Promise<void> {
  const buffer = await buildArchive(serverId, userId, entries);
  await writeRemoteBinaryFile(serverId, userId, outputPath, buffer);
}
