"use client";

/**
 * Minimal promise wrapper over IndexedDB. Images are stored as Blobs (never in localStorage).
 * Every store is keyed by `id`. The schema is versioned so a Supabase sync layer can be added
 * later behind the same repository functions in ./repo.ts.
 */

export const DB_NAME = "frameproof";
export const DB_VERSION = 1;
export const STORES = ["projects", "assets", "reviews", "references", "styles"] as const;
export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

export class StorageUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new StorageUnavailableError("This browser doesn't provide IndexedDB, so work can't be saved."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: "id" });
          if (name === "assets" || name === "reviews") store.createIndex("projectId", "projectId", { unique: false });
        }
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(new StorageUnavailableError(req.error?.message ?? "Local storage couldn't be opened. Private browsing can block it."));
    };
    req.onblocked = () => reject(new StorageUnavailableError("Close other FrameProof tabs so local storage can be upgraded."));
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return wrap(db.transaction(store, "readonly").objectStore(store).getAll()) as Promise<T[]>;
}

export async function getOne<T>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await openDb();
  return wrap(db.transaction(store, "readonly").objectStore(store).get(id)) as Promise<T | undefined>;
}

export async function getByProject<T>(store: "assets" | "reviews", projectId: string): Promise<T[]> {
  const db = await openDb();
  return wrap(db.transaction(store, "readonly").objectStore(store).index("projectId").getAll(projectId)) as Promise<T[]>;
}

export async function put<T extends { id: string }>(store: StoreName, value: T): Promise<T> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(
        tx.error?.name === "QuotaExceededError"
          ? new StorageUnavailableError("The browser's storage is full. Delete unused projects or images and try again.")
          : tx.error,
      );
  });
  return value;
}

export async function remove(store: StoreName, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    for (const id of ids) tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new StorageUnavailableError("The change couldn’t be saved. Try again."));
  });
}

export function newId(prefix: string): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefix}_${rand}`;
}
