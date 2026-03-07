import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { getBooks, createBook } from '../services/api';
import { Book } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { pickDirectory, saveBookDirHandle, readBookBundle } from '../utils/fsAccess';

const DashboardContainer = styled.div`
  .container {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
  }

  .book-card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    width: 300px;
    cursor: pointer;
  }

  .book-card h3 {
    margin-bottom: 10px;
  }

  .create-book {
    margin-bottom: 20px;
  }

  .error {
    color: #b00020;
    margin: 10px 0;
  }

  .actions {
    margin-top: 12px;
    display: flex;
    gap: 8px;
  }
`;

const Dashboard: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      setError('');
      const data = await getBooks();
      setBooks(data);
    } catch {
      setError('Failed to load books (server error).');
    }
  };

  const handleCreateBook = async () => {
    try {
      setError('');
      if (!newBookTitle.trim() || !newBookAuthor.trim()) {
        setError('Please enter both a book title and author.');
        return;
      }

      const created = await createBook({
        title: newBookTitle.trim(),
        author: newBookAuthor.trim(),
      });

      setNewBookTitle('');
      setNewBookAuthor('');
      await fetchBooks();

      if (created._id) {
        navigate(`/books/${created._id}`);
      }
    } catch {
      setError('Failed to create book (server rejected request).');
    }
  };

  const handleConnectFolder = async () => {
    try {
      setError('');

      const dir = await pickDirectory();
      const bundle = await readBookBundle(dir);

      const created = await createBook({
        title: bundle.title?.trim() || dir.name || 'Untitled Book',
        author: bundle.author?.trim() || 'Local Folder',
      });

      if (!created._id) {
        setError('Book was created but no id was returned.');
        return;
      }

      await saveBookDirHandle(created._id, dir);
      await fetchBooks();
      navigate(`/books/${created._id}`);
    } catch {
      setError('Failed to open the selected folder.');
    }
  };

  return (
    <DashboardContainer>
      <div className="container">
        <div className="create-book">
          <h2>Create New Book</h2>
          {error ? <div className="error">{error}</div> : null}

          <input
            type="text"
            placeholder="Book Title"
            value={newBookTitle}
            onChange={(e) => setNewBookTitle(e.target.value)}
          />
          <input
            type="text"
            placeholder="Author"
            value={newBookAuthor}
            onChange={(e) => setNewBookAuthor(e.target.value)}
          />
          <button onClick={handleCreateBook}>Create Book</button>

          <div className="actions">
            <button onClick={handleConnectFolder}>Connect Folder</button>
          </div>
        </div>

        <h2>Your Books</h2>
        {books.map((book) => (
          <div
            key={book._id}
            className="book-card"
            onClick={() => book._id && navigate(`/books/${book._id}`)}
          >
            <h3>{book.title}</h3>
            <p>By {book.author}</p>
          </div>
        ))}
      </div>
    </DashboardContainer>
  );
};

export default Dashboard;