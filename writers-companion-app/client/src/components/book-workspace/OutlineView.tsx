import React from 'react';
import { OutlineChapter, OutlineStatus } from '../../utils/fsAccess';
import { getPartStatus, OutlineViewProps } from './BookWorkSpaceShared';

const OutlineView: React.FC<OutlineViewProps> = ({
  outline,
  outlineEvents,
  completedParts,
  completedEvents,
  chapterMap,
  chapterDraftByEventId,
  addingChapterEventId,
  onAddPart,
  onUpdatePart,
  onRemovePart,
  onAddEvent,
  onUpdateEvent,
  onRemoveEvent,
  onToggleEventChapter,
  onUpdateChapterDraft,
  onStartAddingChapter,
  onCancelAddingChapter,
  onCreateChapterForEvent,
}) => (
  <div className="panel outline-panel">
    <div className="outline-summary">
      <div className="summary-card">
        <span>Parts</span>
        <strong>{outline.parts.length}</strong>
      </div>
      <div className="summary-card">
        <span>Events</span>
        <strong>{outlineEvents.length}</strong>
      </div>
      <div className="summary-card">
        <span>Chapters</span>
        <strong>{outline.chapters.length}</strong>
      </div>
      <div className="summary-card">
        <span>Completed parts</span>
        <strong>{completedParts}</strong>
      </div>
      <div className="summary-card">
        <span>Completed events</span>
        <strong>{completedEvents}</strong>
      </div>
    </div>

    <div className="outline-toolbar">
      <div className="workspace-subtitle">
        Structure the book into parts, track key events, and link each event to none or multiple
        chapters.
      </div>
      <button className="primary-action" onClick={onAddPart}>
        Add Part
      </button>
    </div>

    <div className="chapter-library">
      {outline.chapters.length === 0 ? (
        <div className="chapter-library-empty">
          No chapters yet. Add one from an event&apos;s chapter picker.
        </div>
      ) : (
        outline.chapters.map((chapter) => (
          <span key={chapter.id} className="chapter-chip">
            {chapter.title}
          </span>
        ))
      )}
    </div>

    {outline.parts.length === 0 && (
      <div className="outline-empty">
        No parts yet. Start by adding a part, then add the key events that belong to it.
      </div>
    )}

    <div className="outline-parts">
      {outline.parts.map((part) => (
        <section key={part.id} className="outline-part-card">
          <div className="outline-part-header">
            <input
              className="outline-field"
              value={part.title}
              onChange={(event) => onUpdatePart(part.id, { title: event.target.value })}
              placeholder="Part title"
            />
            <select
              className="outline-select"
              value={part.status}
              onChange={(event) =>
                onUpdatePart(part.id, { status: event.target.value as OutlineStatus })
              }
            >
              <option value="todo">To do</option>
              <option value="in-progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
            <span className="status-pill">{getPartStatus(part)}</span>
            <button className="ghost-action" onClick={() => onRemovePart(part.id)}>
              Remove Part
            </button>
          </div>

          <textarea
            className="outline-textarea"
            value={part.description}
            onChange={(event) => onUpdatePart(part.id, { description: event.target.value })}
            placeholder="Describe what this section of the book needs to achieve."
          />

          <div className="outline-events">
            {part.events.map((outlineEvent) => {
              const linkedChapters = outlineEvent.linkedChapterIds
                .map((chapterId) => chapterMap.get(chapterId))
                .filter(Boolean) as OutlineChapter[];

              const linkedChapterText =
                linkedChapters.length > 0
                  ? linkedChapters.map((chapter) => chapter.title).join(', ')
                  : 'No chapters linked';

              const chapterDraft = chapterDraftByEventId[outlineEvent.id] ?? '';
              const isAddingChapter = addingChapterEventId === outlineEvent.id;

              return (
                <div key={outlineEvent.id} className="outline-event-row">
                  <div className="outline-event-details">
                    <input
                      className="outline-field"
                      value={outlineEvent.title}
                      onChange={(event) =>
                        onUpdateEvent(part.id, outlineEvent.id, {
                          title: event.target.value,
                        })
                      }
                      placeholder="Event title"
                    />
                    <textarea
                      className="outline-textarea"
                      value={outlineEvent.description}
                      onChange={(event) =>
                        onUpdateEvent(part.id, outlineEvent.id, {
                          description: event.target.value,
                        })
                      }
                      placeholder="What happens in this event?"
                    />
                    <div className="linked-chapter-list">
                      {linkedChapters.length > 0 ? (
                        linkedChapters.map((chapter) => (
                          <span key={chapter.id} className="linked-chapter-chip">
                            {chapter.title}
                          </span>
                        ))
                      ) : (
                        <span className="linked-chapter-empty">No chapter links yet.</span>
                      )}
                    </div>
                  </div>

                  <select
                    className="outline-select"
                    value={outlineEvent.status}
                    onChange={(event) =>
                      onUpdateEvent(part.id, outlineEvent.id, {
                        status: event.target.value as OutlineStatus,
                      })
                    }
                  >
                    <option value="todo">To do</option>
                    <option value="in-progress">In progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </select>

                  <div className="chapter-picker">
                    <details className="chapter-dropdown">
                      <summary className="chapter-trigger">
                        <span className="chapter-trigger-text">{linkedChapterText}</span>
                        <span className="chapter-trigger-add">+</span>
                      </summary>

                      <div className="chapter-menu">
                        {outline.chapters.length === 0 ? (
                          <div className="chapter-menu-empty">No chapters yet. Add one below.</div>
                        ) : (
                          outline.chapters.map((chapter) => (
                            <label key={chapter.id} className="chapter-option">
                              <input
                                type="checkbox"
                                checked={outlineEvent.linkedChapterIds.includes(chapter.id)}
                                onChange={() =>
                                  onToggleEventChapter(part.id, outlineEvent.id, chapter.id)
                                }
                              />
                              <span>{chapter.title}</span>
                            </label>
                          ))
                        )}

                        {isAddingChapter ? (
                          <div className="chapter-create">
                            <input
                              className="outline-field"
                              value={chapterDraft}
                              onChange={(event) =>
                                onUpdateChapterDraft(outlineEvent.id, event.target.value)
                              }
                              placeholder="New chapter title"
                              autoFocus
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  onCreateChapterForEvent(part.id, outlineEvent.id, chapterDraft);
                                }

                                if (event.key === 'Escape') {
                                  event.preventDefault();
                                  onCancelAddingChapter(outlineEvent.id);
                                }
                              }}
                            />
                            <button
                              className="ghost-action"
                              onClick={(clickEvent) => {
                                clickEvent.preventDefault();
                                clickEvent.stopPropagation();
                                onCreateChapterForEvent(part.id, outlineEvent.id, chapterDraft);
                              }}
                            >
                              Create chapter
                            </button>
                            <button
                              className="ghost-action"
                              onClick={(clickEvent) => {
                                clickEvent.preventDefault();
                                clickEvent.stopPropagation();
                                onCancelAddingChapter(outlineEvent.id);
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            className="ghost-action"
                            onClick={(clickEvent) => {
                              clickEvent.preventDefault();
                              clickEvent.stopPropagation();
                              onStartAddingChapter(outlineEvent.id);
                            }}
                          >
                            + Add chapter
                          </button>
                        )}
                      </div>
                    </details>
                  </div>

                  <button
                    className="ghost-action"
                    onClick={() => onRemoveEvent(part.id, outlineEvent.id)}
                  >
                    Remove Event
                  </button>
                </div>
              );
            })}
          </div>

          <button className="secondary-action" onClick={() => onAddEvent(part.id)}>
            Add Event
          </button>
        </section>
      ))}
    </div>
  </div>
);

export default OutlineView;