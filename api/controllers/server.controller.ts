import { Response } from 'express';
import * as serverService from '../services/server.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getServers = async (req: AuthRequest, res: Response) => {
    try {
        const servers = await serverService.getServers(req.userId);
        res.status(200).json(servers);
    } catch (error) {
        res.status(500).json({ message: 'Error getting servers', error: error.message });
    }
};

export const createServer = async (req: AuthRequest, res: Response) => {
    try {
        const server = await serverService.createServer(req.body, req.userId);
        res.status(201).json({ message: 'Server created successfully', serverId: server.id });
    } catch (error) {
        res.status(500).json({ message: 'Error creating server', error: error.message });
    }
};

export const updateServer = async (req: AuthRequest, res: Response) => {
    try {
        const serverId = parseInt(req.params.id, 10);
        const server = await serverService.updateServer(serverId, req.body, req.userId);
        res.status(200).json({ message: 'Server updated successfully', serverId: server.id });
    } catch (error) {
        res.status(500).json({ message: 'Error updating server', error: error.message });
    }
};

export const deleteServer = async (req: AuthRequest, res: Response) => {
    try {
        const serverId = parseInt(req.params.id, 10);
        await serverService.deleteServer(serverId, req.userId);
        res.status(200).json({ message: 'Server deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting server', error: error.message });
    }
};

export const listFiles = async (req: AuthRequest, res: Response) => {
    try {
        const serverId = parseInt(req.params.id, 10);
        const remotePath = (req.query.path as string) || '/';
        const files = await serverService.listServerFiles(serverId, req.userId, remotePath);
        res.status(200).json(files);
    } catch (error) {
        res.status(500).json({ message: 'Error listing files', error: error.message });
    }
};

export const createFile = async (req: AuthRequest, res: Response) => {
    try {
        const serverId = parseInt(req.params.id, 10);
        const { path, type, content } = req.body;
        if (!path || !type) {
            return res.status(400).json({ message: 'path and type are required' });
        }
        if (type === 'directory') {
            await serverService.createServerDirectory(serverId, req.userId, path);
        } else {
            await serverService.createServerFile(serverId, req.userId, path, content ?? '');
        }
        res.status(201).json({ message: 'Created successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error creating file', error: error.message });
    }
};

export const deleteFile = async (req: AuthRequest, res: Response) => {
    try {
        const serverId = parseInt(req.params.id, 10);
        const remotePath = req.query.path as string;
        const isDirectory = req.query.isDirectory === 'true';
        if (!remotePath) {
            return res.status(400).json({ message: 'path is required' });
        }
        await serverService.deleteServerFile(serverId, req.userId, remotePath, isDirectory);
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting file', error: error.message });
    }
};

export const renameFile = async (req: AuthRequest, res: Response) => {
    try {
        const serverId = parseInt(req.params.id, 10);
        const { oldPath, newPath } = req.body;
        if (!oldPath || !newPath) {
            return res.status(400).json({ message: 'oldPath and newPath are required' });
        }
        await serverService.renameServerFile(serverId, req.userId, oldPath, newPath);
        res.status(200).json({ message: 'Renamed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error renaming file', error: error.message });
    }
};

export const downloadFile = async (req: AuthRequest, res: Response) => {
    try {
        const serverId = parseInt(req.params.id, 10);
        const remotePath = req.query.path as string;
        if (!remotePath) {
            return res.status(400).json({ message: 'path is required' });
        }
        await serverService.downloadServerFile(serverId, req.userId, remotePath, res);
    } catch (error) {
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error downloading file', error: error.message });
        }
    }
};

export const uploadFile = async (req: AuthRequest, res: Response) => {
    try {
        const serverId = parseInt(req.params.id, 10);
        const remotePath = req.query.path as string;
        if (!remotePath) {
            return res.status(400).json({ message: 'path is required' });
        }
        await serverService.uploadServerFile(serverId, req.userId, remotePath, req);
        res.status(201).json({ message: 'Uploaded successfully' });
    } catch (error) {
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error uploading file', error: error.message });
        }
    }
};

export const readFileContent = async (req: AuthRequest, res: Response) => {
    try {
        const serverId = parseInt(req.params.id, 10);
        const remotePath = req.query.path as string;
        if (!remotePath) {
            return res.status(400).json({ message: 'path is required' });
        }
        const result = await serverService.readServerFileContent(serverId, req.userId, remotePath);
        res.status(200).json({ path: remotePath, ...result });
    } catch (error) {
        res.status(500).json({ message: 'Error reading file', error: error.message });
    }
};

export const saveFileContent = async (req: AuthRequest, res: Response) => {
    try {
        const serverId = parseInt(req.params.id, 10);
        const remotePath = req.query.path as string;
        const { content } = req.body;
        if (!remotePath) {
            return res.status(400).json({ message: 'path is required' });
        }
        if (typeof content !== 'string') {
            return res.status(400).json({ message: 'content is required' });
        }
        await serverService.writeServerFileContent(serverId, req.userId, remotePath, content);
        res.status(200).json({ message: 'Saved successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error saving file', error: error.message });
    }
};
