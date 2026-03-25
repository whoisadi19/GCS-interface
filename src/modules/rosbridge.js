/**
 * ROSBridge WebSocket Client — Zero dependency implementation
 */

export class ROSBridgeClient {
  constructor() {
    this.ws = null;
    this.url = '';
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.baseReconnectDelay = 1000;
    
    this.subscriptions = new Map(); // topic -> { type, callback }
    this.serviceCallbacks = new Map(); // id -> callback
    
    // Heartbeat tracking
    this.lastMessageTime = Date.now();
    this.linkInterval = null;
    
    // Event listeners for external use
    this.onConnected = () => {};
    this.onDisconnected = () => {};
    this.onError = () => {};
    this.onLinkQuality = () => {}; // Sends quality (0-100)
  }

  connect(url) {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.warn('ROSBridge: Already connected or connecting');
      return;
    }

    this.url = url;
    console.log(`ROSBridge: Connecting to ${url}...`);
    
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      console.error('ROSBridge: Invalid URL or connection error', e);
      this.onError(e);
      this._handleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('ROSBridge: Connected!');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.lastMessageTime = Date.now();
      this.onConnected();
      this._resubscribeAll();
      this._startLinkMonitor();
    };

    this.ws.onclose = (event) => {
      console.log('ROSBridge: Disconnected', event.reason);
      this.connected = false;
      this._stopLinkMonitor();
      this.onDisconnected();
      this._handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('ROSBridge: WebSocket Error', error);
      this.onError(error);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch (e) {
        console.error('ROSBridge: Error parsing message', e);
      }
    };
  }

  disconnect() {
    if (this.ws) {
      this.subscriptions.clear();
      this._stopLinkMonitor();
      this.ws.close();
      this.ws = null;
    }
  }

  _startLinkMonitor() {
    this._stopLinkMonitor();
    this.linkInterval = setInterval(() => {
      if (!this.connected) return;
      const gap = Date.now() - this.lastMessageTime;
      // If gap < 150ms -> 100% quality (Assuming 10Hz telemetry)
      // If gap > 2000ms -> 0% quality
      let quality = Math.max(0, 100 - ((gap - 150) / 18.5));
      quality = Math.min(100, quality);
      this.onLinkQuality(quality);
    }, 500);
  }

  _stopLinkMonitor() {
    if (this.linkInterval) {
      clearInterval(this.linkInterval);
      this.linkInterval = null;
    }
  }

  _handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('ROSBridge: Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 10000);
    
    console.log(`ROSBridge: Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts})`);
    setTimeout(() => {
      this.connect(this.url);
    }, delay);
  }

  _resubscribeAll() {
    for (const [topic, sub] of this.subscriptions.entries()) {
      this._send({
        op: 'subscribe',
        topic: topic,
        type: sub.type
      });
    }
  }

  _handleMessage(msg) {
    this.lastMessageTime = Date.now();

    if (msg.op === 'publish') {
      const sub = this.subscriptions.get(msg.topic);
      if (sub && sub.callback) {
        sub.callback(msg.msg);
      }
    } else if (msg.op === 'service_response') {
      const callback = this.serviceCallbacks.get(msg.id);
      if (callback) {
        callback(msg.values);
        this.serviceCallbacks.delete(msg.id);
      }
    }
  }

  _send(obj) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('ROSBridge: Cannot send, not connected', obj);
      return false;
    }
    this.ws.send(JSON.stringify(obj));
    return true;
  }

  subscribe(topic, msgType, callback) {
    this.subscriptions.set(topic, { type: msgType, callback });
    if (this.connected) {
      this._send({
        op: 'subscribe',
        topic: topic,
        type: msgType
      });
    }
  }

  unsubscribe(topic) {
    this.subscriptions.delete(topic);
    this._send({
      op: 'unsubscribe',
      topic: topic
    });
  }

  publish(topic, msgType, msg) {
    // Optionally advertise first, but ROSBridge typically accepts publish outright
    this._send({
      op: 'publish',
      topic: topic,
      msg: msg
    });
  }

  callService(service, type, args, callback = null) {
    const id = `call_service_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (callback) {
      this.serviceCallbacks.set(id, callback);
    }

    this._send({
      op: 'call_service',
      id: id,
      service: service,
      type: type,
      args: args
    });
  }
}
