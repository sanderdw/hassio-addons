// VoltViz, end to end: the add-on built from the working tree, its page on its own port and
// through Home Assistant ingress, and its Sendspin proxy to a real Music Assistant add-on.
//
// Each run reinstalls the add-on. The visualizer itself runs in a browser and is not covered.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  UPDATE_SERVER,
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
import { callWS, openIngress } from '../lib/homeassistant.mjs';
import { MUSIC_ASSISTANT, ensureMusicAssistant } from '../lib/music-assistant.mjs';
import { HA_URL, REPO_DIR, addonUrl, requireVm, withServerUnreachable } from '../lib/vm.mjs';

const ADDON_DIR = 'voltviz';
const SLUG = 'local_voltviz';
const HOST_PORT = 7777;
const DIRECT_URL = addonUrl(HOST_PORT);
/** Where the add-on sends a visitor, so the app connects through the add-on's Sendspin proxy. */
const SENDSPIN_REDIRECT = '?sendspin=./sendspin-proxy/';

const config = JSON.parse(await fs.readFile(path.join(REPO_DIR, ADDON_DIR, 'config.json'), 'utf8'));
const toWebSocket = (url) => url.replace(/^http/, 'ws');
const pageIsUp = async () => (await fetch(`${DIRECT_URL}/${SENDSPIN_REDIRECT}`)).ok;

/** The `src` and `href` values of a page. */
const linksIn = (html) => [...html.matchAll(/(?:src|href)="([^"]*)"/g)].map((match) => match[1]);

/**
 * Says hello to a Sendspin server as a client that only wants metadata, and returns the
 * server's first message.
 * @param {string} url of the server's WebSocket
 * @param {object} [options] for the WebSocket, for example `headers`
 */
function sendspinHello(url, options) {
  const hello = {
    type: 'client/hello',
    payload: {
      client_id: 'voltviz-e2e',
      name: 'VoltViz e2e test',
      version: 1,
      supported_roles: ['metadata@v1'],
      device_info: { product_name: 'e2e test', manufacturer: 'e2e', software_version: 'e2e' },
    },
  };
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, options);
    const fail = (reason) => {
      clearTimeout(timer);
      socket.close();
      reject(new Error(`Sendspin on ${url}: ${reason}`));
    };
    const timer = setTimeout(() => fail('no answer in 10 seconds'), 10_000);
    socket.addEventListener('open', () => socket.send(JSON.stringify(hello)));
    socket.addEventListener('error', () => fail('the connection failed'));
    socket.addEventListener('close', () => fail('the connection closed without an answer'));
    socket.addEventListener('message', (event) => {
      clearTimeout(timer);
      socket.close();
      resolve(JSON.parse(event.data));
    });
  });
}

describe('VoltViz add-on', () => {
  before(async () => {
    await requireVm();
    await waitForSupervisor({ timeout: 600 });
    await stopOtherAddons([MUSIC_ASSISTANT.slug]);
    await ensureMusicAssistant();
    await uninstallAddon(SLUG);
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
    assert.deepEqual((await addonInfo(SLUG)).network, { '80/tcp': null });
  });

  it('starts with its default options', async () => {
    assert.equal(config.options.SENDSPIN_URL, MUSIC_ASSISTANT.sendspinUrl, 'the default points at Music Assistant');
    // Manual boot: the tests start the add-on themselves.
    await configureAddon(SLUG, { boot: 'manual', network: { '80/tcp': HOST_PORT } });
    await secondsToStart(SLUG, pageIsUp, { timeout: 120 });
    assert.equal((await addonInfo(SLUG)).state, 'started');
    assert.match(await addonLogs(SLUG, 200), /Sendspin proxy enabled -> http:\/\/d5369777-music-assistant:8927/);
  });

  describe('on its own port', () => {
    it('sends a visitor to the page that uses the Sendspin proxy', async () => {
      const response = await fetch(`${DIRECT_URL}/`, { redirect: 'manual' });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), SENDSPIN_REDIRECT);
    });

    it('serves the app and its script', async () => {
      const response = await fetch(`${DIRECT_URL}/`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /text\/html/);
      const html = await response.text();
      assert.match(html, /<title>[^<]*VoltViz/i);

      const script = linksIn(html).find((link) => /assets\/index-.*\.js$/.test(link));
      assert.ok(script, 'the page links its main script');
      const asset = await fetch(new URL(script, `${DIRECT_URL}/`));
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get('content-type'), /javascript/);
    });

    it('proxies Sendspin to Music Assistant', async () => {
      const answer = await sendspinHello(`${toWebSocket(DIRECT_URL)}/sendspin-proxy/sendspin`);
      assert.equal(answer.type, 'server/hello');
      assert.match(answer.payload.name, /Music Assistant/);
    });

    it("tells the app Music Assistant's ingress entry", async () => {
      const response = await fetch(`${DIRECT_URL}/ma-config.json`);
      assert.equal(response.status, 200);
      const musicAssistant = await addonInfo(MUSIC_ASSISTANT.slug);
      assert.deepEqual(await response.json(), { ingress_entry: `${musicAssistant.ingress_entry}/` });
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

    it('sends a visitor to the page that uses the Sendspin proxy', async () => {
      const response = await ingress('', { redirect: 'manual' });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), SENDSPIN_REDIRECT);
    });

    it('serves the app with links that stay below the ingress path', async () => {
      const response = await ingress(SENDSPIN_REDIRECT);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /<title>[^<]*VoltViz/i);

      // A link that starts with "/" would leave the add-on and end up at Home Assistant itself.
      const links = linksIn(html);
      const absolute = links.filter((link) => link.startsWith('/'));
      assert.deepEqual(absolute, [], 'no link starts at the root of Home Assistant');

      const script = links.find((link) => /assets\/index-.*\.js$/.test(link));
      assert.ok(script, 'the page links its main script');
      const asset = await ingress(script);
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get('content-type'), /javascript/);
    });

    it('proxies Sendspin to Music Assistant', async () => {
      const { session } = await callWS({ type: 'supervisor/api', endpoint: '/ingress/session', method: 'post' });
      const answer = await sendspinHello(`${toWebSocket(HA_URL)}${info.ingress_url}sendspin-proxy/sendspin`, {
        headers: { Cookie: `ingress_session=${session}` },
      });
      assert.equal(answer.type, 'server/hello');
      assert.match(answer.payload.name, /Music Assistant/);
    });
  });

  it('stops without an error', async () => {
    assert.equal(await stateAfterStop(SLUG), 'stopped');
  });

  describe('when the update server does not answer', () => {
    it('still serves the app within half a minute', async () => {
      const seconds = await withServerUnreachable(UPDATE_SERVER, () =>
        secondsToStart(SLUG, pageIsUp, { timeout: 240 }),
      );
      assert.ok(seconds <= 30, `the page answered after ${seconds} seconds`);
    });
  });

  describe('with an empty Sendspin URL', () => {
    after(async () => {
      // Back to the default options, for a look at the add-on after the tests.
      await configureAddon(SLUG, { options: config.options });
      await secondsToStart(SLUG, pageIsUp, { timeout: 120 });
    });

    it('serves the app without a Sendspin proxy', async () => {
      // Leaving the option out brings its default back; an empty value switches the proxy off.
      await configureAddon(SLUG, { options: { SENDSPIN_URL: '' } });
      await secondsToStart(SLUG, pageIsUp, { timeout: 120 });
      assert.doesNotMatch(await addonLogs(SLUG, 200), /Sendspin proxy enabled/);
      await assert.rejects(
        sendspinHello(`${toWebSocket(DIRECT_URL)}/sendspin-proxy/sendspin`),
        /the connection failed|closed without an answer/,
      );
    });
  });
});
