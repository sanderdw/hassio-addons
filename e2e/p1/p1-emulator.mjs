#!/usr/bin/env node
// Emulates a smart meter's P1 port. Every connected client receives one DSMR 5 telegram per
// interval, the way a P1 cable (or ser2net in front of one) delivers them.
//
// QEMU connects here and passes the bytes to its emulated FTDI USB serial device, so inside
// Home Assistant OS they arrive on /dev/ttyUSB0. An add-on can also connect directly to test a
// network socket input.
import net from 'node:net';
import { buildTelegram } from './telegram.mjs';

const port = Number(process.env.P1_PORT ?? 2001);
const intervalMs = Number(process.env.P1_INTERVAL_MS ?? 1000);
// A client that stops reading (the serial port is closed) must not build up a backlog.
const MAX_BUFFERED_BYTES = 16 * 1024;

const clients = new Set();
const log = (message) => console.log(`[p1] ${message}`);

const server = net.createServer((socket) => {
  const name = `${socket.remoteAddress}:${socket.remotePort}`;
  socket.setNoDelay(true);
  clients.add(socket);
  log(`${name} connected (${clients.size} connected)`);
  socket.on('data', () => {}); // a meter ignores what is sent to it
  socket.on('error', () => {});
  socket.on('close', () => {
    clients.delete(socket);
    log(`${name} disconnected (${clients.size} connected)`);
  });
});

let sent = 0;
function tick() {
  const telegram = buildTelegram(Math.floor(Date.now() / 1000));
  for (const socket of clients) {
    if (socket.writableLength <= MAX_BUFFERED_BYTES) socket.write(telegram, 'latin1');
  }
  sent += 1;
  if (sent % 300 === 0) log(`${sent} telegrams sent, ${clients.size} connected`);
}

server.listen(port, () => {
  log(`DSMR 5 telegrams every ${intervalMs} ms on port ${port}`);
  // Start on a whole second so each telegram carries a fresh timestamp.
  setTimeout(() => {
    tick();
    setInterval(tick, intervalMs);
  }, 1000 - (Date.now() % 1000));
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => process.exit(0));
}
