import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import BookWorkspace from './BookWorkspace';
import { getBookById } from '../services/api';
import {
  loadBookDirHandle,
  pickDirectory,
  readBookBundle,
  saveBookDirHandle,
  writeBookBundle,
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
    (mockedReadBookBundle as any).mockResolvedValue({ title: undefined, author: undefined, pages: [] });
    (mockedPickDirectory as any).mockResolvedValue({ name: 'Folder' } as any);
    (mockedSaveBookDirHandle as any).mockResolvedValue(undefined);
    (mockedWriteBookBundle as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prefers folder bundle pages when a folder handle exists', async () => {
    const dir = { name: 'Folder' } as any;
    (mockedLoadBookDirHandle as any).mockResolvedValue(dir);
    (mockedReadBookBundle as any).mockResolvedValue({
      title: 'From Disk',
      author: 'Disk Author',
      pages: [{ id: 'disk-1', title: 'Scene One', content: 'Imported opening' }],
    });

    renderWorkspace();

    expect(await screen.findByText('Scene One')).toBeInTheDocument();
    expect(screen.getByTestId('quill')).toHaveValue('Imported opening');
  });

  it('autosaves locally after editor changes', async () => {
    vi.useFakeTimers();

    const storageKey = 'book:book-1:pages';
    localStorage.setItem(storageKey, JSON.stringify([{ id: 'p1', title: 'Page 1', content: '' }]));

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
  });

  it('imports as a new page when user cancels replace', async () => {
    const dir = { name: 'Folder' } as any;
    (mockedLoadBookDirHandle as any).mockResolvedValue(dir);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { container } = renderWorkspace();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['Imported page body'], 'Chapter 9.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'text', { value: async () => 'Imported page body' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(await screen.findByText('Chapter 9')).toBeInTheDocument();

    confirmSpy.mockRestore();
  });
});