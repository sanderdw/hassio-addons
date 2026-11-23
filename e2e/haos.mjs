#!/usr/bin/env node
// Controls the local Home Assistant OS test VM. See e2e/README.md.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  addonInfo,
  containerName,
  installLocalAddon,
  waitForSupervisor,
} from './lib/addons.mjs';
import { E2E_USER, accessToken } from './lib/homeassistant.mjs';
import {
  E2E_DIR,
  HA_URL,
  REPO_DIR,
  compose,
  p1CablePlugged,
  plugP1Cable,
  qemuMonitor,
  refuseUpdateServer,
  sh,
  ssh,
  supervisor,
  unplugP1Cable,
} from './lib/vm.mjs';

const USAGE = `Usage: ./e2e/haos.mjs <command>

  up                    Start the VM and wait until Home Assistant is ready (first run: ~10 minutes)
  down                  Shut the VM down; its disk is kept
  reset                 Delete the VM's disk; the next "up" installs Home Assistant from scratch
  status                Show versions, add-ons and the emulated P1 cable
  test [files...]       Run the e2e tests (default: all of e2e/tests)
  install <add-on dir>  Build and install an add-on from the working tree, for example: install dsmr_reader
  ssh [command]         Root shell on the Home Assistant OS host
  ha <args...>          The Home Assistant CLI, for example: ha apps logs local_dsmr_reader
  logs [slug]           Follow the log of an add-on, or of the VM without a slug
  usb unplug|plug       Pull out or plug in the P1 cable
  monitor <command>     Send a command to the QEMU monitor, for example: monitor info usb
`;

/** Runs a command attached to this terminal and returns its exit code. */
function attach(command, args) {
  return spawnSync(command, args, { stdio: 'inherit' }).status ?? 1;
}

const composeAttached = (args) =>
  attach('docker', ['compose', '-f', path.join(E2E_DIR, 'compose.yaml'), ...args]);

async function up() {
  await compose(['up', '-d', '--build'], { inherit: true });
  console.log('Waiting for Home Assistant OS, the Supervisor and Home Assistant Core...');
  await waitForSupervisor();

  const core = await supervisor('get', '/core/info');
  const forwarded = Number(process.env.HAOS_HA_PORT ?? 80);
  if (core.port !== forwarded) {
    throw new Error(
      `Home Assistant Core listens on port ${core.port} in the VM, but port ${forwarded} is forwarded. ` +
        `Run "down", then "up" with HAOS_HA_PORT=${core.port}.`,
    );
  }
  await accessToken();
  await refuseUpdateServer();
  await status();
}

async function status() {
  const running = (await ssh('true', { check: false, timeout: 20_000 }).catch(() => ({ code: 1 }))).code === 0;
  if (!running) {
    console.log('The VM is not running. Start it with: ./e2e/haos.mjs up');
    return 1;
  }
  const [info, { addons }, plugged, serial] = await Promise.all([
    supervisor('get', '/info'),
    supervisor('get', '/addons'),
    p1CablePlugged(),
    ssh('ls /dev/ttyUSB* 2>/dev/null', { check: false }),
  ]);
  const cable = plugged ? `plugged in (${serial.stdout.trim() || 'no serial port yet'})` : 'unplugged';
  console.log(`
Home Assistant   ${HA_URL}   (user "${E2E_USER.username}", password "${E2E_USER.password}")
Core             ${info.homeassistant}
Supervisor       ${info.supervisor} (${info.state})
Operating system ${info.operating_system}
P1 cable         ${cable}
Add-ons          ${addons.length === 0 ? 'none' : ''}`);
  for (const addon of addons) {
    console.log(`  ${addon.slug.padEnd(28)} ${addon.version.padEnd(10)} ${addon.state}`);
  }
  return 0;
}

async function usb(action) {
  if (action === 'unplug') await unplugP1Cable();
  else if (action === 'plug') await plugP1Cable();
  else throw new Error('Use: usb unplug|plug');
  console.log(`The P1 cable is ${(await p1CablePlugged()) ? 'plugged in' : 'unplugged'}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case 'up':
      return up();
    case 'down':
      return composeAttached(['down']);
    case 'reset':
      // Keeps the cache volume with the downloaded Home Assistant OS image.
      composeAttached(['down']);
      return attach('docker', ['volume', 'rm', '-f', 'haos-e2e_state']);
    case 'status':
      return status();
    case 'test': {
      const files = args.length > 0 ? args : [path.join(E2E_DIR, 'tests')];
      return attach(process.execPath, ['--test', '--test-concurrency=1', ...files]);
    }
    case 'install': {
      if (!args[0]) throw new Error('Use: install <add-on dir>, for example: install dsmr_reader');
      const addonDir = path.relative(REPO_DIR, path.resolve(args[0]));
      await refuseUpdateServer();
      const { slug } = await installLocalAddon(addonDir);
      const info = await addonInfo(slug);
      console.log(`Installed ${slug} ${info.version}. Configure and start it in Home Assistant: ${HA_URL}`);
      return 0;
    }
    case 'ssh':
      return composeAttached(['exec', ...(process.stdin.isTTY ? [] : ['-T']), 'haos', 'haos-ssh', ...args]);
    case 'ha':
      return composeAttached(['exec', '-T', 'haos', 'haos-ssh', `ha ${sh(...args)}`]);
    case 'logs':
      if (!args[0]) return composeAttached(['logs', '-f', '--tail', '100']);
      return composeAttached(['exec', '-T', 'haos', 'haos-ssh', `docker logs -f --tail 100 ${await containerName(args[0])}`]);
    case 'usb':
      return usb(args[0]);
    case 'monitor':
      console.log(await qemuMonitor(args.join(' ')));
      return 0;
    default:
      console.log(USAGE);
      return command === undefined || command === 'help' ? 0 : 1;
  }
}

try {
  process.exitCode = (await main()) ?? 0;
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
