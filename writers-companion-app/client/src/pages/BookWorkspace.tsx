import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import 'react-quill-new/dist/quill.snow.css';
import { getBookById, Book } from '../services/api';
import './BookWorkspace.css';
import EditorView from '../components/book-workspace/EditorView';
import OutlineView from '../components/book-workspace/OutlineView';
import PlanningView from '../components/book-workspace/PlanningView';
import {
  Page,
  ChapterUsageContext,
  TaskLinkKey,
  TaskLinkBadge,
  formatDateInputValue,
  parseDateInputValue,
  addDays,
} from '../components/book-workspace/BookWorkSpaceShared';
import {
  loadBookDirHandle,
  pickDirectory,
  readBookBundle,
  readOutlineBundle,
  saveBookDirHandle,
  writeBookBundle,
  writeOutlineBundle,
  OutlineBundle,
  OutlinePart,
  OutlineEvent,
  OutlineStatus,
  OutlineChapter,
  PlanningTask,
  PlanningTaskComment,
  normalizeOutlineBundle,
} from '../utils/fsAccess';

type WorkspaceSnapshot = {
  pages: Page[];
  outline: OutlineBundle;
  activePageId: string;
};

type ActivePageContext = {
  chapterIds: string[];
  partIds: string[];
  eventIds: string[];
};

type ImportedPageResult = {
  nextPages: Page[];
  nextActivePageId: string;
};

type WorkspaceView = 'editor' | 'outline' | 'planning' | 'settings';

const EMPTY_ACTIVE_PAGE_CONTEXT: ActivePageContext = {
  chapterIds: [],
  partIds: [],
  eventIds: [],
};

const defaultOutline = (): OutlineBundle => ({
  version: 2,
  chapters: [],
  parts: [],
  tasks: [],
});

const defaultPages = (): Page[] => [
  { id: 'p1', title: 'Page 1', content: '', linkedChapterIds: [] },
  { id: 'p2', title: 'Page 2', content: '', linkedChapterIds: [] },
];

const normalizePages = (rawPages: unknown): Page[] => {
  if (!Array.isArray(rawPages)) {
    return defaultPages();
  }

  const normalizedPages = rawPages.map((page, index) => ({
    id: typeof page?.id === 'string' && page.id ? page.id : `p${index + 1}`,
    title:
      typeof page?.title === 'string' && page.title.trim()
        ? page.title.trim()
        : `Page ${index + 1}`,
    content: typeof page?.content === 'string' ? page.content : '',
    linkedChapterIds: Array.isArray(page?.linkedChapterIds)
      ? page.linkedChapterIds.filter((chapterId: unknown) => typeof chapterId === 'string')
      : [],
  }));

  return normalizedPages.length > 0 ? normalizedPages : defaultPages();
};

const createId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const dayLabelFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const shortMonthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
const monthLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const getMonthStart = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

const buildCalendarDays = (displayMonth: Date): Date[] => {
  const firstDay = getMonthStart(displayMonth);
  const gridStart = addDays(firstDay, -firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
};

const isSameMonth = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();

const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const statusOrder: Record<OutlineStatus, number> = {
  'in-progress': 0,
  todo: 1,
  blocked: 2,
  done: 3,
};

const statusLabel: Record<OutlineStatus, string> = {
  todo: 'To do',
  'in-progress': 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

const comparePlanningTasks = (left: PlanningTask, right: PlanningTask): number => {
  const statusDelta = statusOrder[left.status] - statusOrder[right.status];

  if (statusDelta !== 0) {
    return statusDelta;
  }

  const dateDelta = left.date.localeCompare(right.date);

  if (dateDelta !== 0) {
    return dateDelta;
  }

  return left.title.localeCompare(right.title);
};

const intersects = (left: string[], right: string[]): boolean =>
  left.some((value) => right.includes(value));

const isPartDone = (part: OutlinePart): boolean =>
  part.events.length > 0 && part.events.every((event) => event.status === 'done');

const getPartStatus = (part: OutlinePart): OutlineStatus => {
  if (isPartDone(part)) {
    return 'done';
  }

  if (part.status === 'done') {
    return 'in-progress';
  }

  return part.status;
};

const buildEventContextMap = (parts: OutlinePart[]): Map<string, ChapterUsageContext> => {
  const nextMap = new Map<string, ChapterUsageContext>();

  parts.forEach((part) => {
    part.events.forEach((event) => {
      nextMap.set(event.id, {
        partId: part.id,
        partTitle: part.title,
        eventId: event.id,
        eventTitle: event.title,
      });
    });
  });

  return nextMap;
};

const buildChapterUsageMap = (parts: OutlinePart[]): Map<string, ChapterUsageContext[]> => {
  const nextMap = new Map<string, ChapterUsageContext[]>();

  parts.forEach((part) => {
    part.events.forEach((event) => {
      event.linkedChapterIds.forEach((chapterId) => {
        const existingEntries = nextMap.get(chapterId) ?? [];
        existingEntries.push({
          partId: part.id,
          partTitle: part.title,
          eventId: event.id,
          eventTitle: event.title,
        });
        nextMap.set(chapterId, existingEntries);
      });
    });
  });

  return nextMap;
};

const hasOutlineData = (outline: OutlineBundle): boolean =>
  outline.parts.length > 0 || outline.chapters.length > 0 || outline.tasks.length > 0;

const getFirstPageId = (pages: Page[]): string => pages[0]?.id ?? '';

const writeWorkspaceLocal = (
  pagesStorageKey: string,
  outlineStorageKey: string,
  pages: Page[],
  outline: OutlineBundle
): void => {
  localStorage.setItem(pagesStorageKey, JSON.stringify(pages));
  localStorage.setItem(outlineStorageKey, JSON.stringify(outline));
};

const buildWorkspaceSnapshot = (rawPages: unknown, rawOutline: unknown): WorkspaceSnapshot => {
  const pages = normalizePages(rawPages);
  const normalizedOutline = normalizeOutlineBundle(rawOutline);
  const outline = hasOutlineData(normalizedOutline) ? normalizedOutline : defaultOutline();

  return {
    pages,
    outline,
    activePageId: getFirstPageId(pages),
  };
};

const buildStoredWorkspaceSnapshot = (
  pagesStorageKey: string,
  outlineStorageKey: string
): WorkspaceSnapshot => {
  const rawPages = localStorage.getItem(pagesStorageKey);
  const rawOutline = localStorage.getItem(outlineStorageKey);

  const snapshot = buildWorkspaceSnapshot(
    rawPages ? JSON.parse(rawPages) : defaultPages(),
    rawOutline ? JSON.parse(rawOutline) : defaultOutline()
  );

  writeWorkspaceLocal(pagesStorageKey, outlineStorageKey, snapshot.pages, snapshot.outline);

  return snapshot;
};

const toggleLinkedId = (linkedIds: string[], linkedId: string): string[] =>
  linkedIds.includes(linkedId)
    ? linkedIds.filter((value) => value !== linkedId)
    : [...linkedIds, linkedId];

const mapPartById = (
  outline: OutlineBundle,
  partId: string,
  updatePart: (part: OutlinePart) => OutlinePart
): OutlineBundle => ({
  ...outline,
  parts: outline.parts.map((part) => (part.id === partId ? updatePart(part) : part)),
});

const mapEventById = (
  part: OutlinePart,
  eventId: string,
  updateEvent: (event: OutlineEvent) => OutlineEvent
): OutlinePart => ({
  ...part,
  events: part.events.map((event) => (event.id === eventId ? updateEvent(event) : event)),
});

const addPartToOutline = (outline: OutlineBundle): OutlineBundle => ({
  ...outline,
  parts: [
    ...outline.parts,
    {
      id: createId('part'),
      title: `Part ${outline.parts.length + 1}`,
      description: '',
      status: 'todo',
      events: [],
    },
  ],
});

const updatePartInOutline = (
  outline: OutlineBundle,
  partId: string,
  updates: Partial<OutlinePart>
): OutlineBundle =>
  mapPartById(outline, partId, (part) => ({
    ...part,
    ...updates,
  }));

const removePartFromOutline = (outline: OutlineBundle, partId: string): OutlineBundle => ({
  ...outline,
  parts: outline.parts.filter((part) => part.id !== partId),
});

const addEventToOutline = (outline: OutlineBundle, partId: string): OutlineBundle =>
  mapPartById(outline, partId, (part) => ({
    ...part,
    events: [
      ...part.events,
      {
        id: createId('event'),
        title: `Event ${part.events.length + 1}`,
        description: '',
        status: 'todo',
        linkedChapterIds: [],
      },
    ],
  }));

const updateEventInOutline = (
  outline: OutlineBundle,
  partId: string,
  eventId: string,
  updates: Partial<OutlineEvent>
): OutlineBundle =>
  mapPartById(outline, partId, (part) =>
    mapEventById(part, eventId, (event) => ({
      ...event,
      ...updates,
    }))
  );

const removeEventFromOutline = (
  outline: OutlineBundle,
  partId: string,
  eventId: string
): OutlineBundle =>
  mapPartById(outline, partId, (part) => ({
    ...part,
    events: part.events.filter((event) => event.id !== eventId),
  }));

const toggleEventChapterInOutline = (
  outline: OutlineBundle,
  partId: string,
  eventId: string,
  chapterId: string
): OutlineBundle =>
  mapPartById(outline, partId, (part) =>
    mapEventById(part, eventId, (event) => ({
      ...event,
      linkedChapterIds: toggleLinkedId(event.linkedChapterIds, chapterId),
    }))
  );

const createOrLinkChapterForEventInOutline = (
  outline: OutlineBundle,
  partId: string,
  eventId: string,
  chapterTitle: string
): OutlineBundle => {
  const existingChapter = outline.chapters.find(
    (chapter) => chapter.title.toLowerCase() === chapterTitle.toLowerCase()
  );

  const nextChapter: OutlineChapter =
    existingChapter ?? {
      id: createId('chapter'),
      title: chapterTitle,
    };

  const chapters = existingChapter ? outline.chapters : [...outline.chapters, nextChapter];

  return {
    ...outline,
    chapters,
    parts: outline.parts.map((part) => {
      if (part.id !== partId) {
        return part;
      }

      return {
        ...part,
        events: part.events.map((event) => {
          if (event.id !== eventId || event.linkedChapterIds.includes(nextChapter.id)) {
            return event;
          }

          return {
            ...event,
            linkedChapterIds: [...event.linkedChapterIds, nextChapter.id],
          };
        }),
      };
    }),
  };
};

const togglePageChapterInPages = (pages: Page[], pageId: string, chapterId: string): Page[] =>
  pages.map((page) => {
    if (page.id !== pageId) {
      return page;
    }

    return {
      ...page,
      linkedChapterIds: toggleLinkedId(page.linkedChapterIds, chapterId),
    };
  });

const updatePageContent = (pages: Page[], pageId: string, content: string): Page[] =>
  pages.map((page) => (page.id === pageId ? { ...page, content } : page));

const resolveImportedPages = (
  pages: Page[],
  activePageId: string,
  fileName: string,
  text: string,
  replaceCurrent: boolean
): ImportedPageResult => {
  const fileTitle = fileName.replace(/\.[^.]+$/, '') || `Page ${pages.length + 1}`;

  if (replaceCurrent && activePageId) {
    return {
      nextPages: pages.map((page) =>
        page.id === activePageId ? { ...page, title: fileTitle, content: text } : page
      ),
      nextActivePageId: activePageId,
    };
  }

  const newPage: Page = {
    id: `p-${Date.now()}`,
    title: fileTitle,
    content: text,
    linkedChapterIds: [],
  };

  return {
    nextPages: [...pages, newPage],
    nextActivePageId: newPage.id,
  };
};

const createPlanningTask = (date: string): PlanningTask => ({
  id: createId('task'),
  title: 'New task',
  description: '',
  date,
  status: 'todo',
  comments: [],
  linkedChapterIds: [],
  linkedPartIds: [],
  linkedEventIds: [],
});

const addTaskToOutline = (outline: OutlineBundle, task: PlanningTask): OutlineBundle => ({
  ...outline,
  tasks: [...outline.tasks, task],
});

const updateTaskInOutline = (
  outline: OutlineBundle,
  taskId: string,
  updates: Partial<PlanningTask>
): OutlineBundle => ({
  ...outline,
  tasks: outline.tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task)),
});

const removeTaskFromOutline = (outline: OutlineBundle, taskId: string): OutlineBundle => ({
  ...outline,
  tasks: outline.tasks.filter((task) => task.id !== taskId),
});

const toggleTaskLinkInOutline = (
  outline: OutlineBundle,
  taskId: string,
  linkKey: TaskLinkKey,
  linkedId: string
): OutlineBundle => ({
  ...outline,
  tasks: outline.tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    return {
      ...task,
      [linkKey]: toggleLinkedId(task[linkKey], linkedId),
    };
  }),
});

const addTaskCommentToOutline = (
  outline: OutlineBundle,
  taskId: string,
  comment: PlanningTaskComment
): OutlineBundle => ({
  ...outline,
  tasks: outline.tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          comments: [...task.comments, comment],
        }
      : task
  ),
});

const buildTasksByDate = (tasks: PlanningTask[]): Map<string, PlanningTask[]> => {
  const nextMap = new Map<string, PlanningTask[]>();

  tasks.forEach((task) => {
    const existingTasks = nextMap.get(task.date) ?? [];
    existingTasks.push(task);
    nextMap.set(task.date, existingTasks);
  });

  nextMap.forEach((taskList) => taskList.sort(comparePlanningTasks));

  return nextMap;
};

const buildActivePageContext = (
  activePage: Page | undefined,
  chapterUsageMap: Map<string, ChapterUsageContext[]>
): ActivePageContext => {
  if (!activePage) {
    return EMPTY_ACTIVE_PAGE_CONTEXT;
  }

  const partIds = new Set<string>();
  const eventIds = new Set<string>();

  activePage.linkedChapterIds.forEach((chapterId) => {
    const contexts = chapterUsageMap.get(chapterId) ?? [];

    contexts.forEach((context) => {
      partIds.add(context.partId);
      eventIds.add(context.eventId);
    });
  });

  return {
    chapterIds: activePage.linkedChapterIds,
    partIds: Array.from(partIds),
    eventIds: Array.from(eventIds),
  };
};

const buildTaskLinkBadges = (
  task: PlanningTask,
  chapterMap: Map<string, OutlineChapter>,
  partMap: Map<string, OutlinePart>,
  eventContextMap: Map<string, ChapterUsageContext>
): TaskLinkBadge[] => [
  ...task.linkedChapterIds
    .map((chapterId) => chapterMap.get(chapterId))
    .filter(Boolean)
    .map((chapter) => ({
      key: `chapter:${chapter!.id}`,
      label: chapter!.title,
      kind: 'chapter' as const,
    })),
  ...task.linkedPartIds
    .map((partId) => partMap.get(partId))
    .filter(Boolean)
    .map((part) => ({
      key: `part:${part!.id}`,
      label: part!.title,
      kind: 'part' as const,
    })),
  ...task.linkedEventIds
    .map((eventId) => eventContextMap.get(eventId))
    .filter(Boolean)
    .map((eventContext) => ({
      key: `event:${eventContext!.eventId}`,
      label: eventContext!.eventTitle,
      kind: 'event' as const,
    })),
];

const SettingsView: React.FC = () => <div className="panel">Settings view (placeholder)</div>;

const BookWorkspace: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [book, setBook] = useState<Book | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>('editor');
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [pages, setPages] = useState<Page[]>([]);
  const [outline, setOutline] = useState<OutlineBundle>(defaultOutline());
  const [activePageId, setActivePageId] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [chapterDraftByEventId, setChapterDraftByEventId] = useState<Record<string, string>>({});
  const [addingChapterEventId, setAddingChapterEventId] = useState<string | null>(null);
  const [displayMonth, setDisplayMonth] = useState<Date>(() => getMonthStart(new Date()));
  const [selectedPlanningDate, setSelectedPlanningDate] = useState<string>(() =>
    formatDateInputValue(new Date())
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskCommentDraft, setTaskCommentDraft] = useState('');

  const pagesStorageKey = `book:${id}:pages`;
  const outlineStorageKey = `book:${id}:outline`;

  useEffect(() => {
    if (!id) {
      return;
    }

    getBookById(id).then(setBook).catch(() => setBook(null));
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }

    let cancelled = false;

    const loadWorkspace = async () => {
      try {
        const dir = await loadBookDirHandle(id);

        if (dir) {
          const [bookBundle, outlineBundle] = await Promise.all([
            readBookBundle(dir),
            readOutlineBundle(dir),
          ]);

          if (!cancelled) {
            const snapshot = buildWorkspaceSnapshot(
              bookBundle.pages.length > 0 ? bookBundle.pages : defaultPages(),
              outlineBundle
            );

            setPages(snapshot.pages);
            setActivePageId(snapshot.activePageId);
            setOutline(snapshot.outline);
            writeWorkspaceLocal(
              pagesStorageKey,
              outlineStorageKey,
              snapshot.pages,
              snapshot.outline
            );
          }

          return;
        }
      } catch {
        // ignore and fall back
      }

      const snapshot = buildStoredWorkspaceSnapshot(pagesStorageKey, outlineStorageKey);

      if (!cancelled) {
        setPages(snapshot.pages);
        setActivePageId(snapshot.activePageId);
        setOutline(snapshot.outline);
      }
    };

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [id, pagesStorageKey, outlineStorageKey]);

  useEffect(() => {
    if (!id || !isDirty) {
      return;
    }

    const timer = globalThis.setTimeout(() => {
      writeWorkspaceLocal(pagesStorageKey, outlineStorageKey, pages, outline);
      setIsDirty(false);
      setSaveMessage('Autosaved locally');
      globalThis.setTimeout(() => setSaveMessage(''), 1500);
    }, 800);

    return () => globalThis.clearTimeout(timer);
  }, [id, isDirty, outline, outlineStorageKey, pages, pagesStorageKey]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
    };

    window.addEventListener('beforeunload', onBeforeUnload);

    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? pages[0],
    [pages, activePageId]
  );

  const chapterMap = useMemo(
    () => new Map(outline.chapters.map((chapter) => [chapter.id, chapter])),
    [outline.chapters]
  );

  const partMap = useMemo(
    () => new Map(outline.parts.map((part) => [part.id, part])),
    [outline.parts]
  );

  const outlineEvents = useMemo(() => outline.parts.flatMap((part) => part.events), [outline]);

  const eventContextMap = useMemo(() => buildEventContextMap(outline.parts), [outline.parts]);

  const chapterUsageMap = useMemo(() => buildChapterUsageMap(outline.parts), [outline.parts]);

  const completedEvents = useMemo(
    () => outlineEvents.filter((event) => event.status === 'done').length,
    [outlineEvents]
  );

  const completedParts = useMemo(
    () => outline.parts.filter((part) => getPartStatus(part) === 'done').length,
    [outline]
  );

  const tasksByDate = useMemo(() => buildTasksByDate(outline.tasks), [outline.tasks]);

  const calendarDays = useMemo(() => buildCalendarDays(displayMonth), [displayMonth]);

  const selectedTask = useMemo(
    () => outline.tasks.find((task) => task.id === selectedTaskId) ?? null,
    [outline.tasks, selectedTaskId]
  );

  const activePageContext = useMemo(
    () => buildActivePageContext(activePage, chapterUsageMap),
    [activePage, chapterUsageMap]
  );

  const relevantPlanningTasks = useMemo(
    () =>
      [...outline.tasks]
        .filter(
          (task) =>
            intersects(task.linkedChapterIds, activePageContext.chapterIds) ||
            intersects(task.linkedPartIds, activePageContext.partIds) ||
            intersects(task.linkedEventIds, activePageContext.eventIds)
        )
        .sort(comparePlanningTasks),
    [outline.tasks, activePageContext]
  );

  const currentPlannedTask =
    relevantPlanningTasks.find((task) => task.status !== 'done') ?? relevantPlanningTasks[0] ?? null;

  const todayKey = formatDateInputValue(new Date());

  const tasksThisWeek = useMemo(() => {
    const today = parseDateInputValue(todayKey);
    const weekEnd = addDays(today, 6);

    return outline.tasks.filter((task) => {
      const taskDate = parseDateInputValue(task.date);
      return taskDate >= today && taskDate <= weekEnd;
    }).length;
  }, [outline.tasks, todayKey]);

  const inProgressTasks = useMemo(
    () => outline.tasks.filter((task) => task.status === 'in-progress').length,
    [outline.tasks]
  );

  const blockedTasks = useMemo(
    () => outline.tasks.filter((task) => task.status === 'blocked').length,
    [outline.tasks]
  );

  useEffect(() => {
    if (selectedTaskId && !outline.tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
      setTaskCommentDraft('');
    }
  }, [outline.tasks, selectedTaskId]);

  useEffect(() => {
    if (!selectedTask) {
      return;
    }

    setSelectedPlanningDate(selectedTask.date);
    setDisplayMonth(getMonthStart(parseDateInputValue(selectedTask.date)));
  }, [selectedTask]);

  const persistWorkspaceLocal = (nextPages: Page[], nextOutline: OutlineBundle) => {
    setPages(nextPages);
    setOutline(nextOutline);
    writeWorkspaceLocal(pagesStorageKey, outlineStorageKey, nextPages, nextOutline);
  };

  const saveToFolder = async (nextPages: Page[], nextOutline: OutlineBundle) => {
    if (!id) {
      return;
    }

    let dir = await loadBookDirHandle(id);

    if (!dir) {
      dir = await pickDirectory();
      await saveBookDirHandle(id, dir);
    }

    await writeBookBundle(
      dir,
      {
        title: book?.title ?? 'Untitled Book',
        author: book?.author ?? 'Unknown Author',
      },
      nextPages
    );

    await writeOutlineBundle(dir, nextOutline);
  };

  const addPart = () => {
    setOutline((current) => addPartToOutline(current));
    setIsDirty(true);
  };

  const updatePart = (partId: string, updates: Partial<OutlinePart>) => {
    setOutline((current) => updatePartInOutline(current, partId, updates));
    setIsDirty(true);
  };

  const removePart = (partId: string) => {
    setOutline((current) => removePartFromOutline(current, partId));
    setIsDirty(true);
  };

  const addEvent = (partId: string) => {
    setOutline((current) => addEventToOutline(current, partId));
    setIsDirty(true);
  };

  const updateEvent = (partId: string, eventId: string, updates: Partial<OutlineEvent>) => {
    setOutline((current) => updateEventInOutline(current, partId, eventId, updates));
    setIsDirty(true);
  };

  const removeEvent = (partId: string, eventId: string) => {
    setOutline((current) => removeEventFromOutline(current, partId, eventId));
    setIsDirty(true);
  };

  const toggleEventChapter = (partId: string, eventId: string, chapterId: string) => {
    setOutline((current) => toggleEventChapterInOutline(current, partId, eventId, chapterId));
    setIsDirty(true);
  };

  const updateChapterDraft = (eventId: string, value: string) => {
    setChapterDraftByEventId((current) => ({
      ...current,
      [eventId]: value,
    }));
  };

  const startAddingChapter = (eventId: string) => {
    setAddingChapterEventId(eventId);
  };

  const clearChapterDraft = (eventId: string) => {
    setChapterDraftByEventId((current) => ({
      ...current,
      [eventId]: '',
    }));
    setAddingChapterEventId((current) => (current === eventId ? null : current));
  };

  const cancelAddingChapter = (eventId: string) => {
    clearChapterDraft(eventId);
  };

  const createChapterForEvent = (partId: string, eventId: string, rawTitle: string) => {
    const trimmedTitle = rawTitle.trim();

    if (!trimmedTitle) {
      return;
    }

    setOutline((current) =>
      createOrLinkChapterForEventInOutline(current, partId, eventId, trimmedTitle)
    );
    clearChapterDraft(eventId);
    setIsDirty(true);
  };

  const togglePageChapter = (pageId: string, chapterId: string) => {
    setPages((current) => togglePageChapterInPages(current, pageId, chapterId));
    setIsDirty(true);
  };

  const updateActivePage = (content: string) => {
    setPages((current) => updatePageContent(current, activePageId, content));
    setIsDirty(true);
  };

  const handleLeave = () => {
    if (!isDirty) {
      return true;
    }

    return window.confirm('You have unsaved changes. Leave anyway?');
  };

  const handleSelectPage = (pageId: string) => {
    if (handleLeave()) {
      setActivePageId(pageId);
    }
  };

  const handleDashboardLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!handleLeave()) {
      event.preventDefault();
    }
  };

  const goBack = () => {
    if (handleLeave()) {
      navigate('/');
    }
  };

  const manualSave = async () => {
    try {
      writeWorkspaceLocal(pagesStorageKey, outlineStorageKey, pages, outline);
      await saveToFolder(pages, outline);
      setIsDirty(false);
      setSaveMessage('Saved to folder');
      window.setTimeout(() => setSaveMessage(''), 2000);
    } catch {
      setSaveMessage('Local save only');
      window.setTimeout(() => setSaveMessage(''), 2000);
    }
  };

  const handleImportPageClick = () => {
    importInputRef.current?.click();
  };

  const handleImportPage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const replaceCurrent = window.confirm(
        'Press OK to replace the current page. Press Cancel to import as a new page.'
      );

      const { nextPages, nextActivePageId } = resolveImportedPages(
        pages,
        activePageId,
        file.name,
        text,
        replaceCurrent
      );

      persistWorkspaceLocal(nextPages, outline);
      setActivePageId(nextActivePageId);
      setIsDirty(false);

      try {
        await saveToFolder(nextPages, outline);
        setSaveMessage('Page imported');
      } catch {
        setSaveMessage('Page imported locally');
      }

      window.setTimeout(() => setSaveMessage(''), 2000);
    } finally {
      event.target.value = '';
    }
  };

  const addTask = (date = selectedPlanningDate) => {
    const nextTask = createPlanningTask(date);

    setOutline((current) => addTaskToOutline(current, nextTask));
    setSelectedTaskId(nextTask.id);
    setSelectedPlanningDate(date);
    setDisplayMonth(getMonthStart(parseDateInputValue(date)));
    setTaskCommentDraft('');
    setIsDirty(true);
  };

  const updateTask = (taskId: string, updates: Partial<PlanningTask>) => {
    setOutline((current) => updateTaskInOutline(current, taskId, updates));
    setIsDirty(true);
  };

  const removeTask = (taskId: string) => {
    setOutline((current) => removeTaskFromOutline(current, taskId));
    setSelectedTaskId((current) => (current === taskId ? null : current));
    setTaskCommentDraft('');
    setIsDirty(true);
  };

  const toggleTaskLink = (taskId: string, linkKey: TaskLinkKey, linkedId: string) => {
    setOutline((current) => toggleTaskLinkInOutline(current, taskId, linkKey, linkedId));
    setIsDirty(true);
  };

  const addTaskComment = (taskId: string, rawBody: string) => {
    const trimmedBody = rawBody.trim();

    if (!trimmedBody) {
      return;
    }

    const nextComment: PlanningTaskComment = {
      id: createId('comment'),
      body: trimmedBody,
      createdAt: new Date().toISOString(),
    };

    setOutline((current) => addTaskCommentToOutline(current, taskId, nextComment));
    setTaskCommentDraft('');
    setIsDirty(true);
  };

  const openTaskInPlanning = (task: PlanningTask) => {
    setSelectedTaskId(task.id);
    setSelectedPlanningDate(task.date);
    setDisplayMonth(getMonthStart(parseDateInputValue(task.date)));
    setActiveView('planning');
  };

  const getTaskLinkBadges = (task: PlanningTask): TaskLinkBadge[] =>
    buildTaskLinkBadges(task, chapterMap, partMap, eventContextMap);

  let activeViewContent: React.ReactNode = null;

  switch (activeView) {
    case 'editor':
      activeViewContent = (
        <EditorView
          pages={pages}
          activePage={activePage}
          activePageId={activePageId}
          outline={outline}
          chapterMap={chapterMap}
          chapterUsageMap={chapterUsageMap}
          currentPlannedTask={currentPlannedTask}
          relevantPlanningTasks={relevantPlanningTasks}
          onSelectPage={handleSelectPage}
          onTogglePageChapter={togglePageChapter}
          onOpenTaskInPlanning={openTaskInPlanning}
          onUpdateActivePage={updateActivePage}
          getTaskLinkBadges={getTaskLinkBadges}
        />
      );
      break;
    case 'outline':
      activeViewContent = (
        <OutlineView
          outline={outline}
          outlineEvents={outlineEvents}
          completedParts={completedParts}
          completedEvents={completedEvents}
          chapterMap={chapterMap}
          chapterDraftByEventId={chapterDraftByEventId}
          addingChapterEventId={addingChapterEventId}
          onAddPart={addPart}
          onUpdatePart={updatePart}
          onRemovePart={removePart}
          onAddEvent={addEvent}
          onUpdateEvent={updateEvent}
          onRemoveEvent={removeEvent}
          onToggleEventChapter={toggleEventChapter}
          onUpdateChapterDraft={updateChapterDraft}
          onStartAddingChapter={startAddingChapter}
          onCancelAddingChapter={cancelAddingChapter}
          onCreateChapterForEvent={createChapterForEvent}
        />
      );
      break;
    case 'planning':
      activeViewContent = (
        <PlanningView
          outline={outline}
          outlineEvents={outlineEvents}
          tasksByDate={tasksByDate}
          calendarDays={calendarDays}
          displayMonth={displayMonth}
          selectedPlanningDate={selectedPlanningDate}
          selectedTask={selectedTask}
          selectedTaskId={selectedTaskId}
          taskCommentDraft={taskCommentDraft}
          tasksThisWeek={tasksThisWeek}
          inProgressTasks={inProgressTasks}
          blockedTasks={blockedTasks}
          eventContextMap={eventContextMap}
          onSetDisplayMonth={setDisplayMonth}
          onSetSelectedPlanningDate={setSelectedPlanningDate}
          onSetSelectedTaskId={setSelectedTaskId}
          onSetTaskCommentDraft={setTaskCommentDraft}
          onAddTask={addTask}
          onUpdateTask={updateTask}
          onRemoveTask={removeTask}
          onToggleTaskLink={toggleTaskLink}
          onAddTaskComment={addTaskComment}
          getTaskLinkBadges={getTaskLinkBadges}
        />
      );
      break;
    case 'settings':
      activeViewContent = <SettingsView />;
      break;
    default:
      activeViewContent = null;
  }

  return (
    <div className="book-workspace">
      <div className={`page-shell ${activeView === 'planning' ? 'planning-mode' : ''}`}>
        <aside className="workspace-sidebar">
          <div className="brand">Writer's Companion</div>
          <button className="secondary-action" onClick={goBack}>
            Back to Dashboard
          </button>

          <div className="book-meta">
            <h1 className="book-meta-title">{book?.title ?? 'Book'}</h1>
            <div className="book-meta-author">{book?.author ?? 'Unknown author'}</div>
          </div>

          <nav className="nav">
            <button
              className={activeView === 'editor' ? 'active' : ''}
              onClick={() => setActiveView('editor')}
            >
              Editor
            </button>
            <button
              className={activeView === 'outline' ? 'active' : ''}
              onClick={() => setActiveView('outline')}
            >
              Outline
            </button>
            <button
              className={activeView === 'planning' ? 'active' : ''}
              onClick={() => setActiveView('planning')}
            >
              Planning
            </button>
            <button
              className={activeView === 'settings' ? 'active' : ''}
              onClick={() => setActiveView('settings')}
            >
              Settings
            </button>
          </nav>
        </aside>

        <main className="content">
          <div className="workspace-header">
            <div className="header-copy">
              <Link className="back" to="/" onClick={handleDashboardLinkClick}>
                Back to Dashboard
              </Link>
              <div className="book-title">{book?.title ?? 'Book Workspace'}</div>
              <div className="workspace-subtitle">Draft, revise, and manage pages in one place.</div>
            </div>

            <div className="actions">
              <span className="status">{isDirty ? 'Unsaved changes' : 'Ready'}</span>
              {saveMessage ? <span className="status">{saveMessage}</span> : null}
              <button className="primary-action" onClick={manualSave}>
                Save
              </button>
              <button className="secondary-action" onClick={handleImportPageClick}>
                Import Page
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".txt,.md,.rtf,text/plain,text/markdown"
                onChange={handleImportPage}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {activeViewContent}
        </main>
      </div>
    </div>
  );
};

export default BookWorkspace;