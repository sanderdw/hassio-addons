// Installing and controlling add-ons through the Supervisor API.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { REPO_DIR, run, sh, ssh, supervisor, waitFor } from './vm.mjs';

/**
 * The folder for local add-ons on the Home Assistant OS host (`/addons` in the SSH add-on).
 * Supervisor keeps it in `apps/local`; before the rename from add-ons to apps, in `addons/local`.
 */
async function localAddonsDir() {
  const { stdout } = await ssh(
    'for name in apps addons; do dir=/mnt/data/supervisor/$name/local; if [ -d "$dir" ]; then echo "$dir"; break; fi; done',
  );
  if (!stdout.trim()) throw new Error('Found no folder for local add-ons on the Home Assistant OS host');
  return stdout.trim();
}

/** Waits until the Supervisor accepts work and Home Assistant Core is installed. */
export async function waitForSupervisor({ timeout = 1800 } = {}) {
  await waitFor('SSH on the Home Assistant OS host', () => ssh('true'), { timeout: 300 });
  await waitFor(
    'the Supervisor to be running with Home Assistant Core installed (the first boot downloads it)',
    async () => {
      const info = await supervisor('get', '/info');
      return info.state === 'running' && info.homeassistant && info.homeassistant !== 'landingpage';
    },
    { timeout, interval: 5 },
  );
}

export const addonInfo = (slug) => supervisor('get', `/addons/${slug}/info`);

export async function isInstalled(slug) {
  const { addons } = await supervisor('get', '/addons');
  return addons.some((addon) => addon.slug === slug);
}

/**
 * The server every add-on in this repository asks for a newer version when it starts. A start
 * must not depend on it: see `withServerUnreachable()` in vm.mjs.
 */
export const UPDATE_SERVER = 'api-check.duckdns.org';

const containerNames = new Map();

/**
 * The name of an add-on's container. Supervisor names it `app_<slug>`; before the rename from
 * add-ons to apps it was `addon_<slug>`.
 */
export async function containerName(slug) {
  if (!containerNames.has(slug)) {
    const { stdout } = await ssh("docker ps -a --format '{{.Names}}'");
    const name = stdout.split('\n').find((line) => line === `app_${slug}` || line === `addon_${slug}`);
    if (!name) throw new Error(`There is no container for ${slug}; is the add-on started?`);
    containerNames.set(slug, name);
  }
  return containerNames.get(slug);
}

/** The add-on's own log, for a failure message. */
export const addonLogs = async (slug, lines = 80) =>
  (await ssh(`docker logs --tail ${lines} ${await containerName(slug)} 2>&1`, { check: false })).stdout;

/** Runs a shell command inside a running add-on's container. */
export const addonExec = async (slug, command, options) =>
  ssh(`docker exec ${await containerName(slug)} sh -c ${sh(command)}`, options);

export async function uninstallAddon(slug) {
  if (await isInstalled(slug)) await supervisor('post', `/addons/${slug}/uninstall`, undefined, { timeout: 300 });
}

/**
 * Sets options (and other settings such as `network`, `boot` or `ingress_panel`).
 * Options replace the stored ones, as in the Configuration tab.
 */
export const configureAddon = (slug, settings) =>
  supervisor('post', `/addons/${slug}/options`, settings);

export async function startAddon(slug, { timeout = 300 } = {}) {
  await supervisor('post', `/addons/${slug}/start`, undefined, { timeout });
  await waitFor(`${slug} to be started`, async () => (await addonInfo(slug)).state === 'started', {
    timeout,
  });
}

const RUNNING = ['started', 'startup'];

export async function stopAddon(slug) {
  if ((await isInstalled(slug)) && RUNNING.includes((await addonInfo(slug)).state)) {
    await supervisor('post', `/addons/${slug}/stop`, undefined, { timeout: 180 });
  }
}

/**
 * Stops a running add-on, as the Stop button does.
 * @returns {Promise<string>} its state afterwards: "stopped", or "error" when the container
 *   had to be killed or ended with an exit code other than 0
 */
export async function stateAfterStop(slug) {
  await supervisor('post', `/addons/${slug}/stop`, undefined, { timeout: 180 });
  return (await addonInfo(slug)).state;
}

/**
 * Stops every running add-on except the given ones. Test files call this first: the VM has
 * limited memory, and two add-ons that read the P1 cable at once each get half of a telegram.
 * @param {string[]} keep slugs
 */
export async function stopOtherAddons(keep) {
  const { addons } = await supervisor('get', '/addons');
  for (const addon of addons) {
    if (!keep.includes(addon.slug) && RUNNING.includes(addon.state)) {
      await supervisor('post', `/addons/${addon.slug}/stop`, undefined, { timeout: 180 });
    }
  }
}

/**
 * Stops an add-on when it runs, starts it and waits until `ready` returns a truthy value.
 * @param {string} slug
 * @param {() => Promise<any>} ready
 * @param {{ timeout?: number, beforeStart?: () => Promise<any> }} [options] timeout in seconds;
 *   `beforeStart` runs while the add-on is stopped
 * @returns {Promise<number>} the seconds between the start and `ready`
 */
export async function secondsToStart(slug, ready, { timeout = 300, beforeStart } = {}) {
  await stopAddon(slug);
  await beforeStart?.();
  const startedAt = Date.now();
  try {
    await supervisor('post', `/addons/${slug}/start`, undefined, { timeout: 600 });
    await waitFor(
      `${slug} to be ready`,
      async () => {
        if ((await addonInfo(slug)).state === 'error') {
          throw Object.assign(new Error(`${slug} stopped with an error`), { fatal: true });
        }
        return ready();
      },
      { timeout },
    );
  } catch (error) {
    const { state } = await addonInfo(slug);
    const log = await addonLogs(slug, 40).catch(() => '(no log)');
    throw new Error(`${error.message}\n\nThe add-on's state is "${state}". Its log:\n${log}`);
  }
  return Math.round((Date.now() - startedAt) / 1000);
}

/** Installs an add-on from an add-on repository, adding the repository when needed. */
export async function installStoreAddon(slug, repositoryUrl) {
  if (await isInstalled(slug)) return;
  if (repositoryUrl) {
    const repositories = await supervisor('get', '/store/repositories');
    if (!repositories.some((repository) => repository.source === repositoryUrl)) {
      await supervisor('post', '/store/repositories', { repository: repositoryUrl }, { timeout: 300 });
    }
  }
  await supervisor('post', `/store/addons/${slug}/install`, undefined, { timeout: 1800 });
}

/**
 * The amd64 base image an add-on is built from in CI: the BASE_IMAGE of the amd64 matrix entry
 * in the workflow that builds `./<addonDir>`. Undefined when the Dockerfile names its own base.
 */
export async function baseImageFromWorkflow(addonDir) {
  const workflows = path.join(REPO_DIR, '.github', 'workflows');
  for (const file of await fs.readdir(workflows)) {
    const text = await fs.readFile(path.join(workflows, file), 'utf8');
    if (!text.includes(`context: ./${addonDir}\n`)) continue;
    const entries = text.split(/^\s+- (?=[A-Z_]+:)/m);
    const amd64 = entries.find((entry) => /amd64/.test(entry) && /BASE_IMAGE:/.test(entry));
    return amd64?.match(/BASE_IMAGE:\s*(\S+)/)?.[1];
  }
  return undefined;
}

/**
 * Copies an add-on from the working tree into the VM's local add-on folder, changed so the
 * Supervisor builds it there instead of pulling the published image:
 * - `image` is removed from config.json;
 * - the Dockerfile's BUILD_FROM gets the base image CI builds with as its default.
 * @returns {Promise<{ slug: string, version: string }>} the slug is `local_<slug>`
 */
export async function stageLocalAddon(addonDir, { baseImage } = {}) {
  const source = path.join(REPO_DIR, addonDir);
  const staged = await fs.mkdtemp(path.join(os.tmpdir(), 'haos-e2e-'));
  try {
    await fs.cp(source, staged, { recursive: true });

    const configFile = path.join(staged, 'config.json');
    const config = JSON.parse(await fs.readFile(configFile, 'utf8'));
    delete config.image;
    await fs.writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`);

    const base = baseImage ?? (await baseImageFromWorkflow(addonDir));
    const dockerfile = path.join(staged, 'Dockerfile');
    const text = await fs.readFile(dockerfile, 'utf8');
    if (/^ARG BUILD_FROM\b/m.test(text)) {
      if (!base) throw new Error(`No base image found for ${addonDir}; pass baseImage`);
      await fs.writeFile(dockerfile, text.replace(/^ARG BUILD_FROM\b.*$/m, `ARG BUILD_FROM=${base}`));
    }

    await fs.chmod(staged, 0o755);
    const target = `${await localAddonsDir()}/${config.slug}`;
    const archive = await run('tar', ['-C', staged, '-cf', '-', '.']);
    await ssh(`rm -rf ${sh(target)} && mkdir -p ${sh(target)} && tar -xf - -C ${sh(target)}`, {
      input: archive.stdoutBuffer,
    });
    await supervisor('post', '/store/reload', undefined, { timeout: 300 });
    return { slug: `local_${config.slug}`, version: config.version };
  } finally {
    await fs.rm(staged, { recursive: true, force: true });
  }
}

/**
 * Builds and installs an add-on from the working tree. An earlier install is removed first, so
 * the image is always built from the current files (Docker's build cache keeps that fast).
 */
export async function installLocalAddon(addonDir, options) {
  const staged = await stageLocalAddon(addonDir, options);
  await uninstallAddon(staged.slug);
  await supervisor('post', `/store/addons/${staged.slug}/install`, undefined, { timeout: 3600 });
  return staged;
}
