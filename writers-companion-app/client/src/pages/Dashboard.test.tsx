import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Dashboard from './Dashboard';
import { createBook, getBooks } from '../services/api';
import { pickDirectory, readBookBundle, saveBookDirHandle } from '../utils/fsAccess';

const mockedNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

vi.mock('../services/api', () => ({
  getBooks: vi.fn(),
  createBook: vi.fn(),
}));

vi.mock('../utils/fsAccess', () => ({
  pickDirectory: vi.fn(),
  saveBookDirHandle: vi.fn(),
  readBookBundle: vi.fn(),
}));

const mockedGetBooks = getBooks as unknown as ReturnType<typeof vi.fn>;
const mockedCreateBook = createBook as unknown as ReturnType<typeof vi.fn>;
const mockedPickDirectory = pickDirectory as unknown as ReturnType<typeof vi.fn>;
const mockedReadBookBundle = readBookBundle as unknown as ReturnType<typeof vi.fn>;
const mockedSaveBookDirHandle = saveBookDirHandle as unknown as ReturnType<typeof vi.fn>;

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockedGetBooks as any).mockResolvedValue([]);
  });

  it('shows validation error when required fields are missing', async () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByRole('button', { name: 'Create Book' }));

    expect(await screen.findByText('Please enter both a book title and author.')).toBeInTheDocument();
  });

  it('creates a book and navigates to workspace', async () => {
    (mockedCreateBook as any).mockResolvedValue({
      _id: 'book-123',
      title: 'My Novel',
      author: 'A. Writer',
    });

    render(<Dashboard />);

    fireEvent.change(screen.getByPlaceholderText('Book Title'), {
      target: { value: '  My Novel  ' },
    });
    fireEvent.change(screen.getByPlaceholderText('Author'), {
      target: { value: '  A. Writer  ' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Book' }));

    await waitFor(() =>
      expect(mockedCreateBook).toHaveBeenCalledWith({
        title: 'My Novel',
        author: 'A. Writer',
      })
    );

    await waitFor(() => expect(mockedNavigate).toHaveBeenCalledWith('/books/book-123'));
  });

  it('connects folder, creates book from folder metadata, and saves handle', async () => {
    const dir = { name: 'DraftFolder' } as any;
    (mockedPickDirectory as any).mockResolvedValue(dir);
    (mockedReadBookBundle as any).mockResolvedValue({ title: undefined, author: undefined, pages: [] });
    (mockedCreateBook as any).mockResolvedValue({
      _id: 'book-456',
      title: 'DraftFolder',
      author: 'Local Folder',
    });

    render(<Dashboard />);

    fireEvent.click(screen.getByRole('button', { name: 'Connect Folder' }));

    await waitFor(() => expect(mockedPickDirectory).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockedCreateBook).toHaveBeenCalledWith({
        title: 'DraftFolder',
        author: 'Local Folder',
      })
    );
    await waitFor(() => expect(mockedSaveBookDirHandle).toHaveBeenCalledWith('book-456', dir));
    await waitFor(() => expect(mockedNavigate).toHaveBeenCalledWith('/books/book-456'));
  });
});