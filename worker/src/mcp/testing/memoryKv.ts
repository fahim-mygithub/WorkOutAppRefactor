/** In-memory KVNamespace with the calls the OAuth provider makes (expiry ignored). */
export function memoryKv(): KVNamespace & { store: Map<string, string> } {
  const store = new Map<string, string>();
  const kv = {
    store,
    async get(key: string, opts?: unknown) {
      const v = store.get(key);
      if (v === undefined) return null;
      const type = typeof opts === 'string' ? opts : (opts as { type?: string } | undefined)?.type;
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list(opts: { prefix?: string } = {}) {
      const keys = [...store.keys()].filter((k) => k.startsWith(opts.prefix ?? '')).sort().map((name) => ({ name }));
      return { keys, list_complete: true, cacheStatus: null };
    },
  };
  return kv as unknown as KVNamespace & { store: Map<string, string> };
}
