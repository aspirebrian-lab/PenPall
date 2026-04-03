import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OutlineView from './OutlineView';
import type { OutlineViewProps } from './BookWorkSpaceShared';
import type { OutlineBundle } from '../../utils/fsAccess';

const buildProps = (overrides: Partial<OutlineViewProps> = {}): OutlineViewProps => {
  const outline: OutlineBundle = {
    version: 2,
    chapters: [],
    parts: [],
    tasks: [],
  };

  return {
    outline,
    outlineEvents: [],
    completedParts: 0,
    completedEvents: 0,
    chapterMap: new Map(),
    chapterDraftByEventId: {},
    addingChapterEventId: null,
    onAddPart: vi.fn(),
    onUpdatePart: vi.fn(),
    onRemovePart: vi.fn(),
    onAddEvent: vi.fn(),
    onUpdateEvent: vi.fn(),
    onRemoveEvent: vi.fn(),
    onToggleEventChapter: vi.fn(),
    onUpdateChapterDraft: vi.fn(),
    onStartAddingChapter: vi.fn(),
    onCancelAddingChapter: vi.fn(),
    onCreateChapterForEvent: vi.fn(),
    ...overrides,
  };
};

describe('OutlineView', () => {
  it('renders empty states and adds a part', () => {
    const props = buildProps();

    render(<OutlineView {...props} />);

    expect(
    screen.getByText(/No chapters yet\. Add one from an event's chapter picker\./i)    
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No parts yet. Start by adding a part, then add the key events that belong to it."
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add Part' }));
    expect(props.onAddPart).toHaveBeenCalled();
  });

  it('renders an event row and wires update, toggle, remove, and add event actions', () => {
    const props = buildProps({
      outline: {
        version: 2,
        chapters: [{ id: 'chapter-1', title: 'Chapter One' }],
        parts: [
          {
            id: 'part-1',
            title: 'Part I',
            description: 'Opening',
            status: 'todo',
            events: [
              {
                id: 'event-1',
                title: 'Opening incident',
                description: 'The story begins',
                status: 'todo',
                linkedChapterIds: [],
              },
            ],
          },
        ],
        tasks: [],
      },
      outlineEvents: [
        {
          id: 'event-1',
          title: 'Opening incident',
          description: 'The story begins',
          status: 'todo',
          linkedChapterIds: [],
        },
      ],
      chapterMap: new Map([['chapter-1', { id: 'chapter-1', title: 'Chapter One' }]]),
    });

    render(<OutlineView {...props} />);

    fireEvent.change(screen.getByDisplayValue('Part I'), {
      target: { value: 'Part One' },
    });
    expect(props.onUpdatePart).toHaveBeenCalledWith('part-1', { title: 'Part One' });

    fireEvent.change(screen.getByDisplayValue('Opening'), {
      target: { value: 'Updated opening' },
    });
    expect(props.onUpdatePart).toHaveBeenCalledWith('part-1', { description: 'Updated opening' });

    fireEvent.change(screen.getByDisplayValue('Opening incident'), {
      target: { value: 'Inciting incident' },
    });
    expect(props.onUpdateEvent).toHaveBeenCalledWith('part-1', 'event-1', {
      title: 'Inciting incident',
    });

    fireEvent.click(screen.getByText('No chapters linked'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chapter One' }));
    expect(props.onToggleEventChapter).toHaveBeenCalledWith('part-1', 'event-1', 'chapter-1');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Event' }));
    expect(props.onRemoveEvent).toHaveBeenCalledWith('part-1', 'event-1');

    fireEvent.click(screen.getByRole('button', { name: 'Add Event' }));
    expect(props.onAddEvent).toHaveBeenCalledWith('part-1');
  });

  it('supports creating and cancelling chapter creation from the picker', () => {
    const props = buildProps({
      outline: {
        version: 2,
        chapters: [{ id: 'chapter-1', title: 'Chapter One' }],
        parts: [
          {
            id: 'part-1',
            title: 'Part I',
            description: '',
            status: 'todo',
            events: [
              {
                id: 'event-1',
                title: 'Opening incident',
                description: '',
                status: 'todo',
                linkedChapterIds: [],
              },
            ],
          },
        ],
        tasks: [],
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
      chapterDraftByEventId: { 'event-1': 'Chapter Two' },
      addingChapterEventId: 'event-1',
    });

    render(<OutlineView {...props} />);

    const chapterInput = screen.getByPlaceholderText('New chapter title');

    fireEvent.change(chapterInput, { target: { value: 'Chapter Three' } });
    expect(props.onUpdateChapterDraft).toHaveBeenCalledWith('event-1', 'Chapter Three');

    fireEvent.keyDown(chapterInput, { key: 'Enter' });
    expect(props.onCreateChapterForEvent).toHaveBeenCalledWith('part-1', 'event-1', 'Chapter Two');

    fireEvent.keyDown(chapterInput, { key: 'Escape' });
    expect(props.onCancelAddingChapter).toHaveBeenCalledWith('event-1');

    fireEvent.click(screen.getByRole('button', { name: 'Create chapter' }));
    expect(props.onCreateChapterForEvent).toHaveBeenCalledWith('part-1', 'event-1', 'Chapter Two');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancelAddingChapter).toHaveBeenCalledWith('event-1');
  });
});