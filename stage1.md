# Real Telemetry Integration — ROSBridge WebSocket

Connect the ASCEND GCS web interface to the drone's Jetson Orin Nano via **ROSBridge WebSocket**, receiving live MAVLink telemetry through MAVROS topics. The GCS keeps a simulation fallback for offline development.

## Architecture

```
Pixhawk FCU ──MAVLink──▶ Jetson Orin Nano (MAVROS) ──ROS Topics──▶ ROSBridge WebSocket Server ──ws://──▶ GCS Browser
```

The browser connects to `ws://<JETSON_IP>:9090` (ROSBridge default port) and subscribes to MAVROS topics. No npm dependencies needed — we use the browser-native `WebSocket` API + a lightweight `roslibjs`-style wrapper written from scratch.

## User Review Required

> [!IMPORTANT]
> **Jetson-side setup required:** The Jetson Orin Nano must be running:
> 1. `roslaunch mavros apm.launch` (or `px4.launch`) — to bridge Pixhawk MAVLink to ROS
> 2. `roslaunch rosbridge_server rosbridge_websocket_launch.launch` — to expose ROS topics over WebSocket on port 9090
>
> These are standard ROS packages. Install with: `sudo apt install ros-noetic-rosbridge-suite ros-noetic-mavros`

> [!WARNING]
> **Network requirement:** The laptop running the GCS browser must be on the **same network** as the Jetson. This can be a direct Ethernet cable, a WiFi router, or the Jetson's own WiFi hotspot.

## Proposed Changes

### ROSBridge Client Module

#### [NEW] [rosbridge.js](file:///c:/Users/User/OneDrive/Desktop/codinggg/Projects/GCS-interface/src/modules/rosbridge.js)

A zero-dependency WebSocket client that speaks the ROSBridge v2.0 protocol. Features:
- **`connect(url)`** — Opens WebSocket to `ws://<ip>:9090`
- **`subscribe(topic, msgType, callback)`** — Subscribes to a ROS topic
- **`publish(topic, msgType, msg)`** — Publishes to a ROS topic (for commands)
- **`callService(service, type, args)`** — Calls a ROS service (for arming, mode changes)
- Auto-reconnect with exponential backoff (1s → 2s → 4s → max 10s)
- Connection state events: `connected`, `disconnected`, `error`

Subscribed MAVROS topics:

| ROS Topic | Message Type | GCS Data Field |
|-----------|-------------|----------------|
| `/mavros/state` | `mavros_msgs/State` | `armed`, `mode`, `connected` |
| `/mavros/imu/data` | `sensor_msgs/Imu` | `roll`, `pitch` (from quaternion) |
| `/mavros/global_position/compass_hdg` | `std_msgs/Float64` | `heading` |
| `/mavros/local_position/pose` | `geometry_msgs/PoseStamped` | `altitude` (z) |
| `/mavros/local_position/velocity_body` | `geometry_msgs/TwistStamped` | `speed`, `vspeed` |
| `/mavros/battery` | `sensor_msgs/BatteryState` | `battery`, `voltage`, `current` |
| `/mavros/global_position/raw/satellites` | `std_msgs/UInt32` | `gps_sats` |
| `/mavros/vfr_hud` | `mavros_msgs/VFR_HUD` | Backup `speed`, `altitude`, `heading` |

---

### Telemetry Module Update

#### [MODIFY] [telemetry.js](file:///c:/Users/User/OneDrive/Desktop/codinggg/Projects/GCS-interface/src/modules/telemetry.js)

- Add a `mode` property: `'simulated'` or `'live'`
- New method `applyLiveData(data)` — accepts a data object from ROSBridge and writes it into `this.data` + pushes to `this.history`
- When in `'live'` mode, `tick()` becomes a no-op (real data drives the UI)
- The `updateUI()` and `drawGraph()` methods remain unchanged — they already read from `this.data`

---

### Main App Update

#### [MODIFY] [main.js](file:///c:/Users/User/OneDrive/Desktop/codinggg/Projects/GCS-interface/src/main.js)

- Import `ROSBridgeClient`
- Add connection logic: on page load, try to connect. If connection fails, fall back to simulated mode automatically
- In the render loop: only call `telemetry.tick()` when in simulated mode
- Update the `#conn-label` badge: show `LIVE` (green) or `SIMULATED` (yellow) or `DISCONNECTED` (red)

---

### HTML Updates

#### [MODIFY] [index.html](file:///c:/Users/User/OneDrive/Desktop/codinggg/Projects/GCS-interface/index.html)

- Add a small connection settings panel in the top app bar or sidebar:
  - IP address input field (default: `192.168.1.100`)
  - Port input (default: `9090`)
  - Connect / Disconnect button
  - Connection status indicator (already have `#conn-label`)

---

### Command Module Update

#### [MODIFY] [commands.js](file:///c:/Users/User/OneDrive/Desktop/codinggg/Projects/GCS-interface/src/modules/commands.js)

- Accept an optional `rosbridge` instance
- When `rosbridge` is connected and in live mode:
  - **ARM/DISARM** → call MAVROS service `/mavros/cmd/arming` (`mavros_msgs/CommandBool`)
  - **SET MODE** → call MAVROS service `/mavros/set_mode` (`mavros_msgs/SetMode`)
  - **TAKEOFF** → call MAVROS service `/mavros/cmd/takeoff` (`mavros_msgs/CommandTOL`)
  - **LAND** → set mode to `LAND`
  - **RTB** → set mode to `RTL`
  - **KILL** → call `/mavros/cmd/command` with MAV_CMD_COMPONENT_ARM_DISARM (force disarm)
- When not connected, fall back to existing simulated behavior (current code)

## Verification Plan

### Browser Testing
1. Run `npm run dev` in the GCS-interface directory
2. Open the GCS in the browser
3. **Simulated mode check:** Verify the connection badge shows "SIMULATED" and telemetry data still animates as before
4. **Connection UI check:** Verify the IP/Port input and Connect button appear. Attempt to connect to a non-existent IP — verify it shows "DISCONNECTED" and falls back to simulated mode gracefully
5. **Live mode check (requires Jetson):** If a Jetson is available, enter its IP, click Connect, verify the badge turns "LIVE" and real telemetry flows in

### Manual Verification
- The user should test with their actual Jetson Orin Nano + Pixhawk setup. Connect both to the same network, start MAVROS + ROSBridge on the Jetson, and enter the Jetson's IP in the GCS connection panel.
