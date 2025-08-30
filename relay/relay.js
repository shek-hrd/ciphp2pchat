// Minimal WebSocket relay for Render
import { readFileSync } from 'fs';
import { createServer } from 'https';
import { WebSocketServer } from 'ws';

// If Render supplies a cert (it does), use it; otherwise create dummy ones.
const cert = process.env.RENDER ? undefined : readFileSync('cert.pem');
const key  = process.env.RENDER ? undefined : readFileSync('key.pem');

const server = createServer(cert && key ? { cert, key } : {});
const wss = new WebSocketServer({ server });

const peers = new Map();

wss.on('connection', ws => {
  ws.on('message', raw => {
    const msg = JSON.parse(raw);
    if (msg.type === 'join') {
      peers.set(msg.id, ws);
      ws.id = msg.id; ws.pub = msg.pub;
      broadcast({type:'peerlist', payload:[...peers].map(([id,,pub])=>({id,pub}))});
    } else if (msg.type === 'relay') {
      peers.get(msg.to)?.send(JSON.stringify({type:'msg', from:ws.id, payload:msg.payload}));
    }
  });
  ws.on('close', () => { peers.delete(ws.id); broadcastPeerlist(); });
});

const broadcast = o => [...peers.values()].forEach(ws => ws.send(JSON.stringify(o)));
const broadcastPeerlist = () => broadcast({type:'peerlist', payload:[...peers].map(([id,,pub])=>({id,pub}))});

const port = process.env.PORT || 443;
server.listen(port, () => console.log(`Relay listening on ${port}`));