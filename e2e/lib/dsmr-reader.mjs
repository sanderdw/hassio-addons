// DSMR Reader as tests use it: the readings in its database, and its API for the DSMR
// Datalogger add-on.
import assert from 'node:assert/strict';
import { readingAt } from '../p1/telegram.mjs';
import { addonInfo, configureAddon, installLocalAddon, isInstalled, secondsToStart } from './addons.mjs';
import { ensureTimescaleDb, psql, recreateDatabase } from './timescaledb.mjs';
import { addonUrl, waitFor } from './vm.mjs';

export const DSMR_READER = {
  dir: 'dsmr_reader',
  slug: 'local_dsmr_reader',
  database: 'dsmrreader',
  /** Where other add-ons reach its web server. */
  url: 'http://local-dsmr-reader',
  /** Its host port in the VM; this machine reaches it on `addonUrl(hostPort)`. */
  hostPort: 7777,
};

/** The key the DSMR Datalogger sends telegrams with. Local test VM only. */
const API_KEY = 'E2E0000000000000000000000000000000000000000000000000000000000KEY';

const READING_COLUMNS = [
  'extract(epoch from timestamp)::bigint',
  'electricity_currently_delivered',
  'electricity_currently_returned',
  'electricity_delivered_1',
  'electricity_delivered_2',
  'electricity_returned_1',
  'electricity_returned_2',
  'phase_currently_delivered_l1',
  'phase_voltage_l1',
  'phase_power_current_l1',
  'extract(epoch from extra_device_timestamp)::bigint',
  'extra_device_delivered',
];

export const dsmrReaderIsHealthy = async () =>
  (await fetch(`${addonUrl(DSMR_READER.hostPort)}/healthcheck`)).ok;

/** How many readings DSMR Reader has stored. */
export async function readingCount() {
  const [[count]] = await psql(DSMR_READER.database, 'select count(*) from dsmr_datalogger_dsmrreading');
  return Number(count);
}

/** Seconds since the meter sent the newest stored reading; Infinity without a reading. */
export async function newestReadingAge() {
  const [[seconds]] = await psql(
    DSMR_READER.database,
    "select coalesce(extract(epoch from now() - max(timestamp))::int::text, 'none') from dsmr_datalogger_dsmrreading",
  );
  return seconds === 'none' ? Infinity : Number(seconds);
}

/**
 * Waits for the newest `count` readings and checks that every value equals what the meter sent
 * at the reading's timestamp.
 */
export async function assertNewestReadingsMatchMeter(count = 3) {
  const rows = await waitFor(
    `${count} readings in the database`,
    async () => {
      const result = await psql(
        DSMR_READER.database,
        `select ${READING_COLUMNS.join(', ')} from dsmr_datalogger_dsmrreading order by timestamp desc limit ${count}`,
      );
      return result.length === count && result;
    },
    { timeout: 180 },
  );
  for (const row of rows) {
    const stored = row.map(Number);
    const expected = readingAt(stored[0]);
    assert.deepEqual(
      stored,
      [
        expected.unixSeconds,
        expected.powerDeliveredKw,
        expected.powerReturnedKw,
        expected.deliveredTariff1Kwh,
        expected.deliveredTariff2Kwh,
        expected.returnedTariff1Kwh,
        expected.returnedTariff2Kwh,
        expected.powerDeliveredKw,
        expected.voltage,
        expected.currentL1,
        expected.gasUnixSeconds,
        expected.gasM3,
      ],
      `the reading of ${new Date(stored[0] * 1000).toISOString()} equals what the meter sent`,
    );
  }
}

/**
 * Starts DSMR Reader from the working tree with an empty database, as the server for a remote
 * datalogger: it does not read the P1 cable itself and accepts telegrams on its API.
 * @returns {Promise<string>} the API key
 */
export async function startDsmrReaderAsServer() {
  await ensureTimescaleDb([DSMR_READER.database]);
  if (!(await isInstalled(DSMR_READER.slug))) await installLocalAddon(DSMR_READER.dir);
  const { options } = await addonInfo(DSMR_READER.slug);
  await configureAddon(DSMR_READER.slug, {
    boot: 'manual',
    network: { '80/tcp': DSMR_READER.hostPort },
    options: { ...options, CONTAINER_RUN_MODE: 'server_remote_datalogger' },
  });
  await secondsToStart(
    DSMR_READER.slug,
    dsmrReaderIsHealthy,
    { timeout: 600, beforeStart: () => recreateDatabase(DSMR_READER.database) },
  );
  // The API is off until the user switches it on in DSMR Reader's settings. DSMR Reader creates
  // the settings row on first use; create it here with a key of our own.
  const [[apiKey]] = await waitFor(
    'the API settings table of DSMR Reader',
    () =>
      psql(
        DSMR_READER.database,
        `insert into dsmr_api_apisettings (id, allow, auth_key) values (1, true, '${API_KEY}')
         on conflict (id) do update set allow = true returning auth_key`,
      ),
    { timeout: 120 },
  );
  return apiKey;
}
