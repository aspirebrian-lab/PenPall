import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import { createBook, getBooks } from '../services/api';
import { pickDirectory, readBookBundle, saveBookDirHandle } from '../utils/fsAccess';

const mockedNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockedNavigate,
}));

jest.mock('../services/api', () => ({
  getBooks: jest.fn(),
  createBook: jest.fn(),
}));

jest.mock('../utils/fsAccess', () => ({
  pickDirectory: jest.fn(),
  saveBookDirHandle: jest.fn(),
  readBookBundle: jest.fn(),
}));

const mockedGetBooks = getBooks as jest.MockedFunction<typeof getBooks>;
const mockedCreateBook = createBook as jest.MockedFunction<typeof createBook>;
const mockedPickDirectory = pickDirectory as jest.MockedFunction<typeof pickDirectory>;
const mockedReadBookBundle = readBookBundle as jest.MockedFunction<typeof readBookBundle>;
const mockedSaveBookDirHandle = saveBookDirHandle as jest.MockedFunction<typeof saveBookDirHandle>;

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetBooks.mockResolvedValue([]);
  });

  it('shows validation error when required fields are missing', async () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByRole('button', { name: 'Create Book' }));

    expect(
      await screen.findByText('Please enter both a book title and author.')
    ).toBeInTheDocument();
  });

  it('creates a book and navigates to workspace', async () => {
    mockedCreateBook.mockResolvedValue({
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
    mockedPickDirectory.mockResolvedValue(dir);
    mockedReadBookBundle.mockResolvedValue({ title: undefined, author: undefined, pages: [] });
    mockedCreateBook.mockResolvedValue({
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