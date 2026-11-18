// The database add-on: TimescaleDB (PostgreSQL) by Expaso, the one the DSMR Reader and Metabase
// add-ons point at by default.
import { addonExec, addonInfo, configureAddon, installStoreAddon, startAddon } from './addons.mjs';
import { sh, supervisor, waitFor } from './vm.mjs';

export const TIMESCALEDB = {
  repository: 'https://github.com/expaso/hassos-addons',
  slug: '77b2833f_timescaledb',
  /** The hostname other add-ons reach it on. */
  host: '77b2833f-timescaledb',
  user: 'postgres',
};

/**
 * Runs SQL in the database add-on and returns the rows as arrays of strings.
 * @param {string} database
 * @param {string} sql
 */
export async function psql(database, sql) {
  const { stdout } = await addonExec(
    TIMESCALEDB.slug,
    `psql -U ${TIMESCALEDB.user} -d ${sh(database)} -v ON_ERROR_STOP=1 -AtF '|' -c ${sh(sql)}`,
  );
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('|'));
}

/**
 * Installs and starts TimescaleDB with the given databases, in addition to the ones it already has.
 * @param {string[]} databases
 */
export async function ensureTimescaleDb(databases) {
  await installStoreAddon(TIMESCALEDB.slug, TIMESCALEDB.repository);

  const info = await addonInfo(TIMESCALEDB.slug);
  const missing = databases.filter((database) => !info.options.databases.includes(database));
  if (missing.length > 0) {
    await configureAddon(TIMESCALEDB.slug, {
      options: { ...info.options, databases: [...info.options.databases, ...missing] },
    });
    // The add-on creates configured databases when it starts.
    if (info.state === 'started') {
      await supervisor('post', `/addons/${TIMESCALEDB.slug}/restart`, undefined, { timeout: 300 });
    }
  }
  if (info.state !== 'started') await startAddon(TIMESCALEDB.slug);

  await waitFor(
    `TimescaleDB to have the databases ${databases.join(', ')}`,
    async () => {
      const existing = (await psql('postgres', 'select datname from pg_database')).flat();
      return databases.every((database) => existing.includes(database));
    },
    { timeout: 300 },
  );
}

/** Drops a database and creates it again, empty, as the add-on does for a configured database. */
export async function recreateDatabase(database) {
  await psql('postgres', `drop database if exists "${database}" with (force)`);
  await psql('postgres', `create database "${database}"`);
}
