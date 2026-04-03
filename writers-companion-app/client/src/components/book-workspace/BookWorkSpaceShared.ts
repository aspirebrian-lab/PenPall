import {
  SyncPage,
  OutlinePart,
  OutlineEvent,
  OutlineStatus,
  OutlineChapter,
  PlanningTask,
  OutlineBundle,
} from '../../utils/fsAccess';

export type Page = SyncPage;

export type ChapterUsageContext = {
  partId: string;
  partTitle: string;
  eventId: string;
  eventTitle: string;
};

export type ActivePageContext = {
  chapterIds: string[];
  partIds: string[];
  eventIds: string[];
};

export type TaskLinkKey = 'linkedChapterIds' | 'linkedPartIds' | 'linkedEventIds';

export type TaskLinkBadge = {
  key: string;
  label: string;
  kind: 'chapter' | 'part' | 'event';
};

export const dayLabelFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
export const shortMonthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
export const monthLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});
export const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

export const formatDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateInputValue = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

export const addDays = (date: Date, amount: number): Date => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
};

export const isSameMonth = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();

export const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const statusLabel: Record<OutlineStatus, string> = {
  todo: 'To do',
  'in-progress': 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

const isPartDone = (part: OutlinePart): boolean =>
  part.events.length > 0 && part.events.every((event) => event.status === 'done');

export const getPartStatus = (part: OutlinePart): OutlineStatus => {
  if (isPartDone(part)) {
    return 'done';
  }

  if (part.status === 'done') {
    return 'in-progress';
  }

  return part.status;
};

export type EditorViewProps = {
  pages: Page[];
  activePage?: Page;
  activePageId: string;
  outline: OutlineBundle;
  chapterMap: Map<string, OutlineChapter>;
  chapterUsageMap: Map<string, ChapterUsageContext[]>;
  currentPlannedTask: PlanningTask | null;
  relevantPlanningTasks: PlanningTask[];
  onSelectPage: (pageId: string) => void;
  onTogglePageChapter: (pageId: string, chapterId: string) => void;
  onOpenTaskInPlanning: (task: PlanningTask) => void;
  onUpdateActivePage: (content: string) => void;
  getTaskLinkBadges: (task: PlanningTask) => TaskLinkBadge[];
};

export type OutlineViewProps = {
  outline: OutlineBundle;
  outlineEvents: OutlineEvent[];
  completedParts: number;
  completedEvents: number;
  chapterMap: Map<string, OutlineChapter>;
  chapterDraftByEventId: Record<string, string>;
  addingChapterEventId: string | null;
  onAddPart: () => void;
  onUpdatePart: (partId: string, updates: Partial<OutlinePart>) => void;
  onRemovePart: (partId: string) => void;
  onAddEvent: (partId: string) => void;
  onUpdateEvent: (
    partId: string,
    eventId: string,
    updates: Partial<OutlineEvent>
  ) => void;
  onRemoveEvent: (partId: string, eventId: string) => void;
  onToggleEventChapter: (partId: string, eventId: string, chapterId: string) => void;
  onUpdateChapterDraft: (eventId: string, value: string) => void;
  onStartAddingChapter: (eventId: string) => void;
  onCancelAddingChapter: (eventId: string) => void;
  onCreateChapterForEvent: (partId: string, eventId: string, rawTitle: string) => void;
};

export type PlanningViewProps = {
  outline: OutlineBundle;
  outlineEvents: OutlineEvent[];
  tasksByDate: Map<string, PlanningTask[]>;
  calendarDays: Date[];
  displayMonth: Date;
  selectedPlanningDate: string;
  selectedTask: PlanningTask | null;
  selectedTaskId: string | null;
  taskCommentDraft: string;
  tasksThisWeek: number;
  inProgressTasks: number;
  blockedTasks: number;
  eventContextMap: Map<string, ChapterUsageContext>;
  onSetDisplayMonth: React.Dispatch<React.SetStateAction<Date>>;
  onSetSelectedPlanningDate: React.Dispatch<React.SetStateAction<string>>;
  onSetSelectedTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  onSetTaskCommentDraft: React.Dispatch<React.SetStateAction<string>>;
  onAddTask: (date?: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<PlanningTask>) => void;
  onRemoveTask: (taskId: string) => void;
  onToggleTaskLink: (
    taskId: string,
    linkKey: 'linkedChapterIds' | 'linkedPartIds' | 'linkedEventIds',
    linkedId: string
  ) => void;
  onAddTaskComment: (taskId: string, rawBody: string) => void;
  getTaskLinkBadges: (task: PlanningTask) => TaskLinkBadge[];
};