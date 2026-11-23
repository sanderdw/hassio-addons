// DSMR Datalogger, end to end: it reads the smart meter on the USB P1 cable (or a network socket)
// and sends each telegram to the API of DSMR Reader, which stores it in TimescaleDB.
//
// Each run reinstalls the add-on and gives DSMR Reader an empty database.
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
  stopAddon,
  stopOtherAddons,
  uninstallAddon,
  waitForSupervisor,
} from '../lib/addons.mjs';
import {
  DSMR_READER,
  assertNewestReadingsMatchMeter,
  newestReadingAge,
  readingCount,
  startDsmrReaderAsServer,
} from '../lib/dsmr-reader.mjs';
import { TIMESCALEDB } from '../lib/timescaledb.mjs';
import {
  REPO_DIR,
  p1Address,
  plugP1Cable,
  requireVm,
  ssh,
  supervisor,
  unplugP1Cable,
  waitFor,
  withServerUnreachable,
} from '../lib/vm.mjs';

const ADDON_DIR = 'dsmr_datalogger';
const SLUG = 'local_dsmr_datalogger';
/** A started datalogger sends a telegram within seconds; this leaves room for a slow VM. */
const SECONDS_TO_FIRST_READING = 60;

const config = JSON.parse(await fs.readFile(path.join(REPO_DIR, ADDON_DIR, 'config.json'), 'utf8'));
const hasSerialPort = async () => (await ssh('test -c /dev/ttyUSB0', { check: false })).code === 0;

describe('DSMR Datalogger add-on', () => {
  /** The options for reading the P1 cable and sending to DSMR Reader. */
  let options;

  /** Resolves once DSMR Reader has stored a reading that the meter sent after this call. */
  function aNewReading() {
    const calledAt = Date.now();
    return async () => {
      const age = await newestReadingAge();
      return Number.isFinite(age) && age * 1000 < Date.now() - calledAt && age <= 15;
    };
  }

  before(async () => {
    await requireVm();
    await waitForSupervisor({ timeout: 600 });
    await stopOtherAddons([TIMESCALEDB.slug]);
    await uninstallAddon(SLUG);
    await plugP1Cable();
    const apiKey = await startDsmrReaderAsServer();
    options = { ...config.options, DATALOGGER_API_HOSTS: DSMR_READER.url, DATALOGGER_API_KEYS: apiKey };
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

  it('starts and sends telegrams to DSMR Reader', async () => {
    assert.equal(await readingCount(), 0, 'DSMR Reader reads no meter itself');
    // Manual boot: the tests start the add-on themselves.
    await configureAddon(SLUG, { boot: 'manual', options });
    const seconds = await secondsToStart(SLUG, aNewReading(), { timeout: 180 });
    assert.ok(seconds <= SECONDS_TO_FIRST_READING, `the first reading arrived after ${seconds} seconds`);
    assert.equal((await addonInfo(SLUG)).state, 'started');
  });

  it('has the P1 cable inside its container', async () => {
    const { stdout } = await addonExec(SLUG, 'test -c /dev/ttyUSB0 && echo present');
    assert.equal(stdout.trim(), 'present');
  });

  it('delivers the meter readings to DSMR Reader, value for value', async () => {
    await assertNewestReadingsMatchMeter(3);
  });

  it('keeps up with the meter', async () => {
    const age = await waitFor(
      'a reading from the last 15 seconds',
      async () => {
        const seconds = await newestReadingAge();
        return seconds <= 15 && { seconds };
      },
      { timeout: 60 },
    );
    assert.ok(age.seconds >= -5, `the newest reading is ${age.seconds} seconds old`);
  });

  it('stops without an error', async () => {
    assert.equal(await stateAfterStop(SLUG), 'stopped');
  });

  describe('with a network socket as its input', () => {
    after(async () => {
      await stopAddon(SLUG);
      await plugP1Cable();
      await waitFor('/dev/ttyUSB0 to come back', hasSerialPort, { timeout: 30 });
      await configureAddon(SLUG, { options });
    });

    it('reads the meter without the P1 cable', async () => {
      await stopAddon(SLUG);
      // Without the cable, a reading can only come from the socket.
      await unplugP1Cable();
      await waitFor('/dev/ttyUSB0 to disappear', async () => !(await hasSerialPort()), { timeout: 30 });
      await configureAddon(SLUG, {
        options: {
          ...options,
          DATALOGGER_INPUT_METHOD: 'ipv4',
          DATALOGGER_NETWORK_HOST: await p1Address(),
          DATALOGGER_NETWORK_PORT: 2001,
        },
      });
      await secondsToStart(SLUG, aNewReading(), { timeout: 120 });
      await assertNewestReadingsMatchMeter(3);
    });

    it('stops with an error that names the missing network port', async () => {
      await stopAddon(SLUG);
      // DATALOGGER_NETWORK_PORT has no default: leaving it out leaves it empty.
      await configureAddon(SLUG, {
        options: { ...options, DATALOGGER_INPUT_METHOD: 'ipv4', DATALOGGER_NETWORK_HOST: await p1Address() },
      });
      // The app may stop before the Supervisor's start request returns, which then fails.
      await supervisor('post', `/addons/${SLUG}/start`, undefined, { timeout: 600 }).catch(() => {});
      await waitFor('the app to stop with an error', async () => (await addonInfo(SLUG)).state === 'error', {
        timeout: 60,
      });
      const log = await addonLogs(SLUG);
      assert.match(log, /DATALOGGER_NETWORK_PORT/, `the log names the option:\n${log}`);
      assert.doesNotMatch(log, /Traceback/, `the datalogger did not start:\n${log}`);
    });
  });

  describe('when the P1 cable is pulled out and plugged back in', () => {
    before(async () => {
      await secondsToStart(SLUG, aNewReading(), { timeout: 120 });
    });
    after(plugP1Cable);

    it('stops sending readings without the cable', async () => {
      await unplugP1Cable();
      await waitFor('/dev/ttyUSB0 to disappear', async () => !(await hasSerialPort()), { timeout: 30 });
      await waitFor('the readings to stop', async () => (await newestReadingAge()) > 20, { timeout: 60 });
    });

    it('reads the meter again with the cable back', async () => {
      await plugP1Cable();
      await waitFor('/dev/ttyUSB0 to come back', hasSerialPort, { timeout: 30 });
      await waitFor(
        'a reading from the last 15 seconds',
        async () => {
          if ((await addonInfo(SLUG)).state === 'error') {
            const reason = 'the add-on stopped with an error when the cable went, and does not start again';
            throw Object.assign(new Error(reason), { fatal: true });
          }
          return (await newestReadingAge()) <= 15;
        },
        { timeout: 120 },
      );
      assert.equal((await addonInfo(SLUG)).state, 'started');
    });
  });

  describe('when the update server does not answer', () => {
    it('still starts and sends telegrams', async () => {
      const seconds = await withServerUnreachable(UPDATE_SERVER, () =>
        secondsToStart(SLUG, aNewReading(), { timeout: 240 }),
      );
      assert.ok(seconds <= SECONDS_TO_FIRST_READING, `the first reading arrived after ${seconds} seconds`);
    });
  });

  after(async () => {
    // Leave the add-on running for a look at it, also after a failed test.
    if ((await addonInfo(SLUG).catch(() => undefined))?.state !== 'started') {
      await secondsToStart(SLUG, aNewReading(), { timeout: 120 }).catch(() => {});
    }
  });
});
