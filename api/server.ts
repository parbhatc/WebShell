/**
 * local server entry file, for local development
 */
import http from 'http';
import { WebSocketServer } from 'ws';
import url from 'url';
import jwt from 'jsonwebtoken';
import app from './app.js';
import { JWT_SECRET } from './lib/jwt.js';
import { createSshConnection } from './services/ssh.service.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

httpServer.on('upgrade', (request, socket, head) => {
  socket.setNoDelay(true);
  const { pathname, query } = url.parse(request.url, true);

  if (pathname === '/ws') {
    const token = query.token as string;
    const serverId = parseInt(query.serverId as string, 10);

    if (!token || !serverId) {
      socket.destroy();
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, decoded.userId, serverId);
      });
    } catch (err) {
      socket.destroy();
    }
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, request, userId, serverId) => {
  createSshConnection(ws, serverId, userId);
});

import { sequelize } from './lib/db.js';
import './models/RefreshToken.js';

const server = httpServer.listen(PORT, async () => {
  await sequelize.sync();
  console.log(`Server ready on port ${PORT}`);
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;