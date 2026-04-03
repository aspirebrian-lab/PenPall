import React from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import type { OutlineChapter, PlanningTask } from '../../utils/fsAccess';
import {
  EditorViewProps,
  fullDateFormatter,
  parseDateInputValue,
  statusLabel,
} from './BookWorkSpaceShared';

const getLinkedChapters = (
  chapterIds: string[],
  chapterMap: Map<string, OutlineChapter>
): OutlineChapter[] =>
  chapterIds
    .map((chapterId) => chapterMap.get(chapterId))
    .filter((chapter): chapter is OutlineChapter => Boolean(chapter));

type PageListProps = Pick<EditorViewProps, 'pages' | 'activePageId' | 'chapterMap' | 'onSelectPage'>;

const PageList: React.FC<PageListProps> = ({ pages, activePageId, chapterMap, onSelectPage }) => (
  <div className="page-list">
    {pages.map((page) => {
      const linkedChapters = getLinkedChapters(page.linkedChapterIds, chapterMap);
      const primaryChapter = linkedChapters[0];
      const extraChapterCount = Math.max(page.linkedChapterIds.length - 1, 0);

      return (
        <button
          key={page.id}
          className={`page-pill ${page.id === activePageId ? 'active' : ''}`}
          onClick={() => onSelectPage(page.id)}
        >
          <span className="page-pill-title">{page.title}</span>
          {linkedChapters.length > 0 ? (
            <span className="page-pill-tags">
              {primaryChapter ? (
                <span className="page-pill-tag">{primaryChapter.title}</span>
              ) : null}
              {extraChapterCount > 0 ? (
                <span className="page-pill-tag">+{extraChapterCount}</span>
              ) : null}
            </span>
          ) : null}
        </button>
      );
    })}
  </div>
);

type ActivePageChapterPanelProps = Pick<
  EditorViewProps,
  'activePage' | 'outline' | 'chapterMap' | 'chapterUsageMap' | 'onTogglePageChapter'
>;

const ActivePageChapterPanel: React.FC<ActivePageChapterPanelProps> = ({
  activePage,
  outline,
  chapterMap,
  chapterUsageMap,
  onTogglePageChapter,
}) => {
  if (!activePage) {
    return null;
  }

  const linkedChapters = getLinkedChapters(activePage.linkedChapterIds, chapterMap);
  const triggerChapters = linkedChapters.slice(0, 2);
  const extraTriggerCount = Math.max(activePage.linkedChapterIds.length - 2, 0);

  if (outline.chapters.length === 0) {
    return (
      <>
        <div className="page-link-label">Page chapter tags</div>
        <div className="page-link-empty">
          No chapters exist yet. Add chapters in the outline view first.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-link-label">Page chapter tags</div>

      <details className="page-link-dropdown">
        <summary className="page-link-trigger">
          <div className="page-link-trigger-copy">
            <span className="page-link-trigger-title">Chapter tags</span>
            <span className="page-link-trigger-subtitle">
              {activePage.linkedChapterIds.length > 0
                ? `${activePage.linkedChapterIds.length} linked`
                : 'No chapter tags selected'}
            </span>
          </div>

          <div className="page-link-trigger-meta">
            {triggerChapters.map((chapter) => (
              <span key={chapter.id} className="page-link-trigger-tag">
                {chapter.title}
              </span>
            ))}
            {extraTriggerCount > 0 ? (
              <span className="page-link-trigger-count">+{extraTriggerCount}</span>
            ) : null}
            <span className="page-link-caret">▾</span>
          </div>
        </summary>

        <div className="page-link-menu">
          <div className="page-link-options">
            {outline.chapters.map((chapter) => {
              const contexts = chapterUsageMap.get(chapter.id) ?? [];
              const isLinked = activePage.linkedChapterIds.includes(chapter.id);

              return (
                <label
                  key={chapter.id}
                  className={`page-link-option ${isLinked ? 'is-linked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isLinked}
                    onChange={() => onTogglePageChapter(activePage.id, chapter.id)}
                  />
                  <div className="page-link-copy">
                    <span className="page-link-title">{chapter.title}</span>
                    {contexts.length > 0 ? (
                      <div className="page-link-contexts">
                        {contexts.map((context) => (
                          <React.Fragment key={`${context.partId}:${context.eventId}`}>
                            <span className="page-meta-tag part-tag">{context.partTitle}</span>
                            <span className="page-meta-tag">{context.eventTitle}</span>
                          </React.Fragment>
                        ))}
                      </div>
                    ) : (
                      <span className="page-link-empty-context">
                        This chapter is not linked to an event yet.
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </details>

      {linkedChapters.length > 0 ? (
        <div className="page-linked-chapters">
          {linkedChapters.map((chapter) => (
            <span key={chapter.id} className="page-linked-chapter-tag">
              {chapter.title}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
};

type CurrentPlanPanelProps = Pick<
  EditorViewProps,
  | 'activePage'
  | 'currentPlannedTask'
  | 'relevantPlanningTasks'
  | 'onOpenTaskInPlanning'
  | 'getTaskLinkBadges'
>;

const PlannedTaskQueue: React.FC<{
  tasks: PlanningTask[];
  currentTaskId: string;
  onOpenTaskInPlanning: (task: PlanningTask) => void;
}> = ({ tasks, currentTaskId, onOpenTaskInPlanning }) => {
  const queuedTasks = tasks.filter((task) => task.id !== currentTaskId).slice(0, 3);

  if (queuedTasks.length === 0) {
    return null;
  }

  return (
    <div className="planned-task-queue">
      {queuedTasks.map((task) => (
        <button
          key={task.id}
          className="planned-task-queue-item"
          onClick={() => onOpenTaskInPlanning(task)}
        >
          <span className="planned-task-queue-header">
            <span className="queue-task-title">{task.title}</span>
            <span className="queue-task-date">
              {fullDateFormatter.format(parseDateInputValue(task.date))}
            </span>
          </span>
          <span className="planned-task-subtitle">{statusLabel[task.status]}</span>
        </button>
      ))}
    </div>
  );
};

const CurrentPlanPanel: React.FC<CurrentPlanPanelProps> = ({
  activePage,
  currentPlannedTask,
  relevantPlanningTasks,
  onOpenTaskInPlanning,
  getTaskLinkBadges,
}) => {
  if (!activePage) {
    return null;
  }

  if (!currentPlannedTask) {
    return (
      <div className="planned-task-panel">
        <div className="page-link-label">Current plan</div>
        <div className="planned-task-empty">
          {activePage.linkedChapterIds.length > 0
            ? 'No planned tasks are linked to this page yet. Add them from Planning.'
            : 'Link this page to a chapter to surface tasks tied to its chapters, parts, and events.'}
        </div>
      </div>
    );
  }

  const taskBadges = getTaskLinkBadges(currentPlannedTask);

  return (
    <div className="planned-task-panel">
      <div className="page-link-label">Current plan</div>

      <div className="planned-task-card">
        <div className="planned-task-card-header">
          <div>
            <div className="planned-task-title">{currentPlannedTask.title}</div>
            <div className="planned-task-subtitle">
              {fullDateFormatter.format(parseDateInputValue(currentPlannedTask.date))} ·{' '}
              {statusLabel[currentPlannedTask.status]}
            </div>
          </div>

          <button
            className="ghost-action"
            onClick={() => onOpenTaskInPlanning(currentPlannedTask)}
          >
            Open in Planning
          </button>
        </div>

        {currentPlannedTask.description ? (
          <div className="planned-task-description">{currentPlannedTask.description}</div>
        ) : null}

        <div className="planned-task-tags">
          <div className="planned-task-tag-list">
            <span className={`task-status-badge status-${currentPlannedTask.status}`}>
              {statusLabel[currentPlannedTask.status]}
            </span>
            <span className="planning-count-pill">
              {currentPlannedTask.comments.length} comment
              {currentPlannedTask.comments.length === 1 ? '' : 's'}
            </span>
            {taskBadges.map((badge) => (
              <span key={badge.key} className={`planned-task-tag kind-${badge.kind}`}>
                {badge.label}
              </span>
            ))}
          </div>
        </div>

        <PlannedTaskQueue
          tasks={relevantPlanningTasks}
          currentTaskId={currentPlannedTask.id}
          onOpenTaskInPlanning={onOpenTaskInPlanning}
        />
      </div>
    </div>
  );
};

const EditorView: React.FC<EditorViewProps> = ({
  pages,
  activePage,
  activePageId,
  outline,
  chapterMap,
  chapterUsageMap,
  currentPlannedTask,
  relevantPlanningTasks,
  onSelectPage,
  onTogglePageChapter,
  onOpenTaskInPlanning,
  onUpdateActivePage,
  getTaskLinkBadges,
}) => (
  <div className="panel">
    <PageList
      pages={pages}
      activePageId={activePageId}
      chapterMap={chapterMap}
      onSelectPage={onSelectPage}
    />

    {activePage ? (
      <div className="page-link-panel">
        <ActivePageChapterPanel
          activePage={activePage}
          outline={outline}
          chapterMap={chapterMap}
          chapterUsageMap={chapterUsageMap}
          onTogglePageChapter={onTogglePageChapter}
        />
        <CurrentPlanPanel
          activePage={activePage}
          currentPlannedTask={currentPlannedTask}
          relevantPlanningTasks={relevantPlanningTasks}
          onOpenTaskInPlanning={onOpenTaskInPlanning}
          getTaskLinkBadges={getTaskLinkBadges}
        />
      </div>
    ) : null}

    <ReactQuill
      key={activePageId}
      value={activePage?.content ?? ''}
      onChange={onUpdateActivePage}
      className="editor"
      placeholder="Start writing this page..."
    />
  </div>
);

export default EditorView;