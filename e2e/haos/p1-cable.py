#!/usr/bin/env python3
"""The P1 cable: carries telegrams from the smart meter emulator to QEMU's USB serial device.

A serial line has no memory. Bytes that nobody reads are lost, so whoever opens the port gets
what the meter sends at that moment. A plain socket between the emulator and QEMU would queue
every telegram while the port is closed, and the add-on would then read telegrams that are
minutes old. This cable sends a telegram only when QEMU has taken the previous one, and drops it
otherwise.

QEMU connects to the Unix socket; the cable connects to the emulator over TCP.
"""

import fcntl
import os
import re
import selectors
import socket
import struct
import sys
import termios
import time

EMULATOR = (os.environ.get("P1_HOST", "p1"), int(os.environ.get("P1_PORT", "2001")))
SOCKET_PATH = sys.argv[1] if len(sys.argv) > 1 else "/run/p1-cable.sock"
TELEGRAM_END = re.compile(rb"![0-9A-F]{4}\r\n")
MAX_PARTIAL_TELEGRAM = 64 * 1024


def log(message: str) -> None:
    print(f"[p1-cable] {message}", flush=True)


def unread_bytes(connection: socket.socket) -> int:
    """Bytes sent to QEMU that it has not read yet (SIOCOUTQ, the same number as TIOCOUTQ)."""
    return struct.unpack("i", fcntl.ioctl(connection, termios.TIOCOUTQ, b"\0\0\0\0"))[0]


def connect_to_emulator() -> socket.socket:
    while True:
        try:
            connection = socket.create_connection(EMULATOR, timeout=5)
            connection.settimeout(None)
            log(f"connected to the meter at {EMULATOR[0]}:{EMULATOR[1]}")
            return connection
        except OSError as error:
            log(f"the meter at {EMULATOR[0]}:{EMULATOR[1]} is not reachable ({error}), retrying")
            time.sleep(2)


def main() -> None:
    if os.path.exists(SOCKET_PATH):
        os.unlink(SOCKET_PATH)
    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(SOCKET_PATH)
    server.listen(1)
    server.setblocking(False)

    selector = selectors.DefaultSelector()
    selector.register(server, selectors.EVENT_READ, "server")
    meter = connect_to_emulator()
    selector.register(meter, selectors.EVENT_READ, "meter")

    qemu = None
    pending = b""
    while True:
        for key, _ in selector.select():
            if key.data == "server":
                connection, _ = server.accept()
                if qemu is not None:
                    selector.unregister(qemu)
                    qemu.close()
                connection.setblocking(False)
                qemu = connection
                selector.register(qemu, selectors.EVENT_READ, "qemu")
                log("QEMU connected")

            elif key.data == "qemu":
                # A meter ignores what is sent to it; an empty read means QEMU went away.
                try:
                    closed = not qemu.recv(4096)
                except BlockingIOError:
                    closed = False
                except OSError:
                    closed = True
                if closed:
                    selector.unregister(qemu)
                    qemu.close()
                    qemu = None
                    log("QEMU disconnected")

            elif key.data == "meter":
                data = meter.recv(65536)
                if not data:
                    selector.unregister(meter)
                    meter.close()
                    log("the meter closed the connection")
                    meter = connect_to_emulator()
                    selector.register(meter, selectors.EVENT_READ, "meter")
                    pending = b""
                    continue
                pending += data
                while match := TELEGRAM_END.search(pending):
                    telegram, pending = pending[: match.end()], pending[match.end() :]
                    if qemu is None or unread_bytes(qemu) > 0:
                        continue  # nobody is reading the port: the telegram is lost
                    try:
                        qemu.send(telegram)
                    except OSError:
                        pass
                if len(pending) > MAX_PARTIAL_TELEGRAM:
                    pending = b""


if __name__ == "__main__":
    main()
