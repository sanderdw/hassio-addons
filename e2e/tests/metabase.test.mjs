// Metabase, end to end: the add-on built from the working tree, with its own H2 database and
// with PostgreSQL (the TimescaleDB add-on) as its application database, answering a question
// from a database in TimescaleDB, on its own port and through Home Assistant ingress. It also
// checks the app's security rating and its cold backup, and restores that backup.
//
// Each run reinstalls the add-on and removes its H2 file and its `metabase` database. It ends by
// uninstalling the add-on with its data, then installs and starts it again.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import {
  UPDATE_SERVER,
  addonExec,
  addonInfo,
  addonLogs,
  baseImageOf,
  configureAddon,
  containerName,
  installLocalAddon,
  secondsToStart,
  stateAfterStop,
  stopOtherAddons,
  uninstallAddon,
  waitForSupervisor,
} from '../lib/addons.mjs';
import { openIngress } from '../lib/homeassistant.mjs';
import { TIMESCALEDB, ensureTimescaleDb, psql, recreateDatabase } from '../lib/timescaledb.mjs';
import {
  HA_URL,
  REPO_DIR,
  addonUrl,
  requireVm,
  ssh,
  supervisor,
  waitFor,
  withServerUnreachable,
} from '../lib/vm.mjs';

const ADDON_DIR = 'metabase';
const SLUG = 'local_metabase';
/** Metabase's application database in TimescaleDB, the add-on's default MB_DB_DBNAME. */
const APP_DATABASE = 'metabase';
/** A database with known rows for Metabase to query. */
const DATA_DATABASE = 'metabase_e2e';
/** The add-on's H2 database (MB_DB_FILE=/config/metabase.db) on the Home Assistant OS host. */
const H2_ON_HOST = `/mnt/data/supervisor/app_configs/${SLUG}/metabase.db`;
/** Where versions up to 1.6.1 kept it by default (MB_DB_FILE=/backup/metabase.db). */
const OLD_H2 = '/backup/metabase.db';
const OLD_H2_ON_HOST = '/mnt/data/supervisor/backup/metabase.db';
const ADMIN = { first_name: 'E2E', last_name: 'Test', email: 'e2e@example.com', password: 'e2e-Password-1' };

const config = JSON.parse(await fs.readFile(path.join(REPO_DIR, ADDON_DIR, 'config.json'), 'utf8'));
/** Metabase's own port is off by default; the tests open it on a forwarded host port. */
const HOST_PORT = 7778;
const METABASE_URL = addonUrl(HOST_PORT);
/** What a user sets under Network to use Metabase without Home Assistant. */
const NETWORK = { '3000/tcp': HOST_PORT };

/** Calls Metabase's API and returns the status and the parsed body. */
async function api(method, pathname, { body, session } = {}) {
  const response = await fetch(`${METABASE_URL}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { 'X-Metabase-Session': session } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, json, text };
}

const isHealthy = async () => (await api('GET', '/api/health')).json?.status === 'ok';

/** Walks through the first-time setup and returns the administrator's session. */
async function setUp() {
  const { json: properties } = await api('GET', '/api/session/properties');
  assert.equal(properties['has-user-setup'], false, 'Metabase has no user yet');
  const setup = await api('POST', '/api/setup', {
    body: {
      token: properties['setup-token'],
      user: { ...ADMIN, site_name: 'E2E' },
      prefs: { site_name: 'E2E', site_locale: 'en', allow_tracking: false },
    },
  });
  assert.equal(setup.status, 200, setup.text.slice(0, 300));
  return setup.json.id;
}

describe('Metabase add-on', () => {
  let session;

  before(async () => {
    await requireVm();
    await waitForSupervisor({ timeout: 600 });
    await stopOtherAddons([TIMESCALEDB.slug]);
    // The README has the user add the `metabase` database to TimescaleDB's configuration.
    await ensureTimescaleDb([APP_DATABASE]);
    await uninstallAddon(SLUG);
    await ssh(`rm -rf ${H2_ON_HOST} ${H2_ON_HOST}.* ${OLD_H2_ON_HOST} ${OLD_H2_ON_HOST}.*`);
    await recreateDatabase(APP_DATABASE);
    await recreateDatabase(DATA_DATABASE);
    await psql(
      DATA_DATABASE,
      'create table meter (id int primary key, kwh numeric(9,3)); insert into meter values (1, 1.500), (2, 2.250)',
    );
  });

  it('builds from the working tree and installs', async () => {
    await installLocalAddon(ADDON_DIR);
    const info = await addonInfo(SLUG);
    assert.equal(info.build, true, 'the image is built in the VM, not pulled');
    assert.equal(info.version, config.version);
    assert.equal(info.state, 'stopped');
  });

  it('has the highest security rating, with its own AppArmor profile', async () => {
    const info = await addonInfo(SLUG);
    assert.equal(info.apparmor, 'profile', 'the AppArmor profile from apparmor.txt is loaded');
    assert.equal(info.rating, 8);
  });

  it("opens no port by default: Home Assistant's ingress is the way in", async () => {
    assert.deepEqual((await addonInfo(SLUG)).network, { '3000/tcp': null });
  });

  it('starts with its default options, and is "started" only once Metabase answers', async () => {
    // Manual boot: the tests start the add-on themselves.
    await configureAddon(SLUG, { boot: 'manual', network: NETWORK });
    assert.equal(config.options.MB_DB_TYPE, 'h2', 'the default application database is H2');

    // Home Assistant shows "Open web UI" when the state is "started". The Docker health check
    // keeps it at "startup" until Metabase answers; meanwhile ingress shows a page that reloads
    // itself instead of "502 Bad Gateway".
    const ingress = await openIngress((await addonInfo(SLUG)).ingress_url);
    const states = new Set();
    const startedTooEarly = [];
    const ingressAnswers = [];
    const start = supervisor('post', `/addons/${SLUG}/start`, undefined, { timeout: 900 });
    start.catch(() => {});
    await waitFor(
      'Metabase to answer and the app to be started',
      async () => {
        // The state first: "started" means the health check passed before Metabase was asked.
        const { state } = await addonInfo(SLUG);
        if (state === 'error') throw Object.assign(new Error(`${SLUG} stopped with an error`), { fatal: true });
        const healthy = await isHealthy().catch(() => false);
        states.add(state);
        if (state === 'started' && !healthy) startedTooEarly.push(new Date().toISOString());
        if (!healthy) {
          const response = await ingress().catch(() => undefined);
          if (response) {
            const text = await response.text();
            ingressAnswers.push(text.includes('Metabase is starting') ? 'starting page' : String(response.status));
          }
        }
        return state === 'started' && healthy;
      },
      { timeout: 600, interval: 1 },
    );
    await start;

    assert.deepEqual(startedTooEarly, [], 'the app was "started" before Metabase answered');
    assert.ok(states.has('startup'), `the app showed "startup" while Metabase started (${[...states]})`);
    const firstPage = ingressAnswers.indexOf('starting page');
    assert.ok(firstPage >= 0, `ingress showed the starting page (it answered ${ingressAnswers})`);
    assert.ok(
      !ingressAnswers.slice(firstPage).includes('502'),
      `ingress answered 502 after nginx was up (${ingressAnswers})`,
    );
  });

  it('runs the Metabase version of its base image', async () => {
    const baseImage = await baseImageOf(ADDON_DIR);
    const { json: properties } = await api('GET', '/api/session/properties');
    assert.equal(properties.version.tag, baseImage.split(':')[1]);
  });

  it('passes the time zone and the Java options to Metabase', async () => {
    const { stdout } = await addonExec(SLUG, "cat /proc/[0-9]*/cmdline | tr '\\0' ' '");
    assert.ok(
      stdout.includes(`-Duser.timezone=${config.options.JAVA_TIMEZONE}`),
      `Java runs in ${config.options.JAVA_TIMEZONE}`,
    );
    assert.ok(stdout.includes(config.options.JAVA_OPTS), `Java runs with ${config.options.JAVA_OPTS}`);
  });

  it('completes the first-time setup', async () => {
    session = await setUp();
    const { json: user } = await api('GET', '/api/user/current', { session });
    assert.equal(user.email, ADMIN.email);
    assert.equal(user.is_superuser, true);
  });

  it('answers a question from a database in TimescaleDB', async (t) => {
    if (!session) return t.skip('the setup did not complete');
    const database = await api('POST', '/api/database', {
      session,
      body: {
        engine: 'postgres',
        name: 'TimescaleDB',
        details: {
          host: TIMESCALEDB.host,
          port: 5432,
          dbname: DATA_DATABASE,
          user: config.options.MB_DB_USER,
          password: config.options.MB_DB_PASS,
          ssl: false,
        },
      },
    });
    assert.equal(database.status, 200, database.text.slice(0, 300));

    const answer = await api('POST', '/api/dataset', {
      session,
      body: {
        database: database.json.id,
        type: 'native',
        native: { query: 'select id, kwh from meter order by id' },
      },
    });
    assert.equal(answer.json.error, undefined);
    assert.deepEqual(answer.json.data.rows, [
      [1, 1.5],
      [2, 2.25],
    ]);
  });

  describe('through Home Assistant ingress', () => {
    let info;
    let ingress;

    before(async () => {
      info = await addonInfo(SLUG);
      ingress = await openIngress(info.ingress_url);
    });

    it('refuses a visitor without an ingress session', async () => {
      const response = await fetch(`${HA_URL}${info.ingress_url}`);
      assert.equal(response.status, 401);
    });

    it('serves the app with links below the ingress path', async () => {
      const response = await ingress();
      assert.equal(response.status, 200, await addonLogs(SLUG));
      const html = await response.text();
      assert.ok(html.includes(`<base href="${info.ingress_entry}/"`), 'the page loads everything below the ingress path');
      assert.ok(html.includes(`<meta name="base-href" content="${info.ingress_entry}/"`));

      const links = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((match) => match[1]);
      const outside = links.filter((link) => !link.startsWith(`${info.ingress_entry}/`));
      assert.deepEqual(outside, [], 'no link leaves the ingress path');

      // ingress.js points the fonts and the pin map's tiles below the ingress path; it is only
      // checked here, in a browser it rewrites what Metabase's scripts build at run time.
      const shim = await ingress('ingress.js');
      assert.equal(shim.status, 200);
      assert.match(shim.headers.get('content-type'), /javascript/);
      assert.ok((await shim.text()).includes(`'${info.ingress_entry}/'`), 'ingress.js knows the ingress path');
      assert.ok(html.indexOf('ingress.js') < html.indexOf('<base '), 'ingress.js loads before the app');

      const script = html.match(/<script[^>]+src="(app\/[^"]+\.js)"/)?.[1];
      assert.ok(script, 'the page loads a script');
      const asset = await ingress(script);
      assert.equal(asset.status, 200, script);
      assert.match(asset.headers.get('content-type'), /javascript/);
    });

    it("lets Home Assistant show it in a frame, and only Home Assistant's origin", async () => {
      const response = await ingress();
      const policy = response.headers.get('content-security-policy');
      assert.match(policy, /frame-ancestors 'self'/);
      assert.doesNotMatch(policy, /frame-ancestors 'none'/);
      assert.match(policy, /script-src /, "the rest of Metabase's policy stays");
      assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
    });

    it("shows Metabase's whole menu in Home Assistant's frame", async () => {
      // In a frame, Metabase hides its gear menu (Admin settings), search and "New". Ingress
      // serves its main bundle from its own path, with that frame check answering false.
      const html = await (await ingress()).text();
      const main = html.match(/<script[^>]+src="(ingress\/app-main\.[^"]+\.js)"/)?.[1];
      assert.ok(main, 'the page loads the main bundle from ingress/');
      assert.ok(html.includes(`<link rel="preload" href="${main}"`), 'and preloads that one');

      const check = 'return window.self!==window.top';
      const original = await (await fetch(`${METABASE_URL}/${main.replace('ingress/', 'app/dist/')}`)).text();
      assert.ok(original.includes(check), `Metabase's own bundle still has the frame check "${check}"`);
      const response = await ingress(main);
      assert.equal(response.status, 200, main);
      assert.match(response.headers.get('content-type'), /javascript/);
      const patched = await response.text();
      assert.ok(!patched.includes(check), 'the frame check is gone');
      assert.equal(patched, original.replace(check, 'return false'), 'and nothing else changed');
    });

    it('logs in with a session cookie for the ingress path only', async (t) => {
      if (!session) return t.skip('the setup did not complete');
      // In a frame, Metabase's frontend sends X-Metabase-Embedded (not the bundle that ingress
      // serves, but nginx drops the header anyway). The session must be a normal one, which
      // images (the pin map's tiles) can use without the anti-CSRF header of an embedded session.
      const login = await ingress('api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Embedded': 'true' },
        body: JSON.stringify({ username: ADMIN.email, password: ADMIN.password }),
      });
      assert.equal(login.status, 200, (await login.text()).slice(0, 300));
      const cookie = login.headers.getSetCookie().find((c) => c.startsWith('metabase.SESSION='));
      assert.ok(cookie, 'Metabase sets its normal session cookie, not metabase.EMBEDDED_SESSION');
      assert.equal(login.headers.get('x-metabase-anti-csrf-token'), null);
      assert.match(cookie, new RegExp(`Path=${info.ingress_entry}/(;|$)`, 'i'));

      const user = await ingress('api/user/current', { headers: { Cookie: cookie.split(';')[0] } });
      assert.equal(user.status, 200);
      assert.equal((await user.json()).email, ADMIN.email);
    });

    it('leaves its own port as it was', async () => {
      const response = await fetch(`${METABASE_URL}/`);
      const html = await response.text();
      assert.ok(html.includes('<base href="/"'), 'the page on its own port loads from /');
      assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    });
  });

  const logIn = () => api('POST', '/api/session', { body: { username: ADMIN.email, password: ADMIN.password } });

  it("keeps its H2 database in the app's config folder across a restart", async (t) => {
    if (!session) return t.skip('the setup did not complete');
    const { stdout } = await ssh(`ls ${H2_ON_HOST}`);
    assert.match(stdout, /\.mv\.db/, "the H2 file is in the app's config folder");

    await secondsToStart(SLUG, isHealthy, { timeout: 600 });
    assert.equal((await logIn()).status, 200, 'the administrator can still log in');
  });

  describe('a backup', () => {
    let backup;
    let containerStartedAt;
    const startedAt = async () =>
      (await ssh(`docker inspect -f '{{.State.StartedAt}}' ${await containerName(SLUG)}`)).stdout.trim();

    before(async () => {
      if (!session) return;
      await waitFor('Metabase to answer', isHealthy, { timeout: 600 });
      containerStartedAt = await startedAt();
      ({ slug: backup } = await supervisor(
        'post',
        '/backups/new/partial',
        { name: 'e2e metabase', addons: [SLUG] },
        { timeout: 900 },
      ));
    });

    it("holds the H2 database from the app's config folder", async (t) => {
      if (!backup) return t.skip('the setup did not complete');
      const { stdout } = await ssh(`tar -xOf /mnt/data/supervisor/backup/${backup}.tar ${SLUG}.tar.gz | tar -tzf -`);
      assert.match(stdout, /config\/metabase\.db\/metabase\.db\.mv\.db/, `the backup holds:\n${stdout}`);
    });

    it('is made with Metabase stopped, which then starts again', async (t) => {
      if (!backup) return t.skip('the setup did not complete');
      // A cold backup: the H2 file must not change while the Supervisor copies it.
      assert.equal(config.backup, 'cold');
      assert.notEqual(await startedAt(), containerStartedAt, 'the container was stopped for the backup');
      await waitFor('Metabase to answer after the backup', isHealthy, { timeout: 600 });
      assert.equal((await addonInfo(SLUG)).state, 'started');
      assert.equal((await logIn()).status, 200, 'the administrator can still log in');
    });

    it('restores, with the administrator in the restored database', async (t) => {
      if (!backup) return t.skip('the setup did not complete');
      try {
        await supervisor('post', `/backups/${backup}/restore/partial`, { addons: [SLUG] }, { timeout: 900 });
        await waitFor('Metabase to answer after the restore', isHealthy, { timeout: 900 });
        assert.equal((await logIn()).status, 200, `the administrator can log in\n${await addonLogs(SLUG)}`);
      } finally {
        await supervisor('delete', `/backups/${backup}`);
      }
    });
  });

  it('moves an H2 database from /backup, where versions up to 1.6.1 kept it', async (t) => {
    if (!session) return t.skip('the setup did not complete');
    // Make it an install of 1.6.1: the database in /backup and the option pointing there.
    await supervisor('post', `/addons/${SLUG}/stop`);
    await ssh(`mv ${H2_ON_HOST} ${OLD_H2_ON_HOST}`);
    const { options } = await addonInfo(SLUG);
    await configureAddon(SLUG, { options: { ...options, MB_DB_FILE: OLD_H2 } });

    await secondsToStart(SLUG, isHealthy, { timeout: 600 });
    const logs = await addonLogs(SLUG, 5000);
    assert.equal((await logIn()).status, 200, `the administrator can still log in\n${logs}`);
    assert.match((await ssh(`ls ${H2_ON_HOST}`)).stdout, /\.mv\.db/, "the H2 file is in the app's config folder");
    const { stdout: left } = await ssh(`ls -d ${OLD_H2_ON_HOST} ${OLD_H2_ON_HOST}.* 2>/dev/null`, { check: false });
    assert.equal(left.trim(), '', 'nothing is left in /backup');
    assert.equal((await addonInfo(SLUG)).options.MB_DB_FILE, config.options.MB_DB_FILE, 'the option points to /config');
  });

  it('stops without an error', async () => {
    assert.equal(await stateAfterStop(SLUG), 'stopped');
  });

  describe('when the update server does not answer', () => {
    it('starts Metabase without waiting for it', async () => {
      // "Metabase started" is the last line of the add-on's own script, before Java starts.
      // The Supervisor's start waits for the health check, so time the script with Docker's
      // timestamps: from the container's start to that line.
      const scriptIsDone = async () => (await addonLogs(SLUG, 5000)).includes('Metabase started');
      await withServerUnreachable(UPDATE_SERVER, () => secondsToStart(SLUG, scriptIsDone, { timeout: 240 }));
      await waitFor('the health check to answer', isHealthy, { timeout: 600 });
      const container = await containerName(SLUG);
      const { stdout: startedAt } = await ssh(`docker inspect -f '{{.State.StartedAt}}' ${container}`);
      const { stdout: log } = await ssh(`docker logs -t ${container} 2>&1`);
      const line = log.split('\n').find((logLine) => logLine.includes('Metabase started'));
      const time = (timestamp) => Date.parse(timestamp.trim().replace(/(\.\d{3})\d*/, '$1'));
      const seconds = Math.round((time(line.split(' ')[0]) - time(startedAt)) / 1000);
      assert.ok(seconds <= 30, `the add-on's script needed ${seconds} seconds before it started Metabase`);
    });
  });

  describe('the AI features option', () => {
    /** Metabase's value of the setting, and whether it comes from MB_AI_FEATURES_ENABLED. */
    const aiFeatures = async () => {
      const login = await api('POST', '/api/session', {
        body: { username: ADMIN.email, password: ADMIN.password },
      });
      const session = login.json.id;
      const { json: properties } = await api('GET', '/api/session/properties', { session });
      const { json: settings } = await api('GET', '/api/setting', { session });
      const setting = settings.find((candidate) => candidate.key === 'ai-features-enabled?');
      return { enabled: properties['ai-features-enabled?'], fromVariable: setting.is_env_setting };
    };

    it("leaves AI to Metabase's own setting when on (the default)", async () => {
      assert.equal(config.options.MB_AI_FEATURES_ENABLED, true);
      // Not set by the add-on, so an administrator can still switch AI off in Metabase.
      assert.deepEqual(await aiFeatures(), { enabled: true, fromVariable: false });
    });

    it('switches AI off when off', async () => {
      const { options } = await addonInfo(SLUG);
      await configureAddon(SLUG, { options: { ...options, MB_AI_FEATURES_ENABLED: false } });
      try {
        await secondsToStart(SLUG, isHealthy, { timeout: 600 });
        assert.deepEqual(await aiFeatures(), { enabled: false, fromVariable: true });
      } finally {
        await configureAddon(SLUG, { options });
      }
    });
  });

  describe('with PostgreSQL as its application database', () => {
    it('starts and creates its tables in TimescaleDB', async () => {
      const { options } = await addonInfo(SLUG);
      await configureAddon(SLUG, { options: { ...options, MB_DB_TYPE: 'postgres' } });
      await secondsToStart(SLUG, isHealthy, { timeout: 900 });

      const [[tables]] = await psql(
        APP_DATABASE,
        "select count(*) from information_schema.tables where table_schema = 'public'",
      );
      assert.ok(Number(tables) > 50, `Metabase created ${tables} tables in the ${APP_DATABASE} database`);
    });

    it('stores a new administrator there', async () => {
      await setUp();
      assert.deepEqual(await psql(APP_DATABASE, 'select email, is_superuser from core_user where is_superuser'), [
        [ADMIN.email, 't'],
      ]);
    });
  });

  it('deletes its H2 database when it is uninstalled with its data', async () => {
    assert.match((await ssh(`ls ${H2_ON_HOST}`)).stdout, /\.mv\.db/, 'the H2 file is there before');
    await supervisor('post', `/addons/${SLUG}/uninstall`, { remove_config: true }, { timeout: 300 });
    const { stdout } = await ssh(`ls -d ${H2_ON_HOST} 2>/dev/null`, { check: false });
    assert.equal(stdout.trim(), '', 'the H2 file is gone');

    // Leave the add-on running, as every test file does.
    await installLocalAddon(ADDON_DIR);
    await configureAddon(SLUG, { boot: 'manual', network: NETWORK });
    await secondsToStart(SLUG, isHealthy, { timeout: 900 });
  });
});
