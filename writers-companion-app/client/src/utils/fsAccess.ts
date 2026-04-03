export type SyncPage = {
  id: string;
  title: string;
  content: string;
  linkedChapterIds: string[];
};

export type OutlineStatus = 'todo' | 'in-progress' | 'done' | 'blocked';

export type PlanningTaskComment = {
  id: string;
  body: string;
  createdAt: string;
};

export type PlanningTask = {
  id: string;
  title: string;
  description: string;
  date: string;
  status: OutlineStatus;
  comments: PlanningTaskComment[];
  linkedChapterIds: string[];
  linkedPartIds: string[];
  linkedEventIds: string[];
};

export type OutlineChapter = {
  id: string;
  title: string;
};

export type OutlineEvent = {
  id: string;
  title: string;
  description: string;
  status: OutlineStatus;
  linkedChapterIds: string[];
};

export type OutlinePart = {
  id: string;
  title: string;
  description: string;
  status: OutlineStatus;
  events: OutlineEvent[];
};

export type OutlineBundle = {
  version: 2;
  chapters: OutlineChapter[];
  parts: OutlinePart[];
  tasks: PlanningTask[];
};

type DirHandle = FileSystemDirectoryHandle;

const DB_NAME = 'writers-companion-fs';
const STORE = 'handles';
const OUTLINE_STATUSES = new Set<OutlineStatus>(['todo', 'in-progress', 'done', 'blocked']);

const withDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(request.error?.message));
  });

const waitForTransaction = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(tx.error?.message));
    tx.onabort = () => reject(new Error(tx.error?.message));
  });

const getHandleKey = (bookId: string) => `book:${bookId}`;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll(new RegExp(/[^a-z0-9]+/g), '-')
    .replaceAll(new RegExp(/^-+|-+$/g), '') || 'page';

const isOutlineStatus = (value: unknown): value is OutlineStatus =>
  typeof value === 'string' && OUTLINE_STATUSES.has(value as OutlineStatus);

const normalizeIsoDate = (value: unknown): string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : new Date().toISOString().slice(0, 10);

const normalizeChapter = (chapter: any, index: number): OutlineChapter => ({
  id: typeof chapter?.id === 'string' && chapter.id ? chapter.id : `chapter-${index + 1}`,
  title:
    typeof chapter?.title === 'string' && chapter.title.trim()
      ? chapter.title.trim()
      : `Chapter ${index + 1}`,
});

const normalizePage = (page: any, index: number): SyncPage => ({
  id: typeof page?.id === 'string' && page.id ? page.id : `p${index + 1}`,
  title:
    typeof page?.title === 'string' && page.title.trim()
      ? page.title.trim()
      : `Page ${index + 1}`,
  content: typeof page?.content === 'string' ? page.content : '',
  linkedChapterIds: Array.isArray(page?.linkedChapterIds)
    ? page.linkedChapterIds.filter((chapterId: unknown) => typeof chapterId === 'string')
    : [],
});

const normalizeEvent = (event: any, index: number): OutlineEvent => {
  const linkedChapterIds = Array.isArray(event?.linkedChapterIds)
    ? event.linkedChapterIds.filter((chapterId: unknown) => typeof chapterId === 'string')
    : [];
  
  const linkedPageIdArray = typeof event?.linkedPageId === 'string' && event.linkedPageId
    ? [event.linkedPageId]
    : [];

  const finalLinkedChapterIds = linkedChapterIds.length > 0 ? linkedChapterIds : linkedPageIdArray;

  return {
    id: typeof event?.id === 'string' && event.id ? event.id : `event-${index + 1}`,
    title:
      typeof event?.title === 'string' && event.title.trim()
        ? event.title.trim()
        : `Event ${index + 1}`,
    description: typeof event?.description === 'string' ? event.description : '',
    status: isOutlineStatus(event?.status) ? event.status : 'todo',
    linkedChapterIds: finalLinkedChapterIds,
  };
};

const normalizePart = (part: any, index: number): OutlinePart => ({
  id: typeof part?.id === 'string' && part.id ? part.id : `part-${index + 1}`,
  title:
    typeof part?.title === 'string' && part.title.trim()
      ? part.title.trim()
      : `Part ${index + 1}`,
  description: typeof part?.description === 'string' ? part.description : '',
  status: isOutlineStatus(part?.status) ? part.status : 'todo',
  events: Array.isArray(part?.events) ? part.events.map(normalizeEvent) : [],
});

const normalizeTaskComment = (comment: any, index: number): PlanningTaskComment => ({
  id: typeof comment?.id === 'string' && comment.id ? comment.id : `comment-${index + 1}`,
  body: typeof comment?.body === 'string' ? comment.body : '',
  createdAt:
    typeof comment?.createdAt === 'string' && comment.createdAt
      ? comment.createdAt
      : '1970-01-01T00:00:00.000Z',
});

const normalizeTask = (task: any, index: number): PlanningTask => ({
  id: typeof task?.id === 'string' && task.id ? task.id : `task-${index + 1}`,
  title:
    typeof task?.title === 'string' && task.title.trim()
      ? task.title.trim()
      : `Task ${index + 1}`,
  description: typeof task?.description === 'string' ? task.description : '',
  date: normalizeIsoDate(task?.date),
  status: isOutlineStatus(task?.status) ? task.status : 'todo',
  comments: Array.isArray(task?.comments) ? task.comments.map(normalizeTaskComment) : [],
  linkedChapterIds: Array.isArray(task?.linkedChapterIds)
    ? task.linkedChapterIds.filter((chapterId: unknown) => typeof chapterId === 'string')
    : [],
  linkedPartIds: Array.isArray(task?.linkedPartIds)
    ? task.linkedPartIds.filter((partId: unknown) => typeof partId === 'string')
    : [],
  linkedEventIds: Array.isArray(task?.linkedEventIds)
    ? task.linkedEventIds.filter((eventId: unknown) => typeof eventId === 'string')
    : [],
});

export const normalizeOutlineBundle = (outline: any): OutlineBundle => ({
  version: 2,
  chapters: Array.isArray(outline?.chapters) ? outline.chapters.map(normalizeChapter) : [],
  parts: Array.isArray(outline?.parts) ? outline.parts.map(normalizePart) : [],
  tasks: Array.isArray(outline?.tasks) ? outline.tasks.map(normalizeTask) : [],
});

export const pickDirectory = async (): Promise<DirHandle> => {
  if (!(globalThis as any).showDirectoryPicker) {
    throw new Error('Directory picker is not supported in this browser.');
  }
  return (globalThis as any).showDirectoryPicker();
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
    request.onerror = () => reject(new Error(request.error?.message));
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
      title = parsed?.title ? parsed.title : undefined;
      author = parsed?.author ? parsed.author : undefined;
    } catch {
      // ignore malformed file
    }
  }

  if (pagesJson) {
    try {
      const parsed = JSON.parse(pagesJson);
      pages = parsed && Array.isArray(parsed.pages) ? parsed.pages.map(normalizePage) : [];
    } catch {
      // ignore malformed file
    }
  }

  return { title, author, pages };
};

export const readOutlineBundle = async (dir: DirHandle): Promise<OutlineBundle> => {
  const outlineJson = await readTextFile(dir, [], 'outline.json');

  if (!outlineJson) {
    return { version: 2, chapters: [], parts: [], tasks: [] };
  }

  try {
    return normalizeOutlineBundle(JSON.parse(outlineJson));
  } catch {
    return { version: 2, chapters: [], parts: [], tasks: [] };
  }
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

export const writeOutlineBundle = async (
  dir: DirHandle,
  outline: OutlineBundle
): Promise<void> => {
  await writeTextFile(dir, [], 'outline.json', JSON.stringify(outline, null, 2));
};