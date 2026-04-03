import React from 'react';
import type {
  OutlineChapter,
  OutlineEvent,
  OutlinePart,
  OutlineStatus,
} from '../../utils/fsAccess';
import { getPartStatus, OutlineViewProps } from './BookWorkSpaceShared';

const getLinkedChapters = (
  chapterIds: string[],
  chapterMap: Map<string, OutlineChapter>
): OutlineChapter[] =>
  chapterIds
    .map((chapterId) => chapterMap.get(chapterId))
    .filter((chapter): chapter is OutlineChapter => Boolean(chapter));

const buildLinkedChapterText = (linkedChapters: OutlineChapter[]): string =>
  linkedChapters.length > 0
    ? linkedChapters.map((chapter) => chapter.title).join(', ')
    : 'No chapters linked';

const stopChapterPickerClick = (event: React.MouseEvent<HTMLButtonElement>) => {
  event.preventDefault();
  event.stopPropagation();
};

const OutlineSummary: React.FC<
  Pick<OutlineViewProps, 'outline' | 'outlineEvents' | 'completedParts' | 'completedEvents'>
> = ({ outline, outlineEvents, completedParts, completedEvents }) => (
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
);

const ChapterLibrary: React.FC<Pick<OutlineViewProps, 'outline'>> = ({ outline }) => (
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
);

type ChapterPickerProps = Pick<
  OutlineViewProps,
  | 'outline'
  | 'chapterDraftByEventId'
  | 'addingChapterEventId'
  | 'onToggleEventChapter'
  | 'onUpdateChapterDraft'
  | 'onStartAddingChapter'
  | 'onCancelAddingChapter'
  | 'onCreateChapterForEvent'
> & {
  partId: string;
  outlineEvent: OutlineEvent;
  linkedChapterText: string;
};

const ChapterPicker: React.FC<ChapterPickerProps> = ({
  outline,
  chapterDraftByEventId,
  addingChapterEventId,
  onToggleEventChapter,
  onUpdateChapterDraft,
  onStartAddingChapter,
  onCancelAddingChapter,
  onCreateChapterForEvent,
  partId,
  outlineEvent,
  linkedChapterText,
}) => {
  const chapterDraft = chapterDraftByEventId[outlineEvent.id] ?? '';
  const isAddingChapter = addingChapterEventId === outlineEvent.id;

  const handleCreateChapter = () => {
    onCreateChapterForEvent(partId, outlineEvent.id, chapterDraft);
  };

  const handleCancelChapter = () => {
    onCancelAddingChapter(outlineEvent.id);
  };

  const handleChapterDraftKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleCreateChapter();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelChapter();
    }
  };

  return (
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
                    onToggleEventChapter(partId, outlineEvent.id, chapter.id)
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
                onKeyDown={handleChapterDraftKeyDown}
              />
              <button
                className="ghost-action"
                onClick={(event) => {
                  stopChapterPickerClick(event);
                  handleCreateChapter();
                }}
              >
                Create chapter
              </button>
              <button
                className="ghost-action"
                onClick={(event) => {
                  stopChapterPickerClick(event);
                  handleCancelChapter();
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="ghost-action"
              onClick={(event) => {
                stopChapterPickerClick(event);
                onStartAddingChapter(outlineEvent.id);
              }}
            >
              + Add chapter
            </button>
          )}
        </div>
      </details>
    </div>
  );
};

type OutlineEventRowProps = Pick<
  OutlineViewProps,
  | 'outline'
  | 'chapterMap'
  | 'chapterDraftByEventId'
  | 'addingChapterEventId'
  | 'onUpdateEvent'
  | 'onRemoveEvent'
  | 'onToggleEventChapter'
  | 'onUpdateChapterDraft'
  | 'onStartAddingChapter'
  | 'onCancelAddingChapter'
  | 'onCreateChapterForEvent'
> & {
  partId: string;
  outlineEvent: OutlineEvent;
};

const OutlineEventRow: React.FC<OutlineEventRowProps> = ({
  outline,
  chapterMap,
  chapterDraftByEventId,
  addingChapterEventId,
  onUpdateEvent,
  onRemoveEvent,
  onToggleEventChapter,
  onUpdateChapterDraft,
  onStartAddingChapter,
  onCancelAddingChapter,
  onCreateChapterForEvent,
  partId,
  outlineEvent,
}) => {
  const linkedChapters = getLinkedChapters(
    outlineEvent.linkedChapterIds,
    chapterMap
  );
  const linkedChapterText = buildLinkedChapterText(linkedChapters);

  return (
    <div className="outline-event-row">
      <div className="outline-event-details">
        <input
          className="outline-field"
          value={outlineEvent.title}
          onChange={(event) =>
            onUpdateEvent(partId, outlineEvent.id, {
              title: event.target.value,
            })
          }
          placeholder="Event title"
        />
        <textarea
          className="outline-textarea"
          value={outlineEvent.description}
          onChange={(event) =>
            onUpdateEvent(partId, outlineEvent.id, {
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
          onUpdateEvent(partId, outlineEvent.id, {
            status: event.target.value as OutlineStatus,
          })
        }
      >
        <option value="todo">To do</option>
        <option value="in-progress">In progress</option>
        <option value="blocked">Blocked</option>
        <option value="done">Done</option>
      </select>

      <ChapterPicker
        outline={outline}
        chapterDraftByEventId={chapterDraftByEventId}
        addingChapterEventId={addingChapterEventId}
        onToggleEventChapter={onToggleEventChapter}
        onUpdateChapterDraft={onUpdateChapterDraft}
        onStartAddingChapter={onStartAddingChapter}
        onCancelAddingChapter={onCancelAddingChapter}
        onCreateChapterForEvent={onCreateChapterForEvent}
        partId={partId}
        outlineEvent={outlineEvent}
        linkedChapterText={linkedChapterText}
      />

      <button
        className="ghost-action"
        onClick={() => onRemoveEvent(partId, outlineEvent.id)}
      >
        Remove Event
      </button>
    </div>
  );
};

type OutlinePartCardProps = Pick<
  OutlineViewProps,
  | 'outline'
  | 'chapterMap'
  | 'chapterDraftByEventId'
  | 'addingChapterEventId'
  | 'onUpdatePart'
  | 'onRemovePart'
  | 'onAddEvent'
  | 'onUpdateEvent'
  | 'onRemoveEvent'
  | 'onToggleEventChapter'
  | 'onUpdateChapterDraft'
  | 'onStartAddingChapter'
  | 'onCancelAddingChapter'
  | 'onCreateChapterForEvent'
> & {
  part: OutlinePart;
};

const OutlinePartCard: React.FC<OutlinePartCardProps> = ({
  outline,
  chapterMap,
  chapterDraftByEventId,
  addingChapterEventId,
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
  part,
}) => (
  <section className="outline-part-card">
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
      onChange={(event) =>
        onUpdatePart(part.id, { description: event.target.value })
      }
      placeholder="Describe what this section of the book needs to achieve."
    />

    <div className="outline-events">
      {part.events.map((outlineEvent) => (
        <OutlineEventRow
          key={outlineEvent.id}
          outline={outline}
          chapterMap={chapterMap}
          chapterDraftByEventId={chapterDraftByEventId}
          addingChapterEventId={addingChapterEventId}
          onUpdateEvent={onUpdateEvent}
          onRemoveEvent={onRemoveEvent}
          onToggleEventChapter={onToggleEventChapter}
          onUpdateChapterDraft={onUpdateChapterDraft}
          onStartAddingChapter={onStartAddingChapter}
          onCancelAddingChapter={onCancelAddingChapter}
          onCreateChapterForEvent={onCreateChapterForEvent}
          partId={part.id}
          outlineEvent={outlineEvent}
        />
      ))}
    </div>

    <button className="secondary-action" onClick={() => onAddEvent(part.id)}>
      Add Event
    </button>
  </section>
);

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
    <OutlineSummary
      outline={outline}
      outlineEvents={outlineEvents}
      completedParts={completedParts}
      completedEvents={completedEvents}
    />

    <div className="outline-toolbar">
      <div className="workspace-subtitle">
        Structure the book into parts, track key events, and link each event to none or multiple
        chapters.
      </div>
      <button className="primary-action" onClick={onAddPart}>
        Add Part
      </button>
    </div>

    <ChapterLibrary outline={outline} />

    {outline.parts.length === 0 ? (
      <div className="outline-empty">
        No parts yet. Start by adding a part, then add the key events that belong to it.
      </div>
    ) : null}

    <div className="outline-parts">
      {outline.parts.map((part) => (
        <OutlinePartCard
          key={part.id}
          outline={outline}
          chapterMap={chapterMap}
          chapterDraftByEventId={chapterDraftByEventId}
          addingChapterEventId={addingChapterEventId}
          onUpdatePart={onUpdatePart}
          onRemovePart={onRemovePart}
          onAddEvent={onAddEvent}
          onUpdateEvent={onUpdateEvent}
          onRemoveEvent={onRemoveEvent}
          onToggleEventChapter={onToggleEventChapter}
          onUpdateChapterDraft={onUpdateChapterDraft}
          onStartAddingChapter={onStartAddingChapter}
          onCancelAddingChapter={onCancelAddingChapter}
          onCreateChapterForEvent={onCreateChapterForEvent}
          part={part}
        />
      ))}
    </div>
  </div>
);

export default OutlineView;