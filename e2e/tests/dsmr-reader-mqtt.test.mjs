// DSMR Reader's MQTT_HOME_ASSISTANT option, end to end: the add-on sets up its MQTT broker from
// Home Assistant's MQTT service (the Mosquitto broker app) and switches on the data sources that
// Home Assistant's DSMR Reader integration reads. Home Assistant then discovers DSMR Reader.
//
// Each run starts without Mosquitto, without the MQTT and DSMR Reader integrations, and with a
// new add-on and an empty `dsmrreader` database.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import {
  UPDATE_SERVER,
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
import { DSMR_READER, dsmrReaderIsHealthy } from '../lib/dsmr-reader.mjs';
import { addDiscoveredIntegration, haApi, removeIntegration } from '../lib/homeassistant.mjs';
import { MOSQUITTO, ensureMosquitto, removeMosquitto } from '../lib/mosquitto.mjs';
import { TIMESCALEDB, ensureTimescaleDb, psql, recreateDatabase } from '../lib/timescaledb.mjs';
import { REPO_DIR, plugP1Cable, requireVm, waitFor, withServerUnreachable } from '../lib/vm.mjs';
import { readingAt } from '../p1/telegram.mjs';

const { dir: ADDON_DIR, slug: SLUG, database: DATABASE, hostPort: HOST_PORT } = DSMR_READER;
const config = JSON.parse(await fs.readFile(path.join(REPO_DIR, ADDON_DIR, 'config.json'), 'utf8'));
const now = () => Math.floor(Date.now() / 1000);

/** The split-topic data sources the integration reads, by their table in DSMR Reader's database. */
const DATA_SOURCE_TABLES = [
  'dsmr_mqtt_splittopictelegrammqttsettings',
  'dsmr_mqtt_splittopicdaytotalsmqttsettings',
  'dsmr_mqtt_splittopicgasconsumptionmqttsettings',
  'dsmr_mqtt_splittopicquarterhourpeakelectricityconsumptionmqf25c',
  'dsmr_mqtt_splittopicmeterstatisticsmqttsettings',
  'dsmr_mqtt_splittopiccurrentperiodtotalsmqttsettings',
];
const BROKER_COLUMNS = 'enabled, hostname, port, coalesce(username, \'\'), coalesce(password, \'\'), secure';

/** DSMR Reader's MQTT broker settings: enabled, hostname, port, username, password, secure. */
const broker = async () => (await psql(DATABASE, `select ${BROKER_COLUMNS} from dsmr_mqtt_mqttbrokersettings`))[0];
const setBroker = (sql) => psql(DATABASE, `update dsmr_mqtt_mqttbrokersettings set ${sql}`);

/** Which of the data sources are switched on. DSMR Reader creates a row on first use: no row is off. */
const dataSources = async () => {
  const sql = DATA_SOURCE_TABLES.map((table) => `select coalesce((select enabled from ${table}), false)`).join(
    ' union all ',
  );
  return (await psql(DATABASE, sql)).map(([enabled]) => enabled === 't');
};

/** What init-mqtt-home-assistant logged during the last start. */
const setupLog = async () =>
  (await addonLogs(SLUG, 1000))
    .split('\n')
    .filter((line) => line.includes('init-mqtt-home-assistant |'))
    .join('\n');

const restart = () => secondsToStart(SLUG, dsmrReaderIsHealthy, { timeout: 600 });

/** A sensor of the DSMR Reader integration as a number, or undefined while it has no value. */
async function sensor(objectId) {
  const state = await haApi('get', `/api/states/sensor.${objectId}`);
  const value = Number(state?.state);
  return Number.isFinite(value) ? value : undefined;
}

describe('DSMR Reader with MQTT for Home Assistant', () => {
  before(async () => {
    await requireVm();
    await waitForSupervisor({ timeout: 600 });
    await stopOtherAddons([TIMESCALEDB.slug, MOSQUITTO.slug]);
    await plugP1Cable();
    await ensureTimescaleDb([DATABASE]);
    await removeIntegration('dsmr_reader');
    await removeMosquitto();
    await uninstallAddon(SLUG);
    await recreateDatabase(DATABASE);
  });

  it('builds from the working tree, with the option off by default', async () => {
    assert.equal(config.options.MQTT_HOME_ASSISTANT, false);
    await installLocalAddon(ADDON_DIR);
    await configureAddon(SLUG, { boot: 'manual', network: { '80/tcp': HOST_PORT } });
  });

  it('leaves MQTT alone with the option off', async () => {
    await restart();
    assert.equal((await broker())[0], 'f', 'the broker is not switched on');
    assert.deepEqual(await dataSources(), DATA_SOURCE_TABLES.map(() => false), 'no data source is switched on');
    assert.equal(await setupLog(), '', 'the setup logs nothing');
  });

  it('without an MQTT service, switches on the data sources and says how to set a broker', async () => {
    await configureAddon(SLUG, { options: { ...config.options, MQTT_HOME_ASSISTANT: true } });
    await restart();
    assert.deepEqual(await dataSources(), DATA_SOURCE_TABLES.map(() => true), 'every data source is switched on');
    assert.equal((await broker())[0], 'f', 'the broker is not switched on');
    assert.match(await setupLog(), /Home Assistant has no MQTT service/);
  });

  it('with the Mosquitto broker app, sets the broker from Home Assistant', async () => {
    await ensureMosquitto();
    await restart();
    const [enabled, hostname, port, username, password, secure] = await broker();
    assert.deepEqual([enabled, hostname, port, secure], ['t', MOSQUITTO.host, String(MOSQUITTO.port), '0']);
    assert.ok(username && password, 'the broker has the username and password of the MQTT service');
    assert.match(await setupLog(), /MQTT broker set to core-mosquitto:1883, from Home Assistant/);
  });

  it('is discovered by Home Assistant and shows the meter', async () => {
    const result = await addDiscoveredIntegration('dsmr_reader');
    assert.equal(result.type, 'create_entry', JSON.stringify(result));

    const lastMinute = (field) => Array.from({ length: 60 }, (_, age) => readingAt(now() - age)[field]);
    const power = await waitFor(
      'the power sensor to show what the meter sent',
      async () => {
        const kw = await sensor('dsmr_reading_electricity_currently_delivered');
        return lastMinute('powerDeliveredKw').includes(kw) && { kw };
      },
      { timeout: 120 },
    );
    assert.ok(power.kw > 0);
    const energy = await sensor('dsmr_reading_electricity_delivered_2');
    assert.ok(lastMinute('deliveredTariff2Kwh').includes(energy), `${energy} kWh is what the meter sent`);
  });

  it('changes nothing on a restart', async () => {
    const before = await broker();
    await restart();
    assert.deepEqual(await broker(), before);
    assert.match(await setupLog(), /MQTT broker: core-mosquitto:1883, from Home Assistant/);
    assert.doesNotMatch(await setupLog(), /set to|Switched on/);
  });

  it('keeps a broker that was entered by hand', async () => {
    await stopAddon(SLUG);
    await setBroker("hostname = 'my-broker', port = 1884, username = 'me', password = 'secret'");
    await restart();
    assert.deepEqual(await broker(), ['t', 'my-broker', '1884', 'me', 'secret', '0']);
    assert.match(await setupLog(), /Keeping the MQTT broker that was entered in DSMR Reader \(my-broker:1884\)/);
  });

  it('sets the broker again once the hand-entered one is removed', async () => {
    await stopAddon(SLUG);
    await setBroker("enabled = false, hostname = 'localhost', port = 1883, username = null, password = null, secure = 0");
    await restart();
    assert.equal((await broker())[1], MOSQUITTO.host);
    assert.match(await setupLog(), /MQTT broker set to core-mosquitto:1883/);
  });

  it('stops without an error', async () => {
    assert.equal(await stateAfterStop(SLUG), 'stopped');
  });

  it('starts when the update server does not answer', async () => {
    const seconds = await withServerUnreachable(UPDATE_SERVER, restart);
    assert.ok(seconds <= 120, `the add-on needed ${seconds} seconds`);
  });
});
