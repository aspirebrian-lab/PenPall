import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlanningView from './PlanningView';
import { formatDateInputValue, type PlanningViewProps, type TaskLinkBadge } from './BookWorkSpaceShared';
import type { PlanningTask, OutlineBundle } from '../../utils/fsAccess';

const buildTask = (overrides: Partial<PlanningTask> = {}): PlanningTask => ({
  id: 'task-1',
  title: 'Draft opening',
  description: '',
  date: '2026-04-03',
  status: 'todo',
  comments: [],
  linkedChapterIds: [],
  linkedPartIds: [],
  linkedEventIds: [],
  ...overrides,
});

const buildDate = () => new Date('2026-04-03T12:00:00.000Z');
const buildDateKey = () => formatDateInputValue(buildDate());

const buildProps = (overrides: Partial<PlanningViewProps> = {}): PlanningViewProps => {
  const outline: OutlineBundle = {
    version: 2,
    chapters: [],
    parts: [],
    tasks: [],
  };

  return {
    outline,
    outlineEvents: [],
    tasksByDate: new Map(),
    calendarDays: [buildDate()],
    displayMonth: new Date('2026-04-01T12:00:00.000Z'),
    selectedPlanningDate: buildDateKey(),
    selectedTask: null,
    selectedTaskId: null,
    taskCommentDraft: '',
    tasksThisWeek: 0,
    inProgressTasks: 0,
    blockedTasks: 0,
    eventContextMap: new Map(),
    onSetDisplayMonth: vi.fn(),
    onSetSelectedPlanningDate: vi.fn(),
    onSetSelectedTaskId: vi.fn(),
    onSetTaskCommentDraft: vi.fn(),
    onAddTask: vi.fn(),
    onUpdateTask: vi.fn(),
    onRemoveTask: vi.fn(),
    onToggleTaskLink: vi.fn(),
    onAddTaskComment: vi.fn(),
    getTaskLinkBadges: vi.fn((task: PlanningTask): TaskLinkBadge[] =>
      task.id === 'task-1'
        ? [
            { key: 'chapter:chapter-1', label: 'Chapter One', kind: 'chapter' },
            { key: 'part:part-1', label: 'Part I', kind: 'part' },
            { key: 'event:event-1', label: 'Opening incident', kind: 'event' },
          ]
        : []
    ),
    ...overrides,
  };
};

describe('PlanningView', () => {
  it('renders the empty planner state and handles calendar selection and task creation', () => {
    const props = buildProps();

    render(<PlanningView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Add task for/i }));
    expect(props.onAddTask).toHaveBeenCalledWith(buildDateKey());

    fireEvent.click(screen.getByRole('button', { name: 'New Task' }));
    expect(props.onAddTask).toHaveBeenCalledWith(buildDateKey());

    fireEvent.click(
    screen.getByRole('button', { name: /3.*April 3, 2026/i })
    );    
    expect(props.onSetSelectedPlanningDate).toHaveBeenCalledWith(buildDateKey());
    expect(props.onSetSelectedTaskId).toHaveBeenCalledWith(null);
  });

  it('renders selected task details and wires edit, delete, and comment actions', () => {
    const selectedTask = buildTask({
      id: 'task-1',
      title: 'Revise opening',
      description: 'Tighten the first scene.',
      comments: [],
      status: 'in-progress',
    });

    const props = buildProps({
      outline: {
        version: 2,
        chapters: [],
        parts: [],
        tasks: [selectedTask],
      },
      selectedTask,
      selectedTaskId: 'task-1',
      taskCommentDraft: 'Add more urgency.',
    });

    render(<PlanningView {...props} />);

    fireEvent.change(screen.getByDisplayValue('Revise opening'), {
      target: { value: 'Revise chapter opening' },
    });
    expect(props.onUpdateTask).toHaveBeenCalledWith('task-1', {
      title: 'Revise chapter opening',
    });

    fireEvent.change(screen.getByDisplayValue('2026-04-03'), {
      target: { value: '2026-04-04' },
    });
    expect(props.onUpdateTask).toHaveBeenCalledWith('task-1', {
      date: '2026-04-04',
    });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'blocked' },
    });
    expect(props.onUpdateTask).toHaveBeenCalledWith('task-1', {
      status: 'blocked',
    });

    fireEvent.change(screen.getByDisplayValue('Tighten the first scene.'), {
      target: { value: 'Rewrite the opening for clarity.' },
    });
    expect(props.onUpdateTask).toHaveBeenCalledWith('task-1', {
      description: 'Rewrite the opening for clarity.',
    });

    fireEvent.change(screen.getByPlaceholderText('Add a comment about this task'), {
      target: { value: 'Escalate the conflict.' },
    });
    expect(props.onSetTaskCommentDraft).toHaveBeenCalledWith('Escalate the conflict.');

    fireEvent.click(screen.getByRole('button', { name: 'Add Comment' }));
    expect(props.onAddTaskComment).toHaveBeenCalledWith('task-1', 'Add more urgency.');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Task' }));
    expect(props.onRemoveTask).toHaveBeenCalledWith('task-1');
  });

  it('renders populated link groups, badges, comments, and calendar task selection', () => {
    const selectedTask = buildTask({
      id: 'task-1',
      title: 'Draft opening',
      comments: [{ id: 'comment-1', body: 'Keep it lean.', createdAt: '2026-04-03T10:00:00.000Z' }],
      linkedChapterIds: ['chapter-1'],
      linkedPartIds: ['part-1'],
      linkedEventIds: ['event-1'],
    });
    const queuedTask = buildTask({
      id: 'task-2',
      title: 'Polish ending',
      date: buildDateKey(),
      status: 'done',
    });

    const props = buildProps({
      outline: {
        version: 2,
        chapters: [{ id: 'chapter-1', title: 'Chapter One' }],
        parts: [{ id: 'part-1', title: 'Part I', description: '', status: 'todo', events: [] }],
        tasks: [selectedTask, queuedTask],
      },
      outlineEvents: [
        {
          id: 'event-1',
          title: 'Opening incident',
          description: '',
          status: 'todo',
          linkedChapterIds: [],
        },
      ],
      tasksByDate: new Map([[buildDateKey(), [selectedTask, queuedTask]]]),
      selectedTask,
      selectedTaskId: 'task-1',
      tasksThisWeek: 2,
      inProgressTasks: 0,
      blockedTasks: 0,
      eventContextMap: new Map([
        ['event-1', { partId: 'part-1', partTitle: 'Part I', eventId: 'event-1', eventTitle: 'Opening incident' }],
      ]),
      getTaskLinkBadges: vi.fn((task: PlanningTask): TaskLinkBadge[] =>
        task.id === 'task-1'
          ? [
              { key: 'chapter:chapter-1', label: 'Chapter One', kind: 'chapter' },
              { key: 'part:part-1', label: 'Part I', kind: 'part' },
              { key: 'event:event-1', label: 'Opening incident', kind: 'event' },
            ]
          : []
      ),
    });

    render(<PlanningView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Chapter One.*Chapter/i }));
    expect(props.onToggleTaskLink).toHaveBeenCalledWith('task-1', 'linkedChapterIds', 'chapter-1');

    fireEvent.click(screen.getByRole('button', { name: /Part I.*Part/i }));
    expect(props.onToggleTaskLink).toHaveBeenCalledWith('task-1', 'linkedPartIds', 'part-1');

    fireEvent.click(screen.getByRole('button', { name: /Opening incident.*Part I/i }));
    expect(props.onToggleTaskLink).toHaveBeenCalledWith('task-1', 'linkedEventIds', 'event-1');

    expect(screen.getByText('Keep it lean.')).toBeInTheDocument();
    expect(
    screen.getByText('Chapter One', { selector: '.planning-link-chip.kind-chapter' })
    ).toBeInTheDocument();

    expect(
    screen.getByText('Opening incident', { selector: '.planning-link-chip.kind-event' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Polish ending/i }));
    expect(props.onSetSelectedTaskId).toHaveBeenCalledWith('task-2');
    expect(props.onSetSelectedPlanningDate).toHaveBeenCalledWith(buildDateKey());
  });
});