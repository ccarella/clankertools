import { EventEmitter } from 'events';

export interface TokenUpdate {
  address: string;
  marketCap: string;
  holders: number;
  volume24h: string;
  priceChange24h: number;
}

export interface PriceUpdate {
  address: string;
  price: string;
  marketCap: string;
  priceChange24h: number;
}

interface WebSocketMessage {
  type: 'tokenUpdate' | 'priceUpdate' | 'pong' | 'error';
  data?: TokenUpdate | PriceUpdate;
  error?: string;
}

interface SubscribeMessage {
  type: 'subscribe' | 'unsubscribe';
  channel: 'token';
  address: string;
}

interface HeartbeatMessage {
  type: 'ping' | 'pong';
}

export class WebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private heartbeatInterval?: NodeJS.Timeout;
  private heartbeatTimeout?: NodeJS.Timeout;
  private subscribedTokens = new Set<string>();
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';

  constructor(url: string) {
    super();
    this.url = url;
  }

  connect(): void {
    if (this.connectionState !== 'disconnected') {
      return;
    }

    this.connectionState = 'connecting';

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      this.handleError(error);
    }
  }

  disconnect(): void {
    this.clearHeartbeat();
    this.subscribedTokens.clear();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connectionState = 'disconnected';
    this.reconnectAttempts = 0;
  }

  subscribeToToken(address: string): void {
    if (!this.isConnected()) {
      console.warn('Cannot subscribe: WebSocket not connected');
      return;
    }

    if (this.subscribedTokens.has(address)) {
      return;
    }

    const message: SubscribeMessage = {
      type: 'subscribe',
      channel: 'token',
      address
    };

    this.send(JSON.stringify(message));
    this.subscribedTokens.add(address);
  }

  unsubscribeFromToken(address: string): void {
    if (!this.isConnected()) {
      return;
    }

    if (!this.subscribedTokens.has(address)) {
      return;
    }

    const message: SubscribeMessage = {
      type: 'unsubscribe',
      channel: 'token',
      address
    };

    this.send(JSON.stringify(message));
    this.subscribedTokens.delete(address);
  }

  isConnected(): boolean {
    return this.connectionState === 'connected' && this.ws !== null && this.ws.readyState === 1;
  }

  isConnecting(): boolean {
    return this.connectionState === 'connecting';
  }

  isSubscribedToToken(address: string): boolean {
    return this.subscribedTokens.has(address);
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.setupHeartbeat();
      this.emit('open');
      
      // Resubscribe to all tokens
      this.subscribedTokens.forEach(address => {
        const message: SubscribeMessage = {
          type: 'subscribe',
          channel: 'token',
          address
        };
        this.send(JSON.stringify(message));
      });
    };

    this.ws.onclose = () => {
      this.connectionState = 'disconnected';
      this.clearHeartbeat();
      this.emit('close');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      this.handleError(error);
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'tokenUpdate':
        if (message.data) {
          this.emit('tokenUpdate', message.data);
        }
        break;
      
      case 'priceUpdate':
        if (message.data) {
          this.emit('priceUpdate', message.data);
        }
        break;
      
      case 'pong':
        this.handlePong();
        break;
      
      case 'error':
        console.error('WebSocket error:', message.error);
        this.emit('error', new Error(message.error || 'Unknown error'));
        break;
    }
  }

  private send(data: string): void {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(data);
    }
  }

  private setupHeartbeat(): void {
    this.clearHeartbeat();
    
    // Send ping every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendPing();
    }, 30000);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = undefined;
    }
  }

  private sendPing(): void {
    const message: HeartbeatMessage = { type: 'ping' };
    this.send(JSON.stringify(message));
    
    // Set timeout for pong response
    this.heartbeatTimeout = setTimeout(() => {
      this.emit('timeout');
      this.ws?.close();
    }, 30000); // 30 second timeout
  }

  private handlePong(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = undefined;
    }
  }

  private handleError(error: unknown): void {
    this.connectionState = 'disconnected';
    this.emit('error', error);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('maxReconnectAttempts');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    this.emit('reconnect', { attempt: this.reconnectAttempts, delay });

    setTimeout(() => {
      this.connect();
    }, delay);
  }
}