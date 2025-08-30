// relay.js  (runs on Render public Web Service)
import { createServer } from 'http';   // plain HTTP
import { WebSocketServer } from 'ws';

const port = process.env.PORT || 3000;  // Render injects PORT
const server = createServer((req, res) => {
  // Very small HTTP handler for health-check & /ping
  if (req.url === '/ping') {
    res.writeHead(200);
    res.end('pong');
  } else if (req.url === '/dummy256k.bin') {
    // 256 kB dummy file (bandwidth test)
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    res.end(Buffer.alloc(256 * 1024));
  } else {
    res.writeHead(404);
    res.end('not found');
  }
});

const wss = new WebSocketServer({ server });

const peers = new Map();

wss.on('connection', ws => {
  ws.on('message', raw => {
    const msg = JSON.parse(raw);
    if (msg.type === 'join') {
      peers.set(msg.id, ws);
      ws.id = msg.id;
      ws.pub = msg.pub;
      broadcast({ type: 'peerlist', payload: [...peers].map(([id,,pub]) => ({ id, pub })) });
    } else if (msg.type === 'relay') {
      peers.get(msg.to)?.send(JSON.stringify({ type: 'msg', from: ws.id, payload: msg.payload }));
    }
  });
  ws.on('close', () => {
    peers.delete(ws.id);
    broadcast({ type: 'peerlist', payload: [...peers].map(([id,,pub]) => ({ id, pub })) });
  });
});

function broadcast(obj) {
  [...peers.values()].forEach(ws => ws.send(JSON.stringify(obj)));
}

server.listen(port, '0.0.0.0', () => console.log(`Listening on 0.0.0.0:${port}`));