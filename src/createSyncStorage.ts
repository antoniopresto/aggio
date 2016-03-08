export function createSyncStorage<T extends Record<string, any>>() {
  const map = new Map<string, T>();

  return {
    sync: true,
    clear: map.clear,
    setItem: map.set,
    getItem: map.get,
    removeItem: map.delete,
    getAllKeys: () => {
      return [...map.keys()];
    },
  };
}

export type SyncStorage = ReturnType<typeof createSyncStorage>;
