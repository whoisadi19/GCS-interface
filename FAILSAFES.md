# ASCEND — Fail-Safe Architecture

**IRoC-U 2026 · Team UAS NMIMS (ID 11003)**
**Autonomous Space-exploration & Crater Exploration and Navigation Drone**

---

## 1. Design Philosophy

ASCEND operates in a GNSS-denied, Mars-analog environment with no possibility of real-time human intervention during flight. Every fail-safe follows a **"Detect → Escalate → Act"** pipeline enforced by a **Supervisory Layer Monitor** running at **~30 Hz** on the Jetson Orin Nano. The escalation tiers are:

| Tier | Action | Trigger Window |
|------|--------|---------------|
| **T0** | Log & Continue | Transient anomaly, < 500 ms |
| **T1** | Hover & Reassess | Persistent anomaly, 500 ms – 2 s |
| **T2** | Return-To-Base (RTB) | Critical degradation, > 2 s |
| **T3** | Emergency Land | Loss of control authority |
| **T4** | Motor Kill (last resort) | Imminent collision / catastrophic failure |

---

## 2. Sensor & Perception Fail-Safes

### 2.1 Visual-Inertial Odometry (VIO) — Intel RealSense D435i

| ID | Fault | Detection Method | Response |
|----|-------|-----------------|----------|
| VIO-01 | Stereo feature tracking lost | Feature count < 30 for > 500 ms | **T1** — Hover, switch to IMU-only dead-reckoning; re-initialise VIO. If not recovered in 5 s → **T2** RTB on last known heading. |
| VIO-02 | IMU drift exceeds threshold | Covariance diagonal > σ² limit | **T1** — Reduce speed to 0.3 m/s, increase VIO re-initialisation frequency. |
| VIO-03 | Camera feed frozen / black | Frame delta hash unchanged for 3 consecutive frames | **T1** — Hover; attempt camera soft-reset via USB re-enumeration. If failed → **T2** RTB. |
| VIO-04 | Lens obstruction (dust/debris) | Mean image intensity drop > 60% vs baseline | **T1** — Hover; if no recovery in 3 s → **T2** RTB. |
| VIO-05 | TF frame discontinuity | `odom → base_link` transform age > 100 ms | **T0** — Log warning. If sustained > 1 s → **T1** Hover. |

### 2.2 Altitude Sensor — Benewake TF-LUNA (1D LiDAR)

| ID | Fault | Detection Method | Response |
|----|-------|-----------------|----------|
| ALT-01 | Altitude reading NaN / zero | Range validation check each tick | **T1** — Fallback to barometric altitude estimate from FCU. Log sensor fault. |
| ALT-02 | Altitude spike > 2 m jump in < 200 ms | Rate-of-change filter | **T0** — Reject reading, use EKF-smoothed estimate. If 3 consecutive spikes → **T1** Hover. |
| ALT-03 | Sensor complete failure (no data for > 500 ms) | Watchdog timer on `/tf_luna/range` topic | **T1** — Switch to barometric + VIO fused altitude. Flag for post-flight maintenance. If also in LAND phase → use conservative 0.1 m/s descent rate. |
| ALT-04 | Ground surface mismatch during landing | Expected vs measured altitude divergence > 0.5 m in LAND state | **T1** — Abort landing, climb 1 m, re-evaluate terrain. |

### 2.3 ML Perception Pipeline — YOLOv8n + Few-Shot Classifier

| ID | Fault | Detection Method | Response |
|----|-------|-----------------|----------|
| ML-01 | TensorRT engine crash / segfault | Process health monitor (heartbeat) | **T0** — Restart inference node. If 3 restarts within 60 s → **T1** Hover, continue mission without perception (waypoint-only). |
| ML-02 | Inference latency > 200 ms (frame starvation) | Timestamp delta between published detections | **T0** — Drop frames, reduce input resolution to 320×240. Log performance warning. |
| ML-03 | False-positive flood (> 10 detections/frame for > 5 s) | Detection count anomaly filter | **T0** — Raise confidence threshold from 0.5 to 0.8 dynamically. Log for post-flight review. |
| ML-04 | Few-shot classifier confidence < 0.3 on all classes | Confidence score analysis | **T0** — Discard classification, mark region as "UNCLASSIFIED" for manual review. Continue SEARCH. |
| ML-05 | Seed image set empty / corrupted | Pre-flight checksum validation | **Pre-flight ABORT** — Refuse to arm until valid seed images are loaded. |

---

## 3. Flight Controller (FCU) Fail-Safes — Pixhawk / CubePilot

### 3.1 Communication Link

| ID | Fault | Detection Method | Response |
|----|-------|-----------------|----------|
| FCU-01 | Companion ↔ FCU serial link lost | MAVLink heartbeat timeout > 1 s on `/mavros/state` | **T2** — FCU autonomously enters RTL mode (firmware-level). Companion attempts serial reconnect. |
| FCU-02 | GCS ↔ Drone telemetry link lost | RSSI < -90 dBm or heartbeat timeout > 3 s | **T1** — Continue autonomous mission. If > 30 s no link → **T2** RTB. |
| FCU-03 | MAVLink message CRC errors > 5% | CRC validation on incoming packets | **T0** — Log warning, request retransmission. If sustained → **T1** reduce telemetry rate to conserve bandwidth. |

### 3.2 Flight Stability

| ID | Fault | Detection Method | Response |
|----|-------|-----------------|----------|
| FCU-04 | Attitude estimation divergence | EKF innovation > threshold (FCU internal) | **T2** — FCU enters LAND mode automatically. |
| FCU-05 | Vibration levels critical | Accelerometer clipping count > 100/s | **T1** — Reduce speed to 0.3 m/s, log mechanical warning. If sustained > 10 s → **T2** RTB. |
| FCU-06 | Geofence breach | Position exceeds pre-programmed boundary | **T2** — Immediate RTB along shortest safe path. If breach + low battery → **T3** Emergency Land. |
| FCU-07 | Altitude exceeds ceiling (5 m AGL) | FCU altitude limit parameter | **T1** — Auto-descend to 3 m AGL, log warning. |

---

## 4. Power System Fail-Safes

| ID | Fault | Detection Method | Response |
|----|-------|-----------------|----------|
| PWR-01 | Battery voltage < 13.2 V (3.3 V/cell) | Voltage monitor @ 10 Hz | **T1** — Warning. Reduce mission speed to conserve power. Begin RTB planning. |
| PWR-02 | Battery voltage < 12.8 V (3.2 V/cell) | Voltage monitor | **T2** — Immediate RTB. Cancel current waypoint. |
| PWR-03 | Battery voltage < 12.0 V (3.0 V/cell) | Voltage monitor | **T3** — Emergency Land at current position. |
| PWR-04 | Battery capacity < 20% | Coulomb counter / mAh consumed estimate | **T1** — Trigger sortie end sequence: RETURN → LAND → DOCK → RECHARGE. |
| PWR-05 | Battery capacity < 10% | Coulomb counter | **T2** — Abandon RTB if distance > estimated range. Emergency Land. |
| PWR-06 | Current draw spike > 25 A (sustained > 3 s) | Current sensor on power module | **T1** — Check for motor obstruction. Reduce throttle. If sustained → **T3** Emergency Land (possible prop strike). |
| PWR-07 | Voltage sag > 1 V on throttle command | dV/dt correlation with throttle input | **T0** — Log battery health warning. If sustained → **T1** reduce maximum throttle to 70%. |
| PWR-08 | Charging pad contact lost during RECHARGE | Charging current drops to 0 while in DOCK/RECHARGE state | **T0** — Log error, request pilot visual check via GCS. Retry charge after re-positioning attempt. |

---

## 5. Compute Platform Fail-Safes — Jetson Orin Nano

| ID | Fault | Detection Method | Response |
|----|-------|-----------------|----------|
| CPU-01 | CPU temperature > 85°C | `tegrastats` thermal monitor | **T0** — Throttle inference to half rate. Enable fan to max. If > 95°C → **T1** Hover, disable non-critical nodes. |
| CPU-02 | GPU memory exhaustion | CUDA OOM error handler | **T0** — Kill lowest-priority GPU process (e.g., visualization). Restart inference with reduced batch size. |
| CPU-03 | Kernel panic / watchdog timeout | Hardware watchdog timer (Jetson built-in) | **T3** — FCU automatically detects companion computer loss (heartbeat timeout). Enters RTL. |
| CPU-04 | ROS Master crash | `/rosout` heartbeat monitor | **T0** — Auto-restart `roscore` via `systemd` service. If 3 restarts within 60 s → **T2** FCU-level RTB. |
| CPU-05 | Storage full (log overflow) | Filesystem check `df` > 95% used | **T0** — Rotate and compress oldest rosbag. Disable verbose logging. |
| CPU-06 | System clock drift > 500 ms | NTP / PTP comparison with FCU clock | **T0** — Re-sync time. If TF transforms become stale → **T1** Hover, re-calibrate VIO. |

---

## 6. ROS Middleware Reliability Fail-Safes

| ID | Fault | Detection Method | Response |
|----|-------|-----------------|----------|
| ROS-01 | Topic transport latency > 100 ms | `rosbag` delay analysis on critical topics | **T0** — Log warning. If latency > 500 ms → **T1** Hover, reduce publish rates. |
| ROS-02 | TF tree broken / missing frames | Real-time TF tree audit (`tf_monitor`) | **T1** — Hover. Attempt TF broadcaster restart. If `map → odom` missing → **T2** RTB. |
| ROS-03 | Critical node crash | `rosnode ping` + heartbeat subscription | **T0** — `systemd` auto-restart. If navigation node dead > 3 s → **T1** Hover. If perception node dead → continue waypoint-only. |
| ROS-04 | CPU load > 90% sustained > 60 s | `/proc/loadavg` monitor | **T0** — Kill non-essential nodes (visualization, logging). If still > 90% → **T1** reduce perception framerate to 5 FPS. |
| ROS-05 | Message queue overflow (subscriber backlog) | Queue depth monitor > 80% on critical topics | **T0** — Increase queue size or drop old messages (LIFO policy). Log backpressure event. |

---

## 7. Mission-Level / FSM Fail-Safes

| ID | Fault | Detection Method | Response |
|----|-------|-----------------|----------|
| FSM-01 | FSM state stuck (no transition for > 60 s) | State timer watchdog | **T1** — Log warning. If in SEARCH and no progress → advance to RETURN. |
| FSM-02 | Sortie timeout (mission time > T_max) | Global mission timer | **T2** — Force RTB regardless of mission completion status. |
| FSM-03 | Landing zone unsafe (obstacle detected at LZ) | Downward camera obstacle detection during LAND | **T1** — Abort landing, climb 2 m, search for alternate clear zone within 5 m radius. If none found → Emergency Land with slow descent. |
| FSM-04 | Docking alignment failure (> 3 attempts) | Docking sensor feedback (copper pad contact) | **T0** — Log. Attempt repositioning. If 5 failures → Land adjacent to pad, flag for manual recovery. |
| FSM-05 | Duplicate waypoint revisit detected | Visited-waypoint set comparison | **T0** — Skip waypoint, advance to next. Log inefficiency. |
| FSM-06 | All waypoints exhausted but no targets found | Mission completion check | **T0** — Expand search area by 10%. If still no targets after 2nd pass → RTB with "no detection" report. |
| FSM-07 | Autonomous takeoff altitude not reached within 10 s | Altitude monitor after TAKEOFF command | **T2** — Abort takeoff, disarm. Log possible motor or weight issue. |

---

## 8. Autonomous Charging Interface Fail-Safes

| ID | Fault | Detection Method | Response |
|----|-------|-----------------|----------|
| CHG-01 | Charging current < expected within 30 s of dock | Current sensor on charging circuit | **T0** — Re-attempt alignment. If 3 attempts fail → flag for manual recovery. |
| CHG-02 | Battery temperature > 45°C during charge | Battery thermistor | **T0** — Pause charging until temp < 40°C. If > 55°C → **T1** Abort charge, power down. Alert GCS. |
| CHG-03 | Overcharge protection — voltage > 16.8 V (4.2 V/cell) | Voltage monitor | **T0** — Immediately cut charging circuit. Log BMS anomaly. |
| CHG-04 | Charge time exceeds T_charge_max | Charging timer | **T0** — Stop charging, report partial charge. Allow next sortie with reduced mission time. |

---

## 9. Environmental Hazard Fail-Safes

| ID | Fault | Detection Method | Response |
|----|-------|-----------------|----------|
| ENV-01 | Wind gust — attitude oscillation > ±15° | IMU roll/pitch rate-of-change | **T1** — Reduce altitude to 1.5 m, reduce speed. If oscillation > ±25° → **T3** Emergency Land. |
| ENV-02 | Dust cloud / visibility loss | Camera image entropy drops below threshold | **T1** — Hover, wait for visibility to recover (max 30 s). If no recovery → **T2** RTB using last known VIO heading. |
| ENV-03 | Terrain slope > 20° at landing zone | TF-LUNA + VIO slope estimation during approach | **T1** — Reject landing zone, search for flatter terrain. |
| ENV-04 | Crater edge detection (fall hazard) | Depth discontinuity in stereo point cloud > 1.5 m | **T1** — Halt forward motion, plan path around hazard. Increase safety margin to 1 m from edge. |

---

## 10. Pre-Flight Mandatory Checks (ARM Inhibitors)

The vehicle **SHALL NOT** arm unless all of the following pass:

| Check | Criteria | Source |
|-------|----------|--------|
| Battery voltage | ≥ 15.2 V (3.8 V/cell minimum) | Power module |
| VIO initialisation | Feature count > 100, covariance nominal | RealSense + VIO node |
| TF-LUNA range valid | Reading within 0.1–8 m, not NaN | LiDAR driver |
| FCU heartbeat | MAVLink heartbeat received within last 1 s | `/mavros/state` |
| ROS critical nodes alive | Navigation, Perception, VIO, FCU bridge all `OK` | `rosnode ping` |
| Seed images loaded | ≥ 1 valid seed image per target class | Few-shot classifier |
| Disk space | > 2 GB free for logging | `df` check |
| GPS satellites (if applicable) | ≥ 6 sats (not required in GNSS-denied mode) | FCU |
| Geofence loaded | Valid geofence polygon uploaded | FCU parameter check |
| CPU temperature | < 75°C | `tegrastats` |

---

## 11. Fail-Safe Interaction Matrix

This matrix shows how multiple simultaneous failures escalate:

| Condition A | Condition B | Combined Response |
|-------------|-------------|-------------------|
| VIO lost | Battery < 20% | **T3** — Emergency Land (no nav + low power = cannot RTB safely) |
| FCU link lost | CPU overtemp | **T3** — FCU-level Emergency Land (companion unreliable) |
| Perception down | VIO nominal | **T0** — Continue waypoint-only mission without detection |
| VIO degraded | Wind gusts | **T2** — Immediate RTB (stacking instabilities) |
| Altitude sensor failed | Landing phase | **T1** — Slow descent at 0.1 m/s using barometric estimate only |
| Battery critical | Geofence approaching | **T3** — Emergency Land inside geofence boundary |

---

## 12. Logging & Post-Flight Analysis

All fail-safe events are:

1. **Timestamped** (ROS time + UTC wall-clock)
2. **Logged** to onboard rosbag with severity tag (`INFO`, `WARN`, `CRIT`)
3. **Displayed** on the ASCEND GCS interface (Command Log panel)
4. **Archived** per-sortie for post-flight debrief

The GCS interface provides real-time fail-safe status via:
- **HUD alerts** — colour-coded warnings overlay on the PFD
- **Command Log** — timestamped event stream with severity levels
- **Telemetry dashboard** — battery, link, altitude, and VIO status bars with threshold-based colour changes (green → yellow → red)

---

> **Document Version:** 1.0
> **Last Updated:** 2026-03-21
> **Prepared for:** ISRO IRoC-U 2026 — Proposal Technical Annex
