// Metabase, end to end: the add-on built from the working tree, with its own H2 database and
// with PostgreSQL (the TimescaleDB add-on) as its application database, answering a question
// from a database in TimescaleDB.
//
// Each run reinstalls the add-on and removes its H2 file and its `metabase` database.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import {
  UPDATE_SERVER,
  addonExec,
  addonInfo,
  addonLogs,
  baseImageFromWorkflow,
  configureAddon,
  installLocalAddon,
  secondsToStart,
  stateAfterStop,
  stopOtherAddons,
  uninstallAddon,
  waitForSupervisor,
} from '../lib/addons.mjs';
import { TIMESCALEDB, ensureTimescaleDb, psql, recreateDatabase } from '../lib/timescaledb.mjs';
import { REPO_DIR, addonUrl, requireVm, ssh, waitFor, withServerUnreachable } from '../lib/vm.mjs';

const ADDON_DIR = 'metabase';
const SLUG = 'local_metabase';
/** Metabase's application database in TimescaleDB, the add-on's default MB_DB_DBNAME. */
const APP_DATABASE = 'metabase';
/** A database with known rows for Metabase to query. */
const DATA_DATABASE = 'metabase_e2e';
/** The add-on's H2 file (MB_DB_FILE=/backup/metabase.db) on the Home Assistant OS host. */
const H2_ON_HOST = '/mnt/data/supervisor/backup/metabase.db';
const ADMIN = { first_name: 'E2E', last_name: 'Test', email: 'e2e@example.com', password: 'e2e-Password-1' };

const config = JSON.parse(await fs.readFile(path.join(REPO_DIR, ADDON_DIR, 'config.json'), 'utf8'));
const METABASE_URL = addonUrl(config.ports['3000/tcp']);

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
    await ssh(`rm -rf ${H2_ON_HOST} ${H2_ON_HOST}.*`);
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

  it('starts with its default options and answers its health check', async () => {
    // Manual boot: the tests start the add-on themselves.
    await configureAddon(SLUG, { boot: 'manual' });
    assert.equal(config.options.MB_DB_TYPE, 'h2', 'the default application database is H2');
    await secondsToStart(SLUG, isHealthy, { timeout: 600 });
    assert.equal((await addonInfo(SLUG)).state, 'started');
  });

  it('runs the Metabase version of its base image', async () => {
    const baseImage = await baseImageFromWorkflow(ADDON_DIR);
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

  it('keeps its H2 database in the backup folder across a restart', async (t) => {
    if (!session) return t.skip('the setup did not complete');
    const { stdout } = await ssh(`ls ${H2_ON_HOST}`);
    assert.match(stdout, /\.mv\.db/, 'the H2 file is in the backup folder of Home Assistant');

    await secondsToStart(SLUG, isHealthy, { timeout: 600 });
    const login = await api('POST', '/api/session', {
      body: { username: ADMIN.email, password: ADMIN.password },
    });
    assert.equal(login.status, 200, 'the administrator can still log in');
  });

  it('stops without an error', async () => {
    assert.equal(await stateAfterStop(SLUG), 'stopped');
  });

  describe('when the update server does not answer', () => {
    it('starts Metabase without waiting for it', async () => {
      // "Metabase started" is the last line of the add-on's own script, before Java starts.
      const scriptIsDone = async () => (await addonLogs(SLUG, 5000)).includes('Metabase started');
      const seconds = await withServerUnreachable(UPDATE_SERVER, () =>
        secondsToStart(SLUG, scriptIsDone, { timeout: 240 }),
      );
      await waitFor('the health check to answer', isHealthy, { timeout: 600 });
      assert.ok(seconds <= 30, `the add-on's script needed ${seconds} seconds before it started Metabase`);
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
});
