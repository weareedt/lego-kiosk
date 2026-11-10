import { beforeEach } from 'vitest';

// Minimal browser globals for the lib code (Node test environment).
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
const g = globalThis as unknown as { localStorage: MemoryStorage; window: { location: { origin: string } } };
g.localStorage = new MemoryStorage();
g.window = { location: { origin: 'https://kiosk.test' } };

beforeEach(() => g.localStorage.clear());
