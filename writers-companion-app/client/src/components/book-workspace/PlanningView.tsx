import React from 'react';
import { OutlineStatus } from '../../utils/fsAccess';
import {
  PlanningViewProps,
  addDays,
  dayLabelFormatter,
  fullDateFormatter,
  isSameDay,
  isSameMonth,
  monthLabelFormatter,
  parseDateInputValue,
  shortMonthFormatter,
  statusLabel,
} from './BookWorkSpaceShared';

const PlanningView: React.FC<PlanningViewProps> = ({
  outline,
  outlineEvents,
  tasksByDate,
  calendarDays,
  displayMonth,
  selectedPlanningDate,
  selectedTask,
  selectedTaskId,
  taskCommentDraft,
  tasksThisWeek,
  inProgressTasks,
  blockedTasks,
  eventContextMap,
  onSetDisplayMonth,
  onSetSelectedPlanningDate,
  onSetSelectedTaskId,
  onSetTaskCommentDraft,
  onAddTask,
  onUpdateTask,
  onRemoveTask,
  onToggleTaskLink,
  onAddTaskComment,
  getTaskLinkBadges,
}) => (
  <div className="panel planning-panel">
    <div className="planning-summary">
      <div className="planning-summary-card">
        <div className="planning-summary-label">Total tasks</div>
        <div className="planning-summary-value">{outline.tasks.length}</div>
      </div>
      <div className="planning-summary-card">
        <div className="planning-summary-label">Due in 7 days</div>
        <div className="planning-summary-value">{tasksThisWeek}</div>
      </div>
      <div className="planning-summary-card">
        <div className="planning-summary-label">In progress</div>
        <div className="planning-summary-value">{inProgressTasks}</div>
      </div>
      <div className="planning-summary-card">
        <div className="planning-summary-label">Blocked</div>
        <div className="planning-summary-value">{blockedTasks}</div>
      </div>
    </div>

    <div className="planning-layout">
      <section className="planning-calendar-card">
        <div className="planning-toolbar">
          <div>
            <div className="planning-section-title">Task calendar</div>
            <div className="planning-copy">
              Schedule work visually, then link each task back to the chapter, part, and event it
              serves.
            </div>
          </div>

          <div className="planning-month-controls">
            <button
              className="ghost-action"
              onClick={() =>
                onSetDisplayMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                )
              }
            >
              Previous
            </button>
            <div className="planning-month-label">{monthLabelFormatter.format(displayMonth)}</div>
            <button
              className="ghost-action"
              onClick={() =>
                onSetDisplayMonth(
                  (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                )
              }
            >
              Next
            </button>
          </div>
        </div>

        <div className="planning-calendar-scroll">
          <div className="planning-weekdays">
            {Array.from({ length: 7 }, (_, index) => {
              const day = addDays(new Date(2026, 0, 4), index);

              return (
                <div key={day.toISOString()} className="planning-weekday">
                  {dayLabelFormatter.format(day)}
                </div>
              );
            })}
          </div>

          <div className="planning-calendar-grid">
            {calendarDays.map((calendarDay) => {
              const dateKey = calendarDay.toISOString().slice(0, 10);
              const dayTasks = tasksByDate.get(dateKey) ?? [];
              const isToday = isSameDay(calendarDay, new Date());
              const isSelected = selectedPlanningDate === dateKey;
              const fullDateLabel = fullDateFormatter.format(calendarDay);

              let dayBadge: string | null = null;

              if (isToday) {
                dayBadge = 'Today';
              } else if (calendarDay.getDate() === 1) {
                dayBadge = shortMonthFormatter.format(calendarDay);
              }

              return (
                <div
                  key={dateKey}
                  className={`calendar-day ${
                    isSameMonth(calendarDay, displayMonth) ? '' : 'is-outside-month'
                  } ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
                >
                  <button
                    className="calendar-day-header"
                    onClick={() => {
                      onSetSelectedPlanningDate(dateKey);
                      onSetSelectedTaskId(null);
                    }}
                  >
                    <span className="calendar-day-topline">
                      <span className="calendar-day-number">{calendarDay.getDate()}</span>
                      {dayBadge ? <span className="calendar-day-badge">{dayBadge}</span> : null}
                    </span>
                    <span className="calendar-day-label">{fullDateLabel}</span>
                  </button>

                  <div className="calendar-day-tasks">
                    {dayTasks.map((task) => (
                      <button
                        key={task.id}
                        className={`task-block status-${task.status} ${
                          selectedTaskId === task.id ? 'active' : ''
                        }`}
                        onClick={() => {
                          onSetSelectedTaskId(task.id);
                          onSetSelectedPlanningDate(task.date);
                        }}
                      >
                        <div className="task-block-copy">
                          <span className="task-block-title">{task.title}</span>
                          <span className="task-block-meta">
                            {statusLabel[task.status]} · {task.comments.length} comment
                            {task.comments.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="task-block-tags">
                          {getTaskLinkBadges(task)
                            .slice(0, 2)
                            .map((badge) => (
                              <span key={badge.key} className={`task-block-tag kind-${badge.kind}`}>
                                {badge.label}
                              </span>
                            ))}
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    className="calendar-add-task"
                    aria-label={`Add task for ${fullDateLabel}`}
                    onClick={() => onAddTask(dateKey)}
                  >
                    + Task
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="planning-inspector">
        <div className="planning-inspector-header">
          <div>
            <div className="planning-section-title">Planner</div>
            <div className="planning-copy">
              {selectedTask
                ? 'Refine the selected task, connect it to story structure, and capture comments.'
                : `Select a task or create one for ${fullDateFormatter.format(
                    parseDateInputValue(selectedPlanningDate)
                  )}.`}
            </div>
          </div>

          {selectedTask ? null : (
            <button className="primary-action" onClick={() => onAddTask(selectedPlanningDate)}>
              New Task
            </button>
          )}
        </div>

        {selectedTask ? (
          <div className="planning-form">
            <div className="planning-form-header">
              <div className="planning-section-title">Task details</div>
              <button className="ghost-action" onClick={() => onRemoveTask(selectedTask.id)}>
                Delete Task
              </button>
            </div>

            <input
              className="outline-field"
              value={selectedTask.title}
              onChange={(event) => onUpdateTask(selectedTask.id, { title: event.target.value })}
              placeholder="Task title"
            />

            <div className="planning-form-row">
              <input
                className="outline-field"
                type="date"
                value={selectedTask.date}
                onChange={(event) => onUpdateTask(selectedTask.id, { date: event.target.value })}
              />
              <select
                className="outline-select"
                value={selectedTask.status}
                onChange={(event) =>
                  onUpdateTask(selectedTask.id, {
                    status: event.target.value as OutlineStatus,
                  })
                }
              >
                <option value="todo">To do</option>
                <option value="in-progress">In progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </div>

            <textarea
              className="outline-textarea"
              value={selectedTask.description}
              onChange={(event) =>
                onUpdateTask(selectedTask.id, { description: event.target.value })
              }
              placeholder="Describe the writing work or revision goal."
            />

            <div className="planning-section">
              <div className="planning-section-title">Story links</div>
              <div className="planning-link-list">
                <div className="planning-link-group">
                  <div className="planning-helper">Chapters</div>
                  {outline.chapters.length > 0 ? (
                    <div className="planning-link-options">
                      {outline.chapters.map((chapter) => {
                        const isLinked = selectedTask.linkedChapterIds.includes(chapter.id);

                        return (
                          <button
                            key={chapter.id}
                            type="button"
                            className={`planning-link-option ${isLinked ? 'is-linked' : ''}`}
                            onClick={() =>
                              onToggleTaskLink(selectedTask.id, 'linkedChapterIds', chapter.id)
                            }
                          >
                            <span className="planning-link-option-copy">
                              <span className="planning-link-option-title">{chapter.title}</span>
                              <span className="planning-link-option-subtitle">Chapter</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="planning-link-empty">No chapters available yet.</div>
                  )}
                </div>

                <div className="planning-link-group">
                  <div className="planning-helper">Parts</div>
                  {outline.parts.length > 0 ? (
                    <div className="planning-link-options">
                      {outline.parts.map((part) => {
                        const isLinked = selectedTask.linkedPartIds.includes(part.id);

                        return (
                          <button
                            key={part.id}
                            type="button"
                            className={`planning-link-option ${isLinked ? 'is-linked' : ''}`}
                            onClick={() =>
                              onToggleTaskLink(selectedTask.id, 'linkedPartIds', part.id)
                            }
                          >
                            <span className="planning-link-option-copy">
                              <span className="planning-link-option-title">{part.title}</span>
                              <span className="planning-link-option-subtitle">Part</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="planning-link-empty">No parts available yet.</div>
                  )}
                </div>

                <div className="planning-link-group">
                  <div className="planning-helper">Events</div>
                  {outlineEvents.length > 0 ? (
                    <div className="planning-link-options">
                      {outlineEvents.map((outlineEvent) => {
                        const isLinked = selectedTask.linkedEventIds.includes(outlineEvent.id);
                        const eventContext = eventContextMap.get(outlineEvent.id);

                        return (
                          <button
                            key={outlineEvent.id}
                            type="button"
                            className={`planning-link-option ${isLinked ? 'is-linked' : ''}`}
                            onClick={() =>
                              onToggleTaskLink(selectedTask.id, 'linkedEventIds', outlineEvent.id)
                            }
                          >
                            <span className="planning-link-option-copy">
                              <span className="planning-link-option-title">{outlineEvent.title}</span>
                              <span className="planning-link-option-subtitle">
                                {eventContext ? eventContext.partTitle : 'Event'}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="planning-link-empty">No events available yet.</div>
                  )}
                </div>
              </div>

              <div className="planned-task-tag-list">
                {getTaskLinkBadges(selectedTask).length > 0 ? (
                  getTaskLinkBadges(selectedTask).map((badge) => (
                    <span key={badge.key} className={`planning-link-chip kind-${badge.kind}`}>
                      {badge.label}
                    </span>
                  ))
                ) : (
                  <span className="planning-link-empty">
                    This task is not linked yet. Connect it to the story structure above.
                  </span>
                )}
              </div>
            </div>

            <div className="planning-section">
              <div className="planning-section-title">Comments</div>
              {selectedTask.comments.length > 0 ? (
                <div className="task-comment-list">
                  {selectedTask.comments.map((comment) => (
                    <div key={comment.id} className="task-comment-item">
                      <div className="comment-header">
                        <span className="comment-title">Note</span>
                        <span className="comment-meta">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="comment-body">{comment.body}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="planning-empty">No comments yet.</div>
              )}

              <div className="task-comment-composer">
                <textarea
                  className="outline-textarea"
                  placeholder="Add a comment about this task"
                  value={taskCommentDraft}
                  onChange={(event) => onSetTaskCommentDraft(event.target.value)}
                />
                <button
                  className="secondary-action"
                  onClick={() => onAddTaskComment(selectedTask.id, taskCommentDraft)}
                >
                  Add Comment
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="planning-empty">
            Create a task for the selected date, or pick a task block from the calendar to edit it.
          </div>
        )}
      </aside>
    </div>
  </div>
);

export default PlanningView;