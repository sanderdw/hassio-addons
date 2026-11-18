// DSMR Reader, end to end: a smart meter on a USB P1 cable, the add-on built from the working
// tree, TimescaleDB as its database and the dashboard through Home Assistant ingress.
//
// Each run reinstalls the add-on and starts with an empty `dsmrreader` database.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  UPDATE_SERVER,
  addonExec,
  addonInfo,
  addonLogs,
  configureAddon,
  installLocalAddon,
  secondsToStart,
  stateAfterStop,
  stopOtherAddons,
  uninstallAddon,
  waitForSupervisor,
} from '../lib/addons.mjs';
import {
  DSMR_READER,
  assertNewestReadingsMatchMeter,
  dsmrReaderIsHealthy,
  newestReadingAge,
} from '../lib/dsmr-reader.mjs';
import { openIngress } from '../lib/homeassistant.mjs';
import { TIMESCALEDB, ensureTimescaleDb, psql, recreateDatabase } from '../lib/timescaledb.mjs';
import {
  HA_URL,
  REPO_DIR,
  plugP1Cable,
  requireVm,
  sleep,
  ssh,
  supervisor,
  unplugP1Cable,
  waitFor,
  withServerUnreachable,
} from '../lib/vm.mjs';
import { dsmrTimestamp, parseTelegrams, readingAt } from '../p1/telegram.mjs';

const { dir: ADDON_DIR, slug: SLUG, database: DATABASE, hostPort: HOST_PORT } = DSMR_READER;
/** How long the Supervisor waits for an add-on to come up before it logs a start timeout. */
const SUPERVISOR_START_TIMEOUT = 120;

const config = JSON.parse(await fs.readFile(path.join(REPO_DIR, ADDON_DIR, 'config.json'), 'utf8'));
const now = () => Math.floor(Date.now() / 1000);
const hasSerialPort = async () => (await ssh('test -c /dev/ttyUSB0', { check: false })).code === 0;

describe('DSMR Reader add-on', () => {
  /** Seconds between starting the add-on and its first healthy answer. */
  let secondsUntilHealthy;

  before(async () => {
    await requireVm();
    await waitForSupervisor({ timeout: 600 });
    await stopOtherAddons([TIMESCALEDB.slug]);
    await plugP1Cable();
    await ensureTimescaleDb([DATABASE]);
    await uninstallAddon(SLUG);
    await recreateDatabase(DATABASE);
  });

  it('finds the P1 cable as a USB serial port on the host', async () => {
    const { devices } = await supervisor('get', '/hardware/info');
    const port = devices.find((device) => device.dev_path === '/dev/ttyUSB0');
    assert.ok(port, 'the Supervisor lists /dev/ttyUSB0');
    assert.equal(port.subsystem, 'tty');
    assert.equal(port.attributes.ID_USB_DRIVER, 'ftdi_sio');
    assert.match(port.by_id, /^\/dev\/serial\/by-id\/usb-/);
  });

  it('receives current telegrams with a valid checksum on the port', async () => {
    const { stdout } = await ssh('stty -F /dev/ttyUSB0 115200 raw -echo; timeout 4 cat /dev/ttyUSB0', {
      check: false,
    });
    const telegrams = parseTelegrams(stdout);
    assert.ok(telegrams.length >= 2, `expected at least 2 telegrams in 4 seconds, got ${telegrams.length}`);
    assert.ok(telegrams.every((telegram) => telegram.crcValid), 'every telegram has a valid checksum');

    const timestamp = telegrams.at(-1).text.match(/0-0:1\.0\.0\((\d{12}[SW])\)/)[1];
    const recent = Array.from({ length: 15 }, (_, age) => dsmrTimestamp(now() - age));
    assert.ok(recent.includes(timestamp), `the last telegram (${timestamp}) is from the last 15 seconds`);
  });

  it('builds from the working tree and installs', async () => {
    await installLocalAddon(ADDON_DIR);
    const info = await addonInfo(SLUG);
    assert.equal(info.build, true, 'the image is built in the VM, not pulled');
    assert.equal(info.version, config.version);
    assert.equal(info.state, 'stopped');
  });

  it('starts and answers its health check', async () => {
    // Manual boot: the tests start the add-on themselves, and the VM starts faster without it.
    await configureAddon(SLUG, { boot: 'manual', network: { '80/tcp': HOST_PORT } });
    const startedAt = Date.now();
    await supervisor('post', `/addons/${SLUG}/start`, undefined, { timeout: 600 });
    try {
      await waitFor(
        'the health check to answer',
        dsmrReaderIsHealthy,
        { timeout: 900 },
      );
    } catch (error) {
      throw new Error(`${error.message}\n\nAdd-on log:\n${await addonLogs(SLUG)}`);
    }
    secondsUntilHealthy = Math.round((Date.now() - startedAt) / 1000);
    // The Supervisor reports "startup" until Docker's own health check passes; the image runs
    // that check every two minutes.
    await waitFor('the Supervisor to report the add-on as started', async () => (await addonInfo(SLUG)).state === 'started', {
      timeout: 300,
      interval: 5,
    });
  });

  it(`is healthy within the ${SUPERVISOR_START_TIMEOUT} seconds the Supervisor waits for a start`, async (t) => {
    if (secondsUntilHealthy === undefined) return t.skip('the add-on did not start');
    const log = await addonLogs(SLUG, 400);
    const updateCheckFailed = log.includes('Update check failed');
    assert.ok(
      secondsUntilHealthy <= SUPERVISOR_START_TIMEOUT,
      `the add-on needed ${secondsUntilHealthy} seconds` +
        (updateCheckFailed ? '; its log says "Update check failed", so the update check held up the start' : ''),
    );
  });

  it('has the P1 cable inside its container', async () => {
    const { stdout } = await addonExec(SLUG, 'test -c /dev/ttyUSB0 && echo present');
    assert.equal(stdout.trim(), 'present');
  });

  it('stores the meter readings in TimescaleDB, value for value', async () => {
    await assertNewestReadingsMatchMeter(3);
  });

  it('keeps up with the meter', async () => {
    const age = await waitFor(
      'a reading from the last 30 seconds',
      async () => {
        const seconds = await newestReadingAge();
        return seconds <= 30 && { seconds };
      },
      { timeout: 90 },
    );
    assert.ok(age.seconds >= -5, `the newest reading is ${age.seconds} seconds old`);
  });

  it('recognises the meter as DSMR 5', async () => {
    const [[version]] = await psql(DATABASE, 'select dsmr_version from dsmr_datalogger_meterstatistics');
    assert.equal(version, '50');
  });

  describe('when the P1 cable is pulled out and plugged back in', () => {
    after(plugP1Cable);

    it('stops receiving readings without the cable', async () => {
      await unplugP1Cable();
      await waitFor('/dev/ttyUSB0 to disappear', async () => !(await hasSerialPort()), { timeout: 30 });
      await waitFor('the readings to stop', async () => (await newestReadingAge()) > 20, { timeout: 60 });
    });

    it('reads the meter again with the cable back', async () => {
      await plugP1Cable();
      await waitFor('/dev/ttyUSB0 to come back', hasSerialPort, { timeout: 30 });
      await waitFor('a reading from the last 15 seconds', async () => (await newestReadingAge()) <= 15, {
        timeout: 120,
      });
    });
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

    it('serves the dashboard with links below the ingress path', async () => {
      const response = await ingress();
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /DSMR/);

      const links = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((match) => match[1]);
      const outside = links.filter((link) => !link.startsWith(`${info.ingress_entry}/`));
      assert.deepEqual(outside, [], 'no link leaves the ingress path');

      const stylesheet = links.find((link) => link.includes('/static/') && link.includes('.css'));
      assert.ok(stylesheet, 'the page links a stylesheet');
      const asset = await ingress(stylesheet.slice(info.ingress_url.length));
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get('content-type'), /text\/css/);
    });

    it('shows the current power of the meter', async () => {
      const response = await ingress('xhr/header');
      assert.equal(response.status, 200);
      const header = await response.json();

      // The dashboard shows the newest reading, in watts.
      const recentWatts = Array.from({ length: 60 }, (_, age) =>
        Math.round(readingAt(now() - age).powerDeliveredKw * 1000),
      );
      assert.ok(
        recentWatts.includes(header.currently_delivered),
        `${header.currently_delivered} W is what the meter sent in the last minute`,
      );
      assert.equal(header.currently_returned, 0);
    });
  });

  it('stops without an error', async () => {
    assert.equal(await stateAfterStop(SLUG), 'stopped');
  });

  describe('when the database answers only after a minute', () => {
    it('is reported as started within 15 seconds of answering', async () => {
      // The add-on waits for its database, so its start takes longer than a minute. Docker's
      // health check then decides when the Supervisor and the Home Assistant UI see it as started.
      const { ip_address: database } = await addonInfo(TIMESCALEDB.slug);
      let start;
      await withServerUnreachable(database, async () => {
        // The Supervisor answers a start only after two minutes when the add-on is not up by then.
        start = supervisor('post', `/addons/${SLUG}/start`, undefined, { timeout: 600 }).catch(() => {});
        await sleep(70_000);
      });
      await waitFor('the health check to answer', dsmrReaderIsHealthy, { timeout: 300, interval: 1 });
      const answeredAt = Date.now();
      await waitFor('the Supervisor to report the add-on as started', async () => (await addonInfo(SLUG)).state === 'started', {
        timeout: 300,
        interval: 1,
      });
      const seconds = Math.round((Date.now() - answeredAt) / 1000);
      await start;
      assert.ok(seconds <= 15, `the Supervisor reported the add-on as started ${seconds} seconds after it answered`);
    });
  });

  describe('when the update server does not answer', () => {
    it(`is still healthy within ${SUPERVISOR_START_TIMEOUT} seconds of a start`, async () => {
      const seconds = await withServerUnreachable(UPDATE_SERVER, () =>
        secondsToStart(SLUG, dsmrReaderIsHealthy, { timeout: 600 }),
      );
      assert.ok(seconds <= SUPERVISOR_START_TIMEOUT, `the add-on needed ${seconds} seconds`);
      assert.match(await addonLogs(SLUG, 400), /Update check failed/, 'the add-on logs that the check failed');
    });
  });
});
