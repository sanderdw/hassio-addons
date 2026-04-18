# Home Assistant Add-on: VoltViz

A dynamic, real-time music visualizer that transforms sound into stunning visual experiences. Synchronize with your system audio, microphone and [Music Assistant](https://music-assistant.io/) support (through [Sendspin](https://www.sendspin-audio.com/)) and watch your music come alive.

![VoltViz](https://raw.githubusercontent.com/sanderdw/voltviz/main/images/home-assistant/music-assistant.png)

## Features

- 30+ stunning visualization styles (Particle Effects, 3D, Retro, Festival, and more)
- Real-time audio input via microphone, system audio, or Sendspin streaming
- GPU-accelerated rendering with Three.js and WebGL
- Music Assistant integration through Sendspin
- Deep-link support for visualizer and settings via URL parameters

## Installation

1. Add the repository to Home Assistant: `https://github.com/sanderdw/hassio-addons`
2. Install the **VoltViz** add-on
3. Start the add-on
4. Click **OPEN WEB UI** to access VoltViz via Ingress

## Configuration

| Option | Description |
|--------|-------------|
| `SENDSPIN_URL` | (Optional) Internal URL of your Sendspin server for server-side proxying. Example: `http://d5369777-music-assistant:8927` |

## Ingress

This add-on uses Home Assistant Ingress for seamless integration. Click "OPEN WEB UI" in the add-on panel to access VoltViz directly within Home Assistant.

## Sendspin / Music Assistant

VoltViz supports [Music Assistant](https://music-assistant.io/) through [Sendspin](https://www.sendspin-audio.com/).

### Server-side proxy (recommended)

By default, VoltViz connects to Sendspin directly from the browser. This only works on internal networks without HTTPS (due to mixed content restrictions). To solve this, the add-on can proxy Sendspin through the server side:

1. In the add-on **Configuration** tab, set `SENDSPIN_URL` to your Music Assistant's internal address:
   ```
   http://d5369777-music-assistant:8927
   ```
2. Restart the add-on
3. Open VoltViz and click the Sendspin button
4. Enter `./sendspin-proxy/` as the server URL and click Connect

This routes all Sendspin traffic (including WebSocket) through HA Ingress, so it works over HTTPS without direct network access to the Music Assistant server.

You can also bookmark it by appending `?sendspin=./sendspin-proxy/` to the VoltViz URL — the connection dialog will open automatically with the URL pre-filled.

### Direct connection

Alternatively, click the Sendspin button and enter the server URL directly (e.g. `http://192.168.1.100:8927`). This requires HTTP access from the browser to the server.

## Deep-Link Support

You can link directly to a specific visualizer with custom settings using URL parameters:

| Parameter   | Description                         | Default |
|-------------|-------------------------------------|---------|
| viz         | Visualizer name (e.g. tunnel, sphere) | sphere  |
| sensitivity | Audio reactivity multiplier (0.1–3.0) | 1.0     |
| speed       | Animation speed multiplier (0.1–3.0) | 1.0     |
| hueShift    | Color shift in degrees (0–360)      | 0       |
| scale       | Element scale multiplier (0.5–3.0)  | 1.0     |
| sendspin    | Sendspin server URL                 |         |

## More info

- [VoltViz website](https://voltviz.com/)
- [VoltViz GitHub](https://github.com/sanderdw/voltviz)
