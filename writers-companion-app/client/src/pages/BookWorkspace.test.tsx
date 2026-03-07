import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookWorkspace from './BookWorkspace';
import { getBookById } from '../services/api';
import {
  loadBookDirHandle,
  pickDirectory,
  readBookBundle,
  saveBookDirHandle,
  writeBookBundle,
} from '../utils/fsAccess';

const mockedNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'book-1' }),
  useNavigate: () => mockedNavigate,
}));

jest.mock('../services/api', () => ({
  getBookById: jest.fn(),
}));

jest.mock('../utils/fsAccess', () => ({
  loadBookDirHandle: jest.fn(),
  pickDirectory: jest.fn(),
  readBookBundle: jest.fn(),
  saveBookDirHandle: jest.fn(),
  writeBookBundle: jest.fn(),
}));

jest.mock('react-quill', () => {
  return function MockReactQuill(props: {
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
  };
});

const mockedGetBookById = getBookById as jest.MockedFunction<typeof getBookById>;
const mockedLoadBookDirHandle = loadBookDirHandle as jest.MockedFunction<typeof loadBookDirHandle>;
const mockedPickDirectory = pickDirectory as jest.MockedFunction<typeof pickDirectory>;
const mockedReadBookBundle = readBookBundle as jest.MockedFunction<typeof readBookBundle>;
const mockedSaveBookDirHandle = saveBookDirHandle as jest.MockedFunction<typeof saveBookDirHandle>;
const mockedWriteBookBundle = writeBookBundle as jest.MockedFunction<typeof writeBookBundle>;

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
    jest.clearAllMocks();
    localStorage.clear();

    mockedGetBookById.mockResolvedValue({
      _id: 'book-1',
      title: 'Test Book',
      author: 'Test Author',
    });

    mockedLoadBookDirHandle.mockResolvedValue(null);
    mockedReadBookBundle.mockResolvedValue({ title: undefined, author: undefined, pages: [] });
    mockedPickDirectory.mockResolvedValue({ name: 'Folder' } as any);
    mockedSaveBookDirHandle.mockResolvedValue(undefined);
    mockedWriteBookBundle.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('prefers folder bundle pages when a folder handle exists', async () => {
    const dir = { name: 'Folder' } as any;
    mockedLoadBookDirHandle.mockResolvedValue(dir);
    mockedReadBookBundle.mockResolvedValue({
      title: 'From Disk',
      author: 'Disk Author',
      pages: [{ id: 'disk-1', title: 'Scene One', content: 'Imported opening' }],
    });

    renderWorkspace();

    expect(await screen.findByText('Scene One')).toBeInTheDocument();
    expect(screen.getByTestId('quill')).toHaveValue('Imported opening');
  });

  it('autosaves locally after editor changes', async () => {
    jest.useFakeTimers();

    const storageKey = 'book:book-1:pages';
    localStorage.setItem(
      storageKey,
      JSON.stringify([{ id: 'p1', title: 'Page 1', content: '' }])
    );

    renderWorkspace();

    // Ensure the active page ID is explicitly set in UI state.
    fireEvent.click(await screen.findByRole('button', { name: 'Page 1' }));

    const quill = await screen.findByTestId('quill');
    fireEvent.change(quill, { target: { value: 'Updated draft text' } });

    expect(quill).toHaveValue('Updated draft text');

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      expect(saved[0]?.content).toBe('Updated draft text');
    });
  });

  it('manual save writes bundle', async () => {
    const dir = { name: 'Folder' } as any;
    mockedLoadBookDirHandle.mockResolvedValue(dir);

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockedWriteBookBundle).toHaveBeenCalledTimes(1));
    expect(mockedWriteBookBundle).toHaveBeenCalledWith(
      dir,
      { title: 'Test Book', author: 'Test Author' },
      expect.any(Array)
    );
  });

  it('imports as a new page when user cancels replace', async () => {
    const dir = { name: 'Folder' } as any;
    mockedLoadBookDirHandle.mockResolvedValue(dir);

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    const { container } = renderWorkspace();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['Imported page body'], 'Chapter 9.txt', { type: 'text/plain' });

    // jsdom compatibility: File.text may be missing in some versions
    Object.defineProperty(file, 'text', {
      value: async () => 'Imported page body',
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(await screen.findByText('Chapter 9')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedWriteBookBundle).toHaveBeenCalledTimes(1);
      expect(mockedWriteBookBundle).toHaveBeenCalledWith(
        dir,
        expect.objectContaining({
          title: expect.any(String),
          author: expect.any(String),
        }),
        expect.arrayContaining([
          expect.objectContaining({ title: 'Chapter 9', content: 'Imported page body' }),
        ])
      );
    });

    confirmSpy.mockRestore();
  });

  it('warns on beforeunload when there are unsaved changes', async () => {
    renderWorkspace();

    const quill = await screen.findByTestId('quill');
    fireEvent.change(quill, { target: { value: 'Unsaved change' } });

    const event = new Event('beforeunload', { cancelable: true }) as Event & {
      returnValue: unknown;
    };
    event.returnValue = undefined;

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});