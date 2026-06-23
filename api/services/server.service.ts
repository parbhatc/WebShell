import Server from '../models/Server';
import { encrypt, decrypt } from './crypto.service';
import { listRemoteFiles, createRemoteFile, createRemoteDirectory, deleteRemotePath, renameRemotePath, streamRemoteFileDownload, streamRemoteFileUpload, readRemoteFileContent, writeRemoteFileContent } from './sftp.service';

export const getServers = async (userId: number) => {
  const servers = await Server.findAll({ where: { userId } });
  return servers.map(server => ({
    id: server.get('id'),
    name: server.get('name'),
    host: server.get('host'),
    port: server.get('port'),
    username: server.get('username'),
    auth_method: server.get('auth_method'),
  }));
};

export const getServerDetails = async (id: number, userId: number) => {
    const server = await Server.findOne({
        where: { id, userId },
    });
    if (!server) {
        throw new Error('Server not found or access denied');
    }
    return {
        id: server.get('id'),
        name: server.get('name'),
        host: server.get('host'),
        port: server.get('port'),
        username: server.get('username'),
        auth_method: server.get('auth_method'),
        credentials: decrypt(server.get('encrypted_credentials')),
    };
}

export const createServer = async (data, userId: number) => {
  const { name, host, port, username, auth_method, credentials } = data;
  const encrypted_credentials = encrypt(credentials);

  const server = await Server.create({
    name,
    host,
    port,
    username,
    auth_method,
    encrypted_credentials,
    userId,
  });
  return server;
};

export const updateServer = async (id: number, data, userId: number) => {
    const { name, host, port, username, auth_method, credentials } = data;
    const serverToUpdate = await Server.findOne({ where: { id, userId }});
    if(!serverToUpdate) {
        throw new Error("Server not found or access denied");
    }

    const encrypted_credentials = credentials ? encrypt(credentials) : serverToUpdate.get('encrypted_credentials');

    const server = await serverToUpdate.update({
        name,
        host,
        port,
        username,
        auth_method,
        encrypted_credentials
    });
    return server;
};

export const deleteServer = async (id: number, userId: number) => {
    const serverToDelete = await Server.findOne({ where: { id, userId }});
    if(!serverToDelete) {
        throw new Error("Server not found or access denied");
    }
    await serverToDelete.destroy();
};

export const listServerFiles = async (id: number, userId: number, remotePath: string) => {
    return listRemoteFiles(id, userId, remotePath);
};

export const createServerFile = async (
  id: number,
  userId: number,
  remotePath: string,
  content = ''
) => createRemoteFile(id, userId, remotePath, content);

export const createServerDirectory = async (id: number, userId: number, remotePath: string) =>
  createRemoteDirectory(id, userId, remotePath);

export const deleteServerFile = async (
  id: number,
  userId: number,
  remotePath: string,
  isDirectory: boolean
) => deleteRemotePath(id, userId, remotePath, isDirectory);

export const renameServerFile = async (
  id: number,
  userId: number,
  oldPath: string,
  newPath: string
) => renameRemotePath(id, userId, oldPath, newPath);

export const downloadServerFile = async (
  id: number,
  userId: number,
  remotePath: string,
  res: import('express').Response
) => streamRemoteFileDownload(id, userId, remotePath, res);

export const uploadServerFile = async (
  id: number,
  userId: number,
  remotePath: string,
  source: import('stream').Readable
) => streamRemoteFileUpload(id, userId, remotePath, source);

export const readServerFileContent = async (id: number, userId: number, remotePath: string) =>
  readRemoteFileContent(id, userId, remotePath);

export const writeServerFileContent = async (
  id: number,
  userId: number,
  remotePath: string,
  content: string
) => writeRemoteFileContent(id, userId, remotePath, content);
