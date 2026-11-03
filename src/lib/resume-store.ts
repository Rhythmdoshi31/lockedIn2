import { pipelineLog } from "@/lib/pipeline-log";

const DATABASE_NAME = "lockedin";
const DATABASE_VERSION = 1;
const STORE_NAME = "resumes";
const CURRENT_RESUME_ID = "current";

interface StoredResume {
  id: string;
  file: Blob;
  name: string;
  type: string;
  lastModified: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local resume storage."));
  });
}

export async function saveResume(file: File, requestId: string): Promise<void> {
  const startedAt = performance.now();
  pipelineLog({
    requestId,
    stage: "indexeddb.save",
    event: "resume_persistence",
    status: "started",
    details: { sizeBytes: file.size, mimeType: file.type || "unknown" },
  });

  let database: IDBDatabase | undefined;
  try {
    database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database!.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({
        id: CURRENT_RESUME_ID,
        file,
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
      } satisfies StoredResume);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the resume locally."));
    });

    pipelineLog({
      requestId,
      stage: "indexeddb.save",
      event: "resume_persistence",
      status: "succeeded",
      durationMs: Math.round(performance.now() - startedAt),
      details: { sizeBytes: file.size },
    });
  } catch (error) {
    pipelineLog({
      requestId,
      stage: "indexeddb.save",
      event: "resume_persistence",
      status: "failed",
      durationMs: Math.round(performance.now() - startedAt),
      error,
    });
    throw error;
  } finally {
    database?.close();
  }
}
export async function loadResume(requestId: string): Promise<File | null> {
  const startedAt = performance.now();
  pipelineLog({
    requestId,
    stage: "indexeddb.restore",
    event: "resume_restoration",
    status: "started",
  });

  let database: IDBDatabase | undefined;
  try {
    database = await openDatabase();
    const record = await new Promise<StoredResume | undefined>((resolve, reject) => {
      const transaction = database!.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(CURRENT_RESUME_ID);
      request.onsuccess = () => resolve(request.result as StoredResume | undefined);
      request.onerror = () => reject(request.error ?? new Error("Could not restore the saved resume."));
    });

    if (!record) {
      pipelineLog({
        requestId,
        stage: "indexeddb.restore",
        event: "resume_restoration",
        status: "succeeded",
        durationMs: Math.round(performance.now() - startedAt),
        details: { found: false },
      });
      return null;
    }

    if (!(record.file instanceof Blob)) {
      throw new Error("The stored resume payload is not a Blob.");
    }

    const restoredFile = new File([record.file], record.name, {
      type: record.type,
      lastModified: record.lastModified,
    });

    pipelineLog({
      requestId,
      stage: "indexeddb.restore",
      event: "resume_restoration",
      status: "succeeded",
      durationMs: Math.round(performance.now() - startedAt),
      details: {
        found: true,
        sizeBytes: restoredFile.size,
        mimeType: restoredFile.type || "unknown",
      },
    });
    return restoredFile;
  } catch (error) {
    pipelineLog({
      requestId,
      stage: "indexeddb.restore",
      event: "resume_restoration",
      status: "failed",
      durationMs: Math.round(performance.now() - startedAt),
      error,
    });
    throw error;
  } finally {
    database?.close();
  }
}

export async function deleteResume(requestId: string): Promise<void> {
  const startedAt = performance.now();
  pipelineLog({
    requestId,
    stage: "indexeddb.delete",
    event: "resume_removal",
    status: "started",
  });

  let database: IDBDatabase | undefined;
  try {
    database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database!.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(CURRENT_RESUME_ID);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove the saved resume."));
    });

    pipelineLog({
      requestId,
      stage: "indexeddb.delete",
      event: "resume_removal",
      status: "succeeded",
      durationMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    pipelineLog({
      requestId,
      stage: "indexeddb.delete",
      event: "resume_removal",
      status: "failed",
      durationMs: Math.round(performance.now() - startedAt),
      error,
    });
    throw error;
  } finally {
    database?.close();
  }
}
