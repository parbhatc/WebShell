import { Client, ClientChannel } from 'ssh2';
import type { WebSocket } from 'ws';
import { getServerDetails } from './server.service';

function toBuffer(data: Buffer | ArrayBuffer | Buffer[]): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

function sendOutput(ws: WebSocket, data: Buffer) {
  if (ws.readyState === ws.OPEN) {
    ws.send(data, { binary: true });
  }
}

export const createSshConnection = async (ws: WebSocket, serverId: number, userId: number) => {
  let conn: Client | null = null;
  let stream: ClientChannel | null = null;

  try {
    const serverDetails = await getServerDetails(serverId, userId);
    conn = new Client();

    conn.on('ready', () => {
      conn!.shell({ term: 'xterm-256color', cols: 120, rows: 30 }, (err, shellStream) => {
        if (err) {
          ws.send(`Error starting shell: ${err.message}`);
          ws.close();
          conn?.end();
          return;
        }

        stream = shellStream;

        ws.on('message', (data, isBinary) => {
          if (!stream) return;

          if (!isBinary) {
            try {
              const msg = JSON.parse(data.toString());
              if (msg.type === 'resize' && msg.cols && msg.rows) {
                stream.setWindow(msg.rows, msg.cols, 0, 0);
                return;
              }
            } catch {
              // fall through — treat as terminal input
            }
          }

          stream.write(toBuffer(data as Buffer));
        });

        shellStream.on('data', (data: Buffer) => {
          sendOutput(ws, data);
        });

        shellStream.stderr.on('data', (data: Buffer) => {
          sendOutput(ws, data);
        });

        shellStream.on('close', () => {
          conn?.end();
        });

        ws.on('close', () => {
          shellStream.close();
          conn?.end();
        });
      });
    });

    conn.on('error', (err) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(`\r\nError: ${err.message}\r\n`);
        ws.close();
      }
    });

    conn.on('close', () => {
      if (ws.readyState === ws.OPEN) {
        ws.close();
      }
    });

    conn.connect({
      host: serverDetails.host,
      port: serverDetails.port,
      username: serverDetails.username,
      password: serverDetails.auth_method === 'password' ? serverDetails.credentials : undefined,
      privateKey: serverDetails.auth_method === 'key' ? serverDetails.credentials : undefined,
    });
  } catch (error) {
    if (ws.readyState === ws.OPEN) {
      ws.send(`Error: ${(error as Error).message}`);
      ws.close();
    }
    conn?.end();
  }
};
