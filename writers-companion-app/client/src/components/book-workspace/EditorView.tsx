import React from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  EditorViewProps,
  fullDateFormatter,
  parseDateInputValue,
  statusLabel,
} from './BookWorkSpaceShared';

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
    <div className="page-list">
      {pages.map((page) => (
        <button
          key={page.id}
          className={`page-pill ${page.id === activePageId ? 'active' : ''}`}
          onClick={() => onSelectPage(page.id)}
        >
          <span className="page-pill-title">{page.title}</span>
          {page.linkedChapterIds.length > 0 ? (
            <span className="page-pill-tags">
              {page.linkedChapterIds
                .map((chapterId) => chapterMap.get(chapterId))
                .filter(Boolean)
                .slice(0, 1)
                .map((chapter) => (
                  <span key={chapter!.id} className="page-pill-tag">
                    {chapter!.title}
                  </span>
                ))}
              {page.linkedChapterIds.length > 1 ? (
                <span className="page-pill-tag">+{page.linkedChapterIds.length - 1}</span>
              ) : null}
            </span>
          ) : null}
        </button>
      ))}
    </div>

    {activePage ? (
      <div className="page-link-panel">
        <div className="page-link-label">Page chapter tags</div>

        {outline.chapters.length === 0 ? (
          <div className="page-link-empty">
            No chapters exist yet. Add chapters in the outline view first.
          </div>
        ) : (
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
                {activePage.linkedChapterIds
                  .map((chapterId) => chapterMap.get(chapterId))
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((chapter) => (
                    <span key={chapter!.id} className="page-link-trigger-tag">
                      {chapter!.title}
                    </span>
                  ))}
                {activePage.linkedChapterIds.length > 2 ? (
                  <span className="page-link-trigger-count">
                    +{activePage.linkedChapterIds.length - 2}
                  </span>
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
        )}

        {activePage.linkedChapterIds.length > 0 ? (
          <div className="page-linked-chapters">
            {activePage.linkedChapterIds
              .map((chapterId) => chapterMap.get(chapterId))
              .filter(Boolean)
              .map((chapter) => (
                <span key={chapter!.id} className="page-linked-chapter-tag">
                  {chapter!.title}
                </span>
              ))}
          </div>
        ) : null}

        <div className="planned-task-panel">
          <div className="page-link-label">Current plan</div>
          {currentPlannedTask ? (
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
                  {getTaskLinkBadges(currentPlannedTask).map((badge) => (
                    <span key={badge.key} className={`planned-task-tag kind-${badge.kind}`}>
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>

              {relevantPlanningTasks.length > 1 ? (
                <div className="planned-task-queue">
                  {relevantPlanningTasks
                    .filter((task) => task.id !== currentPlannedTask.id)
                    .slice(0, 3)
                    .map((task) => (
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
              ) : null}
            </div>
          ) : (
            <div className="planned-task-empty">
              {activePage.linkedChapterIds.length > 0
                ? 'No planned tasks are linked to this page yet. Add them from Planning.'
                : 'Link this page to a chapter to surface tasks tied to its chapters, parts, and events.'}
            </div>
          )}
        </div>
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