# ASCEND GCS KINETIC

This repository houses the Ground Control Station (GCS) user interface for the ASCEND UAV mission. The interface is designed to connect to the UAV's onboard computer (Raspberry Pi 4 with AI Hat) over a local network, streaming live MAVLink telemetry and AI payload detections in real time via a WebSocket ROSBridge connection.

## System Architecture

The communications pipeline operates as follows:
Pixhawk FCU (MAVLink) -> Raspberry Pi 4 (MAVROS) -> ROS Topics -> ROSBridge WebSocket Server -> GCS Browser

The GCS relies entirely on native browser features and the WebSocket protocol. No local backend processing is required; the UI runs natively in the browser via Vite and dynamically updates components as data arrives from the Pi.

## Prerequisites & Pi 4 Setup

To establish a live connection, the Raspberry Pi 4 must be configured and running the following ROS nodes:

1. MAVROS: Translates the Pixhawk MAVLink stream into standard ROS topics.
Command: `roslaunch mavros px4.launch` (or `apm.launch` depending on your flight stack)

2. ROSBridge Server: Exposes the ROS topics globally over a WebSocket connection.
Command: `roslaunch rosbridge_server rosbridge_websocket_launch.launch`
By default, this server listens on port 9090.

Ensure your laptop running the GCS is connected to the same local area network (LAN) as the Raspberry Pi. This can be achieved by connecting both devices to the same router, or by broadcasting a WiFi hotspot directly from the Pi.

## Running the GCS Locally

1. Install dependencies (Node.js required):
   `npm install`
2. Start the Vite development server:
   `npm run dev`
3. Open a modern web browser and navigate to `http://localhost:5173`.

If the GCS is not connected to a Pi 4, it defaults to a "SIMULATED" environment, replaying randomized data into the UI components for interface testing and layout evaluation. 

## Connecting the GCS to the Pi 4

1. Launch the GCS interface.
2. Locate the connection panel in the top-right corner of the Application Bar.
3. Input the exact IPv4 address of your Raspberry Pi 4 (e.g., 192.168.1.100).
4. Leave the port at 9090 (unless explicitly changed in your ROSBridge configuration).
5. Click "Connect".

Once a handshake is confirmed, the yellow "SIMULATED" badge will turn into a green "LIVE" indicator. The application will immediately halt all testing algorithms and overwrite the UI with true realtime data from the MAVROS topics.

## Operation & Telemetry Mappings

### Telemetry Dashboard
The dashboard displays primary flight data (Altitude, Ground Speed, Heading, Battery, Voltage, Current, GPS Satellites) populated from the incoming ROS topics. If data is actively streaming, the UI calculates the relative latency (WebSocket gap between transmissions) and actively adjusts the "Link Quality" indicator. A gap exceeding 2 seconds will force the Link Quality drop to 0 percent.

### Detections & Payload (AI Hat)
The system listens to the `/ai/detections` ROS topic. When the Pi's AI Hat publishes a valid JSON string detailing bounding boxes or feature classes, the Live Detection Feed and Log will populate with the identified features.

### Command Center
When operating in LIVE mode, interaction buttons trigger direct MAVROS service calls over the network:
- Arming / Disarming: Calls `/mavros/cmd/arming`
- Set Flight Mode: Calls `/mavros/set_mode`
- Takeoff: Issues `CommandTOL` via `mavros_msgs/CommandTOL`
- Land / RTL: Instructs the flight controller via flight mode transition (`LAND` or `RTL`)
- Kill Switch: Fires a forced disarming protocol command to kill motors instantly.

Warning: Always exercise extreme caution when triggering commands through the network logic. Hardware emergency overrides (RC killswitch) must always be maintained by the safety pilot on the ground.
