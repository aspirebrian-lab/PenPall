import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { getBooks, createBook } from '../services/api';
import { Book } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { pickDirectory, saveBookDirHandle, readBookBundle } from '../utils/fsAccess';

const DashboardContainer = styled.div`
  min-height: 100vh;
  padding: 40px 24px 72px;
  background:
    radial-gradient(circle at top left, rgba(182, 201, 190, 0.24), transparent 30%),
    radial-gradient(circle at bottom right, rgba(214, 205, 188, 0.28), transparent 28%),
    linear-gradient(180deg, #f5f1ea 0%, #f1eee7 100%);
  color: #1f2933;

  .page-shell {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
    gap: 24px;
    align-items: start;
  }

  .hero,
  .library {
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(31, 41, 51, 0.08);
    border-radius: 28px;
    backdrop-filter: blur(12px);
    box-shadow: 0 16px 50px rgba(31, 41, 51, 0.08);
  }

  .hero {
    padding: 36px;
  }

  .library {
    padding: 28px;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 999px;
    background: rgba(31, 41, 51, 0.06);
    color: #52606d;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 18px;
  }

  .hero h1 {
    max-width: 12ch;
    margin: 0 0 16px;
    font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
    font-size: clamp(2.8rem, 6vw, 5.2rem);
    line-height: 0.95;
    letter-spacing: -0.04em;
    color: #18212b;
  }

  .lede {
    max-width: 38rem;
    margin: 0;
    color: #52606d;
    font-size: 1.05rem;
  }

  .hero-meta {
    margin: 24px 0 30px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .meta-pill {
    padding: 9px 14px;
    border-radius: 999px;
    border: 1px solid rgba(31, 41, 51, 0.08);
    background: rgba(255, 255, 255, 0.75);
    color: #3e4c59;
    font-size: 0.95rem;
  }

  .create-panel {
    padding: 22px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.78);
    border: 1px solid rgba(31, 41, 51, 0.08);
  }

  .create-panel h2 {
    margin: 0 0 8px;
    font-size: 1.15rem;
    color: #18212b;
  }

  .create-copy {
    margin: 0 0 18px;
    color: #616e7c;
    font-size: 0.96rem;
  }

  .error {
    margin-bottom: 14px;
    padding: 12px 14px;
    border-radius: 14px;
    background: #fff3f2;
    border: 1px solid #f3c3be;
    color: #8a2d23;
    font-size: 0.95rem;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }

  .input-label {
    display: block;
    font-size: 0.86rem;
    font-weight: 600;
    color: #3e4c59;
    margin-bottom: 8px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .primary-action,
  .secondary-action {
    min-height: 48px;
    padding: 0 18px;
    border-radius: 999px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .primary-action {
    background: #18212b;
    color: #ffffff;
    box-shadow: 0 10px 24px rgba(24, 33, 43, 0.18);
  }

  .primary-action:hover {
    background: #0f1720;
    transform: translateY(-1px);
  }

  .secondary-action {
    background: transparent;
    color: #18212b;
    border: 1px solid rgba(24, 33, 43, 0.14);
  }

  .secondary-action:hover {
    background: rgba(24, 33, 43, 0.04);
  }

  .library-header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  }

  .library-header h2 {
    margin: 0;
    font-size: 1.6rem;
    color: #18212b;
  }

  .book-count {
    color: #616e7c;
    font-size: 0.95rem;
  }

  .empty-state {
    padding: 26px;
    border-radius: 20px;
    border: 1px dashed rgba(31, 41, 51, 0.18);
    background: rgba(250, 248, 244, 0.85);
  }

  .empty-state h3 {
    margin: 0 0 10px;
    color: #18212b;
    font-size: 1.1rem;
  }

  .empty-state p {
    margin: 0;
    color: #616e7c;
  }

  .book-grid {
    display: grid;
    gap: 14px;
  }

  .book-card {
    width: 100%;
    padding: 18px 18px 20px;
    text-align: left;
    border-radius: 20px;
    border: 1px solid rgba(31, 41, 51, 0.08);
    background: rgba(255, 255, 255, 0.84);
    box-shadow: 0 10px 28px rgba(31, 41, 51, 0.06);
    transition:
      transform 0.18s ease,
      border-color 0.18s ease,
      box-shadow 0.18s ease;
  }

  .book-card:hover {
    transform: translateY(-2px);
    border-color: rgba(24, 33, 43, 0.18);
    box-shadow: 0 16px 32px rgba(31, 41, 51, 0.1);
  }

  .book-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }

  .book-badge {
    padding: 6px 10px;
    border-radius: 999px;
    background: #f3efe8;
    color: #5d4630;
    font-size: 0.74rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .book-arrow {
    color: #7b8794;
    font-size: 1rem;
  }

  .book-card h3 {
    margin: 0 0 8px;
    font-size: 1.15rem;
    color: #18212b;
  }

  .book-card p {
    margin: 0;
    color: #616e7c;
  }

  @media (max-width: 960px) {
    .page-shell {
      grid-template-columns: 1fr;
    }

    .hero h1 {
      max-width: 100%;
    }
  }

  @media (max-width: 640px) {
    padding: 24px 16px 48px;

    .hero,
    .library {
      padding: 22px;
      border-radius: 22px;
    }

    .create-panel {
      padding: 18px;
      border-radius: 18px;
    }

    .field-grid {
      grid-template-columns: 1fr;
    }

    .actions {
      flex-direction: column;
    }

    .primary-action,
    .secondary-action {
      width: 100%;
    }

    .library-header {
      align-items: start;
      flex-direction: column;
    }
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
    setError('');

    let dir: FileSystemDirectoryHandle;
    let bundle: { title?: string; author?: string; pages: any[] };

    try {
      dir = await pickDirectory();
      bundle = await readBookBundle(dir);
    } catch {
      setError('Failed to open the selected folder.');
      return;
    }

    try {
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
      setError('Failed to create book (server error).');
    }
  };

  return (
    <DashboardContainer>
      <div className="page-shell">
        <section className="hero">
          <div className="eyebrow">Writer&apos;s Companion</div>
          <h1>Write with focus. Organize without friction.</h1>
          <p className="lede">
            Start a new manuscript, reconnect an existing draft folder, and keep every project
            ready to pick up where you left off.
          </p>

          <div className="hero-meta">
            <div className="meta-pill">Create new projects fast</div>
            <div className="meta-pill">Reconnect local draft folders</div>
            <div className="meta-pill">Jump back into any book</div>
          </div>

          <div className="create-panel">
            <h2>Create New Book</h2>
            <p className="create-copy">
              Begin a fresh project with a title and author, or connect an existing folder.
            </p>

            {error ? <div className="error">{error}</div> : null}

            <div className="field-grid">
              <label>
                <span className="input-label">Title</span>
                <input
                  type="text"
                  placeholder="Book Title"
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                />
              </label>

              <label>
                <span className="input-label">Author</span>
                <input
                  type="text"
                  placeholder="Author"
                  value={newBookAuthor}
                  onChange={(e) => setNewBookAuthor(e.target.value)}
                />
              </label>
            </div>

            <div className="actions">
              <button className="primary-action" onClick={handleCreateBook}>
                Create Book
              </button>
              <button className="secondary-action" onClick={handleConnectFolder}>
                Connect Folder
              </button>
            </div>
          </div>
        </section>

        <section className="library">
          <div className="library-header">
            <h2>Your Books</h2>
            <div className="book-count">
              {books.length} {books.length === 1 ? 'project' : 'projects'}
            </div>
          </div>

          {books.length === 0 ? (
            <div className="empty-state">
              <h3>No books yet</h3>
              <p>Create your first book or connect a folder to import an existing draft.</p>
            </div>
          ) : (
            <div className="book-grid">
              {books.map((book) => (
                <button
                  key={book._id}
                  className="book-card"
                  onClick={() => book._id && navigate(`/books/${book._id}`)}
                >
                  <div className="book-card-top">
                    <span className="book-badge">Draft</span>
                    <span className="book-arrow">Open</span>
                  </div>
                  <h3>{book.title}</h3>
                  <p>By {book.author}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardContainer>
  );
};

export default Dashboard;