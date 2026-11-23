// Access to the Home Assistant OS VM: docker compose, a root shell on the host and the
// Supervisor API. Needs only Docker and Node on this machine.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const E2E_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const REPO_DIR = path.dirname(E2E_DIR);
export const HA_URL = `http://127.0.0.1:${process.env.E2E_HA_PORT ?? 18123}`;
/** Where a host port 7777-7779 of an add-on is reachable from this machine. */
export const addonUrl = (hostPort) => `http://127.0.0.1:${hostPort + 10000}`;

const COMPOSE = ['compose', '-f', path.join(E2E_DIR, 'compose.yaml')];

/** Quotes arguments for the shell on the other side of SSH. */
export const sh = (...args) =>
  args.map((arg) => `'${String(arg).replaceAll("'", `'\\''`)}'`).join(' ');

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a command and collects its output.
 * @param {string} command
 * @param {string[]} args
 * @param {{ input?: string | Buffer, check?: boolean, inherit?: boolean, timeout?: number }} [options]
 *   `check: false` returns a failed command's result instead of throwing.
 */
export function run(command, args, { input, check = true, inherit = false, timeout } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: inherit ? 'inherit' : [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      timeout,
    });
    const stdout = [];
    const stderr = [];
    child.stdout?.on('data', (chunk) => stdout.push(chunk));
    child.stderr?.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      const result = {
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString(),
        stdoutBuffer: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr).toString(),
      };
      if (check && result.code !== 0) {
        const reason = signal ? `was stopped by ${signal}` : `exited with ${result.code}`;
        const output = (result.stderr || result.stdout).trim();
        reject(new Error(`${command} ${args.join(' ')} ${reason}${output ? `:\n${output}` : ''}`));
      } else {
        resolve(result);
      }
    });
    if (input !== undefined) child.stdin.end(input);
  });
}

/** docker compose for the e2e project. */
export const compose = (args, options) => run('docker', [...COMPOSE, ...args], options);

/** Runs a shell command as root on the Home Assistant OS host. */
export const ssh = (command, options) =>
  compose(['exec', '-T', 'haos', 'haos-ssh', command], options);

/** Sends a command to the QEMU monitor, for example `info usb`. */
export const qemuMonitor = async (command) =>
  (await compose(['exec', '-T', 'haos', 'qemu-monitor', command])).stdout.trim();

const P1_CABLE = 'p1cable';

/** Whether the P1 cable is plugged into the VM. */
export const p1CablePlugged = async () => (await qemuMonitor('info usb')).includes(P1_CABLE);

/** Pulls the P1 cable out of the VM; /dev/ttyUSB0 disappears. */
export async function unplugP1Cable() {
  if (await p1CablePlugged()) await qemuMonitor(`device_del ${P1_CABLE}`);
}

/** Plugs the P1 cable back in. */
export async function plugP1Cable() {
  if (!(await p1CablePlugged())) {
    await qemuMonitor(`device_add usb-serial,chardev=p1,id=${P1_CABLE},bus=uhci.0`);
  }
}

/** The address of the smart meter's TCP port (2001) for add-ons; they cannot resolve its name. */
export const p1Address = async () =>
  (await compose(['exec', '-T', 'haos', 'getent', 'ahostsv4', 'p1'])).stdout.split(/\s+/)[0];

/**
 * The server every add-on in this repository asks for a newer version when it starts. It also
 * counts those requests as add-on usage, so the VM never reaches it: see `refuseUpdateServer()`.
 */
export const UPDATE_SERVER = 'api-check.duckdns.org';

async function addressesOf(hostname) {
  if (/^[\d.]+$|:/.test(hostname)) return [hostname];
  const { stdout } = await compose(['exec', '-T', 'haos', 'getent', 'ahosts', hostname]);
  const addresses = [...new Set(stdout.split('\n').map((line) => line.split(/\s+/)[0]).filter(Boolean))];
  if (addresses.length === 0) throw new Error(`Found no address for ${hostname}`);
  return addresses;
}

/** Inserts each iptables rule (`%s` = the flag) at the top of FORWARD, unless it is already there. */
async function insertRules(rules) {
  // -C first, so a rule left behind by an interrupted run is not added twice.
  await ssh(rules.map((rule) => `${rule.replace('%s', '-C')} 2>/dev/null || ${rule.replace('%s', '-I')}`).join(' && '));
}

const iptables = (address) => (address.includes(':') ? 'ip6tables' : 'iptables');

/**
 * Refuses connections from add-ons to `UPDATE_SERVER` while the VM runs, so test runs never
 * show up in the add-on usage statistics. The refusal is instant (a TCP reset), so it does not
 * hold up a start; add-ons log "Update check failed".
 *
 * nftables, not iptables: the Home Assistant OS kernel has no iptables REJECT module. Its own
 * chain runs after iptables' filter chain (priority 10), so a DROP from
 * `withServerUnreachable()` still makes the server hang, while Docker's ACCEPT rules do not skip
 * this chain. Runs on `up`, `install` and at the start of every test file (`requireVm()`): the
 * chain is gone after a reboot of the VM, and the server's address can change.
 */
export async function refuseUpdateServer() {
  const addresses = await addressesOf(UPDATE_SERVER);
  await ssh(
    [
      'nft add table inet e2e',
      "nft 'add chain inet e2e forward { type filter hook forward priority 10 ; }'",
      'nft flush chain inet e2e forward',
      ...addresses.map(
        (address) =>
          `nft add rule inet e2e forward ${address.includes(':') ? 'ip6' : 'ip'} daddr ${address} tcp flags syn reject with tcp reset`,
      ),
    ].join(' && '),
  );
}

/**
 * Runs `action` while add-ons cannot reach a server: packets to it are dropped on the Home
 * Assistant OS host, so a connection hangs as it does when a server is down.
 * @param {string} hostname a name on the internet, or the IP address of an add-on
 *   (`ip_address` in its info)
 * @param {() => Promise<T>} action
 * @returns {Promise<T>}
 * @template T
 */
export async function withServerUnreachable(hostname, action) {
  const rules = (await addressesOf(hostname)).map((address) => `${iptables(address)} %s FORWARD -d ${address} -j DROP`);
  await insertRules(rules);
  try {
    return await action();
  } finally {
    await ssh(rules.map((rule) => rule.replace('%s', '-D')).join('; '), { check: false });
  }
}

export class SupervisorError extends Error {}

const SUPERVISOR_CALL = `
body=$(printf %s "$3" | base64 -d)
set -- "$1" "$2" "$4"
if [ -n "$body" ]; then set -- "$@" -H 'Content-Type: application/json' --data-binary "$body"; fi
method=$1 path=$2 timeout=$3; shift 3
exec curl -sS -m "$timeout" -X "$method" -H "Authorization: Bearer $SUPERVISOR_TOKEN" "$@" "http://supervisor$path"
`;

/**
 * Calls the Supervisor API from the CLI container, which holds a Supervisor token.
 * @param {string} method
 * @param {string} apiPath for example `/addons/local_dsmr_reader/info`
 * @param {object} [body]
 * @param {{ timeout?: number, text?: boolean }} [options] timeout in seconds; `text` for log endpoints
 * @returns {Promise<any>} the `data` of the response
 */
export async function supervisor(method, apiPath, body, { timeout = 60, text = false } = {}) {
  const encoded = body === undefined ? '' : Buffer.from(JSON.stringify(body)).toString('base64');
  const { stdout } = await ssh(
    `docker exec hassio_cli sh -c ${sh(SUPERVISOR_CALL, 'sh', method.toUpperCase(), apiPath, encoded, timeout)}`,
  );
  if (text) return stdout;
  let response;
  try {
    response = JSON.parse(stdout);
  } catch {
    throw new SupervisorError(`${method} ${apiPath}: no JSON in the response: ${stdout.slice(0, 500)}`);
  }
  if (response.result !== 'ok') {
    throw new SupervisorError(`${method} ${apiPath}: ${response.message ?? stdout}`);
  }
  return response.data;
}

/**
 * Polls until `probe` returns a truthy value and returns it. Errors from `probe` count as
 * "not yet"; the last one is in the message when the time is up. An error with `fatal: true`
 * ends the wait at once.
 * @param {string} what for the error message
 * @param {() => Promise<any>} probe
 * @param {{ timeout?: number, interval?: number }} [options] both in seconds
 */
export async function waitFor(what, probe, { timeout = 120, interval = 2 } = {}) {
  const deadline = Date.now() + timeout * 1000;
  let lastError;
  for (;;) {
    try {
      const value = await probe();
      if (value) return value;
      lastError = undefined;
    } catch (error) {
      if (error.fatal) throw error;
      lastError = error;
    }
    if (Date.now() > deadline) {
      const detail = lastError ? `: ${lastError.message}` : '';
      throw new Error(`Timed out after ${timeout} s waiting for ${what}${detail}`);
    }
    await sleep(interval * 1000);
  }
}

/** Fails with a clear message when the VM is not up; tests call this first. */
export async function requireVm() {
  const { code } = await ssh('true', { check: false, timeout: 20_000 }).catch(() => ({ code: 1 }));
  if (code !== 0) {
    throw new Error('The Home Assistant OS VM is not running. Start it with: ./e2e/haos.mjs up');
  }
  await refuseUpdateServer();
}
