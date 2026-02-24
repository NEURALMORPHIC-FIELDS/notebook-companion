// NamespacedCache — mandatory pattern for any cache in the project
// NEXUS AI Rule #4 — Cache Namespaced Per Context, Never Global

export class NamespacedCache<T> {
    private store: Map<string, { value: T; storedAt: number }> = new Map();
    private callCounts: Map<string, number> = new Map();
    private ttlCalls: number;

    /**
     * Cache keyed on (namespace, key) — never just on (key).
     * Namespace = symbol, user_id, session_id, or any isolation context.
     */
    constructor(ttlCalls: number = 5) {
        this.ttlCalls = ttlCalls;
    }

    private generateKey(namespace: string, key: string): string {
        return `${namespace}::${key}`; // Namespace is MANDATORY in key
    }

    public get(namespace: string, key: string): T | null {
        const cacheKey = this.generateKey(namespace, key);

        if (!this.store.has(cacheKey)) {
            return null;
        }

        const { value, storedAt } = this.store.get(cacheKey)!;
        const callsSince = this.callCounts.get(cacheKey) || 0;

        if (callsSince >= this.ttlCalls) {
            this.store.delete(cacheKey);
            this.callCounts.delete(cacheKey);
            return null;
        }

        this.callCounts.set(cacheKey, callsSince + 1);
        return value;
    }

    public set(namespace: string, key: string, value: T): void {
        const cacheKey = this.generateKey(namespace, key);
        this.store.set(cacheKey, { value, storedAt: Date.now() });
        this.callCounts.set(cacheKey, 0);
    }

    public delete(namespace: string, key: string): void {
        const cacheKey = this.generateKey(namespace, key);
        this.store.delete(cacheKey);
        this.callCounts.delete(cacheKey);
    }
}
