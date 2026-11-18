// Home Assistant itself: onboarding, logging in and opening add-ons through ingress, the way the
// frontend does it.
import { HA_URL, waitFor } from './vm.mjs';

const CLIENT_ID = `${HA_URL}/`;

/** The owner account that `haos.mjs up` creates. Local test VM only. */
export const E2E_USER = { name: 'E2E', username: 'e2e', password: 'e2e-password' };

async function post(pathname, body, { token, form = false } = {}) {
  const response = await fetch(`${HA_URL}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form ? new URLSearchParams(body) : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`POST ${pathname}: ${response.status} ${(await response.text()).slice(0, 300)}`);
  }
  return response.json();
}

const exchangeCode = async (code) =>
  (await post('/auth/token', { grant_type: 'authorization_code', code, client_id: CLIENT_ID }, { form: true }))
    .access_token;

/** Onboarding steps that are still open. Empty once Home Assistant is onboarded. */
async function openOnboardingSteps() {
  const response = await fetch(`${HA_URL}/api/onboarding`);
  if (response.status === 404) return []; // the onboarding API is gone once it is complete
  if (!response.ok) throw new Error(`GET /api/onboarding: ${response.status}`);
  return (await response.json()).filter((step) => !step.done).map((step) => step.step);
}

async function logIn() {
  const flow = await post('/auth/login_flow', {
    client_id: CLIENT_ID,
    handler: ['homeassistant', null],
    redirect_uri: CLIENT_ID,
  });
  const result = await post(`/auth/login_flow/${flow.flow_id}`, {
    client_id: CLIENT_ID,
    username: E2E_USER.username,
    password: E2E_USER.password,
  });
  if (result.type !== 'create_entry') {
    throw new Error(`Logging in as ${E2E_USER.username} failed: ${JSON.stringify(result.errors ?? result)}`);
  }
  return exchangeCode(result.result);
}

let tokenPromise;

/** An access token for the e2e owner account. Onboards Home Assistant on first use. */
export function accessToken() {
  tokenPromise ??= (async () => {
    await waitFor('Home Assistant to answer', async () => (await fetch(`${HA_URL}/manifest.json`)).ok, {
      timeout: 600,
      interval: 3,
    });
    const open = await openOnboardingSteps();
    let token;
    if (open.includes('user')) {
      const { auth_code: code } = await post('/api/onboarding/users', {
        client_id: CLIENT_ID,
        language: 'en',
        ...E2E_USER,
      });
      token = await exchangeCode(code);
    } else {
      token = await logIn();
    }
    if (open.includes('core_config')) await post('/api/onboarding/core_config', {}, { token });
    if (open.includes('analytics')) await post('/api/onboarding/analytics', {}, { token });
    if (open.includes('integration')) {
      await post('/api/onboarding/integration', { client_id: CLIENT_ID, redirect_uri: CLIENT_ID }, { token });
    }
    return token;
  })();
  tokenPromise.catch(() => {
    tokenPromise = undefined;
  });
  return tokenPromise;
}

/** Sends one command over Home Assistant's WebSocket API and returns its result. */
export async function callWS(message) {
  const token = await accessToken();
  const socket = new WebSocket(`${HA_URL.replace(/^http/, 'ws')}/api/websocket`);
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`No reply to ${message.type}`)), 60_000);
      socket.addEventListener('error', () => reject(new Error('WebSocket connection failed')));
      socket.addEventListener('close', () => reject(new Error('WebSocket closed before a reply')));
      socket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'auth_required') {
          socket.send(JSON.stringify({ type: 'auth', access_token: token }));
        } else if (data.type === 'auth_ok') {
          socket.send(JSON.stringify({ id: 1, ...message }));
        } else if (data.type === 'auth_invalid') {
          reject(new Error(`WebSocket login failed: ${data.message}`));
        } else if (data.type === 'result') {
          clearTimeout(timer);
          if (data.success) resolve(data.result);
          else reject(new Error(`${message.type}: ${data.error?.message ?? JSON.stringify(data.error)}`));
        }
      });
    });
  } finally {
    socket.close();
  }
}

/**
 * Calls Home Assistant's REST API as the e2e owner and returns the JSON answer.
 * @param {string} method
 * @param {string} pathname for example `/api/states/sensor.x`
 * @param {object} [body]
 * @returns {Promise<any>} the answer, or undefined for 404 Not Found
 */
export async function haApi(method, pathname, body) {
  const response = await fetch(`${HA_URL}${pathname}`, {
    method: method.toUpperCase(),
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`${method.toUpperCase()} ${pathname}: ${response.status} ${(await response.text()).slice(0, 300)}`);
  }
  return response.json();
}

/** The integrations of a domain that Home Assistant has set up (its config entries). */
export const configEntries = (domain) => callWS({ type: 'config_entries/get', domain });

/** Setup flows that wait for the user, such as discovered integrations. */
export const flowsInProgress = (domain) =>
  callWS({ type: 'config_entries/flow/progress' }).then((flows) => flows.filter((flow) => flow.handler === domain));

/**
 * Removes an integration from Home Assistant: its config entries and the flows that offer it.
 * @param {string} domain
 */
export async function removeIntegration(domain) {
  for (const entry of await configEntries(domain)) {
    await haApi('delete', `/api/config/config_entries/entry/${entry.entry_id}`);
  }
  for (const flow of await flowsInProgress(domain)) {
    await haApi('delete', `/api/config/config_entries/flow/${flow.flow_id}`);
  }
}

/**
 * Waits for Home Assistant to offer a discovered integration and adds it, as clicking Add on
 * the Discovered card does. Its confirm step has no fields.
 * @param {string} domain
 * @returns {Promise<object>} the result of the last step
 */
export async function addDiscoveredIntegration(domain, { timeout = 120 } = {}) {
  const flow = await waitFor(
    `Home Assistant to discover ${domain}`,
    async () => (await flowsInProgress(domain))[0],
    { timeout },
  );
  return haApi('post', `/api/config/config_entries/flow/${flow.flow_id}`, {});
}

/**
 * Opens an ingress session, as the frontend does before it shows an add-on's panel.
 * @param {string} ingressUrl the add-on's `ingress_url` (`/api/hassio_ingress/<token>/`)
 * @returns {Promise<(path?: string, init?: RequestInit) => Promise<Response>>} fetches a path
 *   below the add-on's ingress URL, through Home Assistant
 */
export async function openIngress(ingressUrl) {
  const { session } = await callWS({ type: 'supervisor/api', endpoint: '/ingress/session', method: 'post' });
  return (pathname = '', init = {}) =>
    fetch(new URL(pathname, `${HA_URL}${ingressUrl}`), {
      ...init,
      headers: {
        ...init.headers,
        Cookie: [`ingress_session=${session}`, init.headers?.Cookie].filter(Boolean).join('; '),
      },
    });
}
