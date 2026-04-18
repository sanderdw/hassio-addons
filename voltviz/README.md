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

This add-on has no configuration options. All settings are controlled through the VoltViz web interface.

## Ingress

This add-on uses Home Assistant Ingress for seamless integration. Click "OPEN WEB UI" in the add-on panel to access VoltViz directly within Home Assistant.

## Sendspin / Music Assistant

VoltViz supports [Music Assistant](https://music-assistant.io/) through [Sendspin](https://www.sendspin-audio.com/). Click the Sendspin button in the VoltViz UI and enter your server URL to visualize audio from any Sendspin-compatible server.

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
