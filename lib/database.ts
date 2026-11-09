import type { Project, ShotId } from "@/lib/shots";

const DB_NAME = "adamante-photo-studio";
const DB_VERSION = 1;
type Store = "references" | "projects";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Questo browser non supporta il salvataggio locale."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("references")) db.createObjectStore("references");
      if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Archivio non disponibile."));
  });
}

async function operation<T>(store: Store, mode: IDBTransactionMode, task: (object: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = task(tx.objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Errore di salvataggio."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
    tx.onabort = () => db.close();
  });
}

export function getReference(slot: ShotId): Promise<string | undefined> {
  return operation<string | undefined>("references", "readonly", (s) => s.get(slot));
}
export function setReference(slot: ShotId, dataUrl: string): Promise<IDBValidKey> {
  return operation("references", "readwrite", (s) => s.put(dataUrl, slot));
}
export function clearReference(slot: ShotId): Promise<undefined> {
  return operation("references", "readwrite", (s) => s.delete(slot));
}
export function saveProject(project: Project): Promise<IDBValidKey> {
  return operation("projects", "readwrite", (s) => s.put(project, project.id));
}
export function getProjects(): Promise<Project[]> {
  return operation<Project[]>("projects", "readonly", (s) => s.getAll());
}
export function removeProject(id: string): Promise<undefined> {
  return operation("projects", "readwrite", (s) => s.delete(id));
}
