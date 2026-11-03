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

export async function saveResume(file: File): Promise<void> {
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
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

  database.close();
}

export async function loadResume(): Promise<File | null> {
  const database = await openDatabase();

  const record = await new Promise<StoredResume | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(CURRENT_RESUME_ID);
    request.onsuccess = () => resolve(request.result as StoredResume | undefined);
    request.onerror = () => reject(request.error ?? new Error("Could not restore the saved resume."));
  });

  database.close();

  if (!record) return null;

  return new File([record.file], record.name, {
    type: record.type,
    lastModified: record.lastModified,
  });
}

export async function deleteResume(): Promise<void> {
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(CURRENT_RESUME_ID);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove the saved resume."));
  });

  database.close();
}
