// Music Assistant, whose Sendspin server VoltViz plays from.
import { addonInfo, configureAddon, installStoreAddon, startAddon } from './addons.mjs';
import { sh, ssh, waitFor } from './vm.mjs';

export const MUSIC_ASSISTANT = {
  repository: 'https://github.com/music-assistant/home-assistant-addon',
  slug: 'd5369777_music_assistant',
  /** The address of its Sendspin server for other add-ons; VoltViz's default SENDSPIN_URL. */
  sendspinUrl: 'http://d5369777-music-assistant:8927',
};

/** Installs and starts Music Assistant and waits for its Sendspin server. */
export async function ensureMusicAssistant() {
  await installStoreAddon(MUSIC_ASSISTANT.slug, MUSIC_ASSISTANT.repository);
  const info = await addonInfo(MUSIC_ASSISTANT.slug);
  if (info.boot !== 'manual') await configureAddon(MUSIC_ASSISTANT.slug, { boot: 'manual' });
  if (info.state !== 'started') await startAddon(MUSIC_ASSISTANT.slug);
  await waitFor(
    'the Sendspin server of Music Assistant',
    async () => {
      // Any HTTP answer will do: the server has no page on "/".
      const probe = `curl -s -m 3 -o /dev/null -w '%{http_code}' ${MUSIC_ASSISTANT.sendspinUrl}/`;
      const { stdout } = await ssh(`docker exec hassio_cli sh -c ${sh(probe)}`, { check: false });
      return /^[1-5]\d\d$/.test(stdout.trim());
    },
    { timeout: 300, interval: 3 },
  );
}
