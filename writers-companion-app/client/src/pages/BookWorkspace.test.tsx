import React, { act } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BookWorkspace from './BookWorkspace';
import { getBookById } from '../services/api';
import {
  loadBookDirHandle,
  pickDirectory,
  readBookBundle,
  saveBookDirHandle,
  writeBookBundle,
  readOutlineBundle,
  writeOutlineBundle,
} from '../utils/fsAccess';

const mockedNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'book-1' }),
    useNavigate: () => mockedNavigate,
  };
});

vi.mock('../services/api', () => ({
  getBookById: vi.fn(),
}));

vi.mock('../utils/fsAccess', () => ({
  loadBookDirHandle: vi.fn(),
  pickDirectory: vi.fn(),
  readBookBundle: vi.fn(),
  saveBookDirHandle: vi.fn(),
  writeBookBundle: vi.fn(),
  readOutlineBundle: vi.fn(),
  writeOutlineBundle: vi.fn(),
}));

vi.mock('react-quill-new', () => {
  return {
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
          onChange={(e) => props.onChange(e.target.value)}
        />
      );
    },
  };
});

const mockedGetBookById = getBookById as unknown as ReturnType<typeof vi.fn>;
const mockedLoadBookDirHandle = loadBookDirHandle as unknown as ReturnType<typeof vi.fn>;
const mockedPickDirectory = pickDirectory as unknown as ReturnType<typeof vi.fn>;
const mockedReadBookBundle = readBookBundle as unknown as ReturnType<typeof vi.fn>;
const mockedSaveBookDirHandle = saveBookDirHandle as unknown as ReturnType<typeof vi.fn>;
const mockedWriteBookBundle = writeBookBundle as unknown as ReturnType<typeof vi.fn>;
const mockedReadOutlineBundle = readOutlineBundle as unknown as ReturnType<typeof vi.fn>;
const mockedWriteOutlineBundle = writeOutlineBundle as unknown as ReturnType<typeof vi.fn>;

const renderWorkspace = () =>
  render(
    <MemoryRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <BookWorkspace />
    </MemoryRouter>
  );

describe('BookWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    (mockedGetBookById as any).mockResolvedValue({
      _id: 'book-1',
      title: 'Test Book',
      author: 'Test Author',
    });

    (mockedLoadBookDirHandle as any).mockResolvedValue(null);
    (mockedReadBookBundle as any).mockResolvedValue({
      title: undefined,
      author: undefined,
      pages: [],
    });
    (mockedPickDirectory as any).mockResolvedValue({ name: 'Folder' } as any);
    (mockedSaveBookDirHandle as any).mockResolvedValue(undefined);
    (mockedWriteBookBundle as any).mockResolvedValue(undefined);
    (mockedReadOutlineBundle as any).mockResolvedValue({
      version: 2,
      chapters: [],
      parts: [],
    });
    (mockedWriteOutlineBundle as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('prefers folder bundle pages when a folder handle exists', async () => {
    const dir = { name: 'Folder' } as any;
    (mockedLoadBookDirHandle as any).mockResolvedValue(dir);
    (mockedReadBookBundle as any).mockResolvedValue({
      title: 'From Disk',
      author: 'Disk Author',
      pages: [{ id: 'disk-1', title: 'Scene One', content: 'Imported opening', linkedChapterIds: [] }],
    });

    renderWorkspace();

    expect(await screen.findByText('Scene One')).toBeInTheDocument();
    expect(screen.getByTestId('quill')).toHaveValue('Imported opening');
  });

  it('autosaves locally after editor changes', async () => {
    vi.useFakeTimers();

    const storageKey = 'book:book-1:pages';
    localStorage.setItem(storageKey, JSON.stringify([{ id: 'p1', title: 'Page 1', content: '', linkedChapterIds: [] }]));

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'Page 1' }));

    const quill = await screen.findByTestId('quill');
    fireEvent.change(quill, { target: { value: 'Updated draft text' } });

    expect(quill).toHaveValue('Updated draft text');

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      expect(saved[0]?.content).toBe('Updated draft text');
    });
  });

  it('manual save writes bundle', async () => {
    const dir = { name: 'Folder' } as any;
    (mockedLoadBookDirHandle as any).mockResolvedValue(dir);

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockedWriteBookBundle).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockedWriteOutlineBundle).toHaveBeenCalledTimes(1));
  });

  it('renders outline data with chapters from the folder bundle', async () => {
    const dir = { name: 'Folder' } as any;
    (mockedLoadBookDirHandle as any).mockResolvedValue(dir);
    (mockedReadOutlineBundle as any).mockResolvedValue({
      version: 2,
      chapters: [{ id: 'chapter-1', title: 'Chapter One' }],
      parts: [
        {
          id: 'part-1',
          title: 'Part I',
          description: 'Opening movement',
          status: 'in-progress',
          events: [
            {
              id: 'event-1',
              title: 'Opening incident',
              description: 'The story begins',
              status: 'todo',
              linkedChapterIds: ['chapter-1'],
            },
          ],
        },
      ],
    });

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'Outline' }));

    expect(await screen.findByDisplayValue('Part I')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Opening incident')).toBeInTheDocument();

    const chapterLibrary = document.querySelector('.chapter-library');
    expect(chapterLibrary).not.toBeNull();
    expect(within(chapterLibrary as HTMLElement).getByText('Chapter One')).toBeInTheDocument();

    const eventRow = (await screen.findByDisplayValue('Opening incident')).closest('.outline-event-row');
    expect(eventRow).not.toBeNull();
    expect(
      within(eventRow as HTMLElement).getByText('Chapter One', { selector: '.linked-chapter-chip' })
    ).toBeInTheDocument();
  });

  it('marks a part done when all its events are done', async () => {
    const dir = { name: 'Folder' } as any;
    (mockedLoadBookDirHandle as any).mockResolvedValue(dir);
    (mockedReadOutlineBundle as any).mockResolvedValue({
      version: 2,
      chapters: [],
      parts: [
        {
          id: 'part-1',
          title: 'Part I',
          description: '',
          status: 'in-progress',
          events: [
            {
              id: 'event-1',
              title: 'Event One',
              description: '',
              status: 'done',
              linkedChapterIds: [],
            },
          ],
        },
      ],
    });

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'Outline' }));

    expect(await screen.findByText('done')).toBeInTheDocument();
  });

  it('shows chapter options inside the chapter picker', async () => {
    const dir = { name: 'Folder' } as any;
    (mockedLoadBookDirHandle as any).mockResolvedValue(dir);
    (mockedReadOutlineBundle as any).mockResolvedValue({
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
    });

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'Outline' }));
    const chapterTriggerText = await screen.findByText('No chapters linked', {
      selector: '.chapter-trigger-text',
    });
    const chapterPicker = chapterTriggerText.closest('.chapter-picker');

    expect(chapterPicker).not.toBeNull();
    fireEvent.click(chapterTriggerText.closest('summary') as HTMLElement);

    expect(
      await within(chapterPicker as HTMLElement).findByRole('checkbox', { name: 'Chapter One' })
    ).toBeInTheDocument();
  });

  it('creates a chapter from the event chapter picker', async () => {
    const dir = { name: 'Folder' } as any;
    (mockedLoadBookDirHandle as any).mockResolvedValue(dir);
    (mockedReadOutlineBundle as any).mockResolvedValue({
      version: 2,
      chapters: [],
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
    });

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'Outline' }));
    const chapterTriggerText = await screen.findByText('No chapters linked', {
      selector: '.chapter-trigger-text',
    });
    const chapterPicker = chapterTriggerText.closest('.chapter-picker');

    expect(chapterPicker).not.toBeNull();
    fireEvent.click(chapterTriggerText.closest('summary') as HTMLElement);
    fireEvent.click(await within(chapterPicker as HTMLElement).findByRole('button', { name: '+ Add chapter' }));
    fireEvent.change(
      await within(chapterPicker as HTMLElement).findByPlaceholderText('New chapter title'),
      { target: { value: 'Chapter Two' } }
    );
    fireEvent.click(await within(chapterPicker as HTMLElement).findByRole('button', { name: 'Create chapter' }));

    expect(
      await within(chapterPicker as HTMLElement).findByRole('checkbox', { name: 'Chapter Two' })
    ).toBeChecked();

    const eventRow = (await screen.findByDisplayValue('Opening incident')).closest('.outline-event-row');
    expect(eventRow).not.toBeNull();
    expect(
      within(eventRow as HTMLElement).getByText('Chapter Two', { selector: '.linked-chapter-chip' })
    ).toBeInTheDocument();
  });

  it('links the active page to a chapter and shows part and event tags', async () => {
    const dir = { name: 'Folder' } as any;
    (mockedLoadBookDirHandle as any).mockResolvedValue(dir);
    (mockedReadBookBundle as any).mockResolvedValue({
      title: 'From Disk',
      author: 'Disk Author',
      pages: [{ id: 'disk-1', title: 'Scene One', content: 'Imported opening', linkedChapterIds: [] }],
    });
    (mockedReadOutlineBundle as any).mockResolvedValue({
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
              linkedChapterIds: ['chapter-1'],
            },
          ],
        },
      ],
    });

    renderWorkspace();

    expect(await screen.findByText('Scene One')).toBeInTheDocument();

    const pageLinkPanel = document.querySelector('.page-link-panel');
    expect(pageLinkPanel).not.toBeNull();

    fireEvent.click(within(pageLinkPanel as HTMLElement).getByText('Chapter tags'));
    fireEvent.click(within(pageLinkPanel as HTMLElement).getByRole('checkbox'));

    const pageLinkOption = document.querySelector('.page-link-option.is-linked');
    expect(pageLinkOption).not.toBeNull();
    expect(within(pageLinkOption as HTMLElement).getByText('Part I')).toBeInTheDocument();
    expect(within(pageLinkOption as HTMLElement).getByText('Opening incident')).toBeInTheDocument();

    expect(within(pageLinkPanel as HTMLElement).getByText('Chapter One', { selector: '.page-linked-chapter-tag' })).toBeInTheDocument();

    const pageList = document.querySelector('.page-list');
    expect(pageList).not.toBeNull();
    expect(within(pageList as HTMLElement).getByText('Chapter One')).toBeInTheDocument();
  });

  it('imports as a new page when user cancels replace', async () => {
    const dir = { name: 'Folder' } as any;
    (mockedLoadBookDirHandle as any).mockResolvedValue(dir);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { container } = renderWorkspace();

    await screen.findByRole('button', { name: 'Page 1' });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['Imported page body'], 'Chapter 9.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'text', { value: async () => 'Imported page body' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Chapter 9' })).toBeInTheDocument();

    confirmSpy.mockRestore();
  });
});