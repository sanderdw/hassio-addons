// The Mosquitto broker app: Home Assistant's MQTT service, which other add-ons ask the
// Supervisor for (`"services": ["mqtt:want"]`).
import { addonInfo, configureAddon, installStoreAddon, startAddon, uninstallAddon } from './addons.mjs';
import { addDiscoveredIntegration, configEntries, removeIntegration } from './homeassistant.mjs';
import { supervisor, waitFor } from './vm.mjs';

export const MOSQUITTO = {
  slug: 'core_mosquitto',
  /** The host name other add-ons reach it on. */
  host: 'core-mosquitto',
  port: 1883,
};

/** Whether the Supervisor offers an MQTT service to add-ons. */
export async function mqttServiceAvailable() {
  const { services } = await supervisor('get', '/services');
  return services.some((service) => service.slug === 'mqtt' && service.available);
}

/**
 * Installs and starts Mosquitto, and sets up Home Assistant's MQTT integration with it, as a
 * user does by clicking Add on the discovered MQTT card.
 */
export async function ensureMosquitto() {
  await installStoreAddon(MOSQUITTO.slug);
  const info = await addonInfo(MOSQUITTO.slug);
  if (info.boot !== 'manual') await configureAddon(MOSQUITTO.slug, { boot: 'manual' });
  if (info.state !== 'started') await startAddon(MOSQUITTO.slug);
  await waitFor('the MQTT service of Mosquitto', mqttServiceAvailable, { timeout: 120 });
  if ((await configEntries('mqtt')).length === 0) {
    const result = await addDiscoveredIntegration('mqtt');
    if (result.type !== 'create_entry') {
      throw new Error(`Adding the MQTT integration failed: ${JSON.stringify(result)}`);
    }
  }
}

/** Removes Mosquitto and Home Assistant's MQTT integration, so no MQTT service is left. */
export async function removeMosquitto() {
  await removeIntegration('mqtt');
  await uninstallAddon(MOSQUITTO.slug);
  await waitFor('the MQTT service to be gone', async () => !(await mqttServiceAvailable()), { timeout: 60 });
}
