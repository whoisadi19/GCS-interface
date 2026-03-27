# Connecting the ASCEND GCS to your Raspberry Pi 4 via Docker

This step-by-step guide is designed to help you launch the communication bridge between your Pixhawk drone and the GCS laptop, specifically using Docker to keep your Raspberry Pi's environment clean.

---

## Step 1: The Physical Connections
1. Plug the Pixhawk into your Raspberry Pi 4 using a standard USB cable (or through UART GPIO pins if preferred).
2. Ensure your Windows Laptop and the Raspberry Pi 4 are connected to the **same Wi-Fi network** (e.g., your home router or a mobile hotspot).

## Step 2: The "Docker Run" Command (On the Pi 4)
When you use Docker, your container needs two critical permissions to work with the GCS:
1. It needs access to the physical USB port to talk to the Pixhawk.
2. It needs to open Port 9090 so your laptop can listen in on the network.

Open the terminal on your Raspberry Pi 4 and run your Docker container. Assuming your Docker image has standard ROS Noetic, MAVROS, and ROSBridge loaded, your command will look like this:

```bash
docker run -it --rm \
  --net=host \
  --privileged \
  -v /dev:/dev \
  [YOUR_DOCKER_IMAGE_NAME] \
  bash
```
* **`--net=host`**: This tells Docker to share the Pi's network directly, automatically exposing Port 9090 to your laptop without complicated network routing.
* **`--privileged`** and **`-v /dev:/dev`**: This gives Docker complete permission to see the USB cable plugged into your Pixhawk (which usually shows up as `/dev/ttyACM0` or `/dev/ttyUSB0`).

*(Note: Replace `[YOUR_DOCKER_IMAGE_NAME]` with whatever Docker image you built or downloaded).*

## Step 3: Start the Communications (Inside the Docker Container)
Once you hit enter on the command above, your terminal will now be operating *inside* the Docker container.

Type this command to start the Pixhawk translator (MAVROS) in the background. *(Note: Double check if your Pixhawk is `/dev/ttyACM0` or `/dev/ttyUSB0`)*:
```bash
roslaunch mavros px4.launch fcu_url:=/dev/ttyACM0:57600 &
```

Then, type this to start the Web Server so your laptop can connect:
```bash
roslaunch rosbridge_server rosbridge_websocket_launch.launch
```

## Step 4: Find the Pi's IP Address
Your laptop needs to know exactly where the Pi is on the internet. Open a **new, blank terminal window** on your Raspberry Pi (outside of Docker) and type:
```bash
hostname -I
```
It will print out a string of numbers like `192.168.1.45`. **Write this down.**

## Step 5: Boot Up the Dashboard (On Your Laptop)
Now switch to your Windows Laptop. Open your terminal in VS Code (where your `GCS-interface` files are stored) and run these two commands:
```bash
npm install
npm run dev
```
Wait for the server to say it's ready, then open your Chrome or Edge browser and navigate to:
**`http://localhost:5173`**

## Step 6: Connect the Streams!
1. Looking at the GCS dashboard in your browser, find the Connection Panel in the top-right corner next to the yellow **SIMULATED** badge.
2. In the **IP Address** box, type the IP you wrote down from Step 4 (e.g., `192.168.1.45`).
3. Leave the **Port** box as `9090`.
4. Click **Connect**.

Because you used `--net=host` in your Docker command, the port passes perfectly through the container, the GCS locks onto the signal, and that yellow simulation dot will turn into a green **LIVE** feed!
