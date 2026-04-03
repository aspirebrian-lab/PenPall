import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EditorView from './EditorView';
import type { EditorViewProps, TaskLinkBadge } from './BookWorkSpaceShared';
import type { OutlineBundle, PlanningTask } from '../../utils/fsAccess';

vi.mock('react-quill-new', () => ({
  default: function MockReactQuill(props: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
  }) {
    return (
      <textarea
        data-testid="quill"
        className={props.className}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    );
  },
}));

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

const buildProps = (overrides: Partial<EditorViewProps> = {}): EditorViewProps => {
  const outline: OutlineBundle = {
    version: 2,
    chapters: [],
    parts: [],
    tasks: [],
  };

  return {
    pages: [{ id: 'p1', title: 'Page 1', content: 'Draft body', linkedChapterIds: [] }],
    activePage: { id: 'p1', title: 'Page 1', content: 'Draft body', linkedChapterIds: [] },
    activePageId: 'p1',
    outline,
    chapterMap: new Map(),
    chapterUsageMap: new Map(),
    currentPlannedTask: null,
    relevantPlanningTasks: [],
    onSelectPage: vi.fn(),
    onTogglePageChapter: vi.fn(),
    onOpenTaskInPlanning: vi.fn(),
    onUpdateActivePage: vi.fn(),
    getTaskLinkBadges: vi.fn((task: PlanningTask): TaskLinkBadge[] =>
      task.id === 'task-current'
        ? [{ key: 'event:event-1', label: 'Opening incident', kind: 'event' }]
        : []
    ),
    ...overrides,
  };
};

describe('EditorView', () => {
  it('renders empty chapter and planning states and updates editor content', () => {
    const props = buildProps();

    render(<EditorView {...props} />);

    expect(
      screen.getByText('No chapters exist yet. Add chapters in the outline view first.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Link this page to a chapter to surface tasks tied to its chapters, parts, and events.'
      )
    ).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('quill'), {
      target: { value: 'Updated draft' },
    });

    expect(props.onUpdateActivePage).toHaveBeenCalledWith('Updated draft');
  });

  it('renders linked chapter context and opens current and queued tasks in planning', () => {
    const openTask = vi.fn();
    const toggleChapter = vi.fn();
    const currentTask = buildTask({
      id: 'task-current',
      title: 'Revise chapter one',
      description: 'Sharpen the opening.',
      status: 'in-progress',
      comments: [{ id: 'comment-1', body: 'Keep the tension high.', createdAt: '2026-04-03T10:00:00.000Z' }],
      linkedEventIds: ['event-1'],
    });
    const queuedTask = buildTask({
      id: 'task-queued',
      title: 'Polish scene ending',
      date: '2026-04-04',
      status: 'todo',
    });

    const props = buildProps({
      outline: {
        version: 2,
        chapters: [{ id: 'chapter-1', title: 'Chapter One' }],
        parts: [],
        tasks: [],
      },
      pages: [{ id: 'p1', title: 'Page 1', content: 'Draft body', linkedChapterIds: ['chapter-1'] }],
      activePage: { id: 'p1', title: 'Page 1', content: 'Draft body', linkedChapterIds: ['chapter-1'] },
      chapterMap: new Map([['chapter-1', { id: 'chapter-1', title: 'Chapter One' }]]),
      chapterUsageMap: new Map([
        [
          'chapter-1',
          [{ partId: 'part-1', partTitle: 'Part I', eventId: 'event-1', eventTitle: 'Opening incident' }],
        ],
      ]),
      currentPlannedTask: currentTask,
      relevantPlanningTasks: [currentTask, queuedTask],
      onTogglePageChapter: toggleChapter,
      onOpenTaskInPlanning: openTask,
      getTaskLinkBadges: vi.fn((task: PlanningTask): TaskLinkBadge[] =>
        task.id === 'task-current'
          ? [{ key: 'event:event-1', label: 'Opening incident', kind: 'event' }]
          : []
      ),
    });

    render(<EditorView {...props} />);

    fireEvent.click(screen.getByText('Chapter tags'));

    fireEvent.click(
      screen.getByRole('checkbox', { name: /Chapter One/i })
    );

    expect(toggleChapter).toHaveBeenCalledWith('p1', 'chapter-1');

    expect(screen.getByText('Part I', { selector: '.page-meta-tag.part-tag' })).toBeInTheDocument();

    expect(
      screen.getByText('Opening incident', { selector: '.page-meta-tag' })
    ).toBeInTheDocument();

    expect(screen.getByText('Sharpen the opening.')).toBeInTheDocument();

    expect(
      screen.getByText('Opening incident', { selector: '.planned-task-tag.kind-event' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open in Planning' }));
    expect(openTask).toHaveBeenCalledWith(currentTask);

    fireEvent.click(screen.getByRole('button', { name: /Polish scene ending/i }));
    expect(openTask).toHaveBeenCalledWith(queuedTask);
  });
});