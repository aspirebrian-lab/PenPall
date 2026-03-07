export type SyncPage = {
  id: string;
  title: string;
  content: string;
};

type DirHandle = FileSystemDirectoryHandle;

const DB_NAME = 'writers-companion-fs';
const STORE = 'handles';

const withDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const waitForTransaction = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const getHandleKey = (bookId: string) => `book:${bookId}`;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';

export const pickDirectory = async (): Promise<DirHandle> => {
  if (!window.showDirectoryPicker) {
    throw new Error('Directory picker is not supported in this browser.');
  }
  return window.showDirectoryPicker();
};

export const saveBookDirHandle = async (bookId: string, handle: DirHandle): Promise<void> => {
  const db = await withDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(handle, getHandleKey(bookId));
  await waitForTransaction(tx);
};

export const loadBookDirHandle = async (bookId: string): Promise<DirHandle | null> => {
  const db = await withDb();
  const tx = db.transaction(STORE, 'readonly');
  const request = tx.objectStore(STORE).get(getHandleKey(bookId));

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const handle: DirHandle | null = request.result ? request.result : null;
      resolve(handle);
    };
    request.onerror = () => reject(request.error);
  });
};

export const readTextFile = async (
  dir: DirHandle,
  pathSegments: string[],
  filename: string
): Promise<string | null> => {
  try {
    let current: DirHandle = dir;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }
    const fileHandle = await current.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return file.text();
  } catch (error) {
    const domError = error && typeof error === 'object' ? error : null;
    if (domError && 'name' in domError && domError.name === 'NotFoundError') {
      return null;
    }
    throw error;
  }
};

export const writeTextFile = async (
  dir: DirHandle,
  pathSegments: string[],
  filename: string,
  content: string
): Promise<void> => {
  let current: DirHandle = dir;
  for (const segment of pathSegments) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  const fileHandle = await current.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
};

export const readBookBundle = async (
  dir: DirHandle
): Promise<{ title?: string; author?: string; pages: SyncPage[] }> => {
  const bookJson = await readTextFile(dir, [], 'book.json');
  const pagesJson = await readTextFile(dir, [], 'pages.json');

  let title: string | undefined;
  let author: string | undefined;
  let pages: SyncPage[] = [];

  if (bookJson) {
    try {
      const parsed = JSON.parse(bookJson);
      title = parsed && parsed.title ? parsed.title : undefined;
      author = parsed && parsed.author ? parsed.author : undefined;
    } catch {
      // ignore malformed file
    }
  }

  if (pagesJson) {
    try {
      const parsed = JSON.parse(pagesJson);
      pages = parsed && Array.isArray(parsed.pages) ? parsed.pages : [];
    } catch {
      // ignore malformed file
    }
  }

  return { title, author, pages };
};

export const writeBookBundle = async (
  dir: DirHandle,
  book: { title: string; author: string },
  pages: SyncPage[]
): Promise<void> => {
  await writeTextFile(
    dir,
    [],
    'book.json',
    JSON.stringify(
      {
        title: book.title,
        author: book.author,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  await writeTextFile(dir, [], 'pages.json', JSON.stringify({ pages }, null, 2));

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const fileName = `${String(index + 1).padStart(2, '0')}-${slugify(page.title)}.txt`;
    await writeTextFile(dir, ['pages'], fileName, page.content);
  }
};