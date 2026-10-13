/**
 * 지금 읽는 책 보관 — IndexedDB(기기 안)에 원본 파일 1개를 둔다.
 * 새로고침·재방문 시 같은 책을 다시 열고(읽던 위치는 셸이 책별 키로 기억), 책 바꾸기 = 교체 후 다시 불러오기.
 * 저장소를 못 쓰는 환경(사생활 보호 모드 등)에선 조용히 실패 — 앱은 그대로 동작하고 새로고침 시 첫 화면으로 갈 뿐.
 */
const DB_NAME = "syepubreader";
const STORE = "kv";
const KEY = "current";

interface StoredFile {
  name: string;
  type: string;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function saveCurrent(file: File): Promise<void> {
  try {
    const value: StoredFile = { name: file.name, type: file.type, blob: file };
    await run("readwrite", (s) => s.put(value, KEY));
  } catch (e) {
    console.warn("현재 책 저장 실패(새로고침 시 첫 화면으로 돌아감):", e);
  }
}

export async function loadCurrent(): Promise<File | null> {
  try {
    const v = (await run("readonly", (s) => s.get(KEY))) as StoredFile | undefined;
    return v ? new File([v.blob], v.name, { type: v.type }) : null;
  } catch {
    return null;
  }
}

export async function clearCurrent(): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(KEY));
  } catch {
    /* 저장소 불가 환경 — 지울 것도 없음 */
  }
}
