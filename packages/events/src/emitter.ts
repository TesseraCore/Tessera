/**
 * Event emitter for Tessera
 * 
 * Provides a type-safe event system for the viewer and its subsystems.
 * Supports typed event listeners and wildcard listeners.
 */

type EventMap = Record<string, any>;
type EventKey<T extends EventMap> = string & keyof T;
type EventListener<T> = (payload: T) => void;

/**
 * Type-safe event emitter
 */
export class EventEmitter<T extends EventMap = Record<string, any>> {
  private listeners = new Map<string, Set<EventListener<any>>>();
  private wildcardListeners = new Set<EventListener<{ type: string; payload: any }>>();

  /**
   * Subscribe to a specific event type
   */
  on<K extends EventKey<T>>(type: K, listener: EventListener<T[K]>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  /**
   * Subscribe to a specific event type (one-time)
   */
  once<K extends EventKey<T>>(type: K, listener: EventListener<T[K]>): void {
    const wrapped = (payload: T[K]) => {
      listener(payload);
      this.off(type, wrapped);
    };
    this.on(type, wrapped);
  }

  /**
   * Unsubscribe from a specific event type
   */
  off<K extends EventKey<T>>(type: K, listener: EventListener<T[K]>): void {
    this.listeners.get(type)?.delete(listener);
  }

  /**
   * Subscribe to all events (wildcard)
   */
  onAll(listener: EventListener<{ type: string; payload: any }>): () => void {
    this.wildcardListeners.add(listener);
    return () => {
      this.wildcardListeners.delete(listener);
    };
  }

  /**
   * Emit an event
   */
  emit<K extends EventKey<T>>(type: K, payload: T[K]): void {
    // Notify specific listeners
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(payload);
        } catch (error) {
          console.error(`Error in event listener for "${type}":`, error);
        }
      });
    }

    // Notify wildcard listeners
    this.wildcardListeners.forEach((listener) => {
      try {
        listener({ type, payload });
      } catch (error) {
        console.error(`Error in wildcard event listener for "${type}":`, error);
      }
    });
  }

  /**
   * Remove all listeners for a specific event type
   */
  removeAllListeners<K extends EventKey<T>>(type?: K): void {
    if (type) {
      this.listeners.delete(type);
    } else {
      this.listeners.clear();
      this.wildcardListeners.clear();
    }
  }

  /**
   * Get the number of listeners for a specific event type
   */
  listenerCount<K extends EventKey<T>>(type: K): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  /**
   * Get all event types that have listeners
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }
}
