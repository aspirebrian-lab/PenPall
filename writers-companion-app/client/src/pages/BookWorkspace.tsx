import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { getBookById, Book } from '../services/api';
import {
  loadBookDirHandle,
  pickDirectory,
  readBookBundle,
  saveBookDirHandle,
  writeBookBundle,
  SyncPage,
} from '../utils/fsAccess';

type Page = SyncPage;

const Layout = styled.div`
  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: 100vh;
  background: #f5f7fb;

  .workspace-sidebar {
    background: #111827;
    color: #e5e7eb;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: static;
  }

  .brand {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .nav button {
    background: transparent;
    color: #e5e7eb;
    text-align: left;
    padding: 8px 10px;
    border-radius: 6px;
  }

  .nav button.active {
    background: #1f2937;
  }

  .content {
    padding: 24px;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    gap: 16px;
  }

  .book-title {
    font-size: 20px;
    font-weight: 700;
  }

  .panel {
    background: #ffffff;
    border-radius: 10px;
    padding: 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }

  .page-list {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .page-pill {
    border: 1px solid #e5e7eb;
    padding: 6px 10px;
    border-radius: 999px;
    background: #f9fafb;
    color: #1f2937;
  }

  .page-pill.active {
    background: #e5f0ff;
    border-color: #a4c8ff;
  }

  .editor {
    min-height: 400px;
  }

  .back {
    color: #9ca3af;
    text-decoration: none;
    font-size: 13px;
  }

  .back-btn {
    background: #1f2937;
    color: #e5e7eb;
    border-radius: 6px;
    padding: 8px 10px;
    display: inline-block;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .status {
    font-size: 12px;
    color: #6b7280;
  }
`;

const defaultPages = (): Page[] => [
  { id: 'p1', title: 'Page 1', content: '' },
  { id: 'p2', title: 'Page 2', content: '' },
];

const BookWorkspace: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [book, setBook] = useState<Book | null>(null);
  const [activeView, setActiveView] = useState<'editor' | 'outline' | 'planning' | 'settings'>('editor');
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [pages, setPages] = useState<Page[]>([]);
  const [activePageId, setActivePageId] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const storageKey = `book:${id}:pages`;

  useEffect(() => {
    if (!id) return;
    getBookById(id).then(setBook).catch(() => setBook(null));
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const loadPages = async () => {
      try {
        const dir = await loadBookDirHandle(id);
        if (dir) {
          const bundle = await readBookBundle(dir);
          if (bundle.pages.length > 0) {
            if (!cancelled) {
              setPages(bundle.pages);
              setActivePageId(bundle.pages[0].id);
              localStorage.setItem(storageKey, JSON.stringify(bundle.pages));
            }
            return;
          }
        }
      } catch {
        // ignore and fall back
      }

      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const loaded: Page[] = JSON.parse(raw);
        if (!cancelled) {
          setPages(loaded);
          setActivePageId(loaded[0]?.id ?? '');
        }
        return;
      }

      const initial = defaultPages();
      if (!cancelled) {
        setPages(initial);
        setActivePageId(initial[0].id);
      }
      localStorage.setItem(storageKey, JSON.stringify(initial));
    };

    loadPages();

    return () => {
      cancelled = true;
    };
  }, [id, storageKey]);

  useEffect(() => {
    if (!id || !isDirty) return;

    const timer = window.setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(pages));
      setIsDirty(false);
      setSaveMessage('Autosaved locally');
      window.setTimeout(() => setSaveMessage(''), 1500);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [id, isDirty, pages, storageKey]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? pages[0],
    [pages, activePageId]
  );

  const persistLocal = (nextPages: Page[]) => {
    setPages(nextPages);
    localStorage.setItem(storageKey, JSON.stringify(nextPages));
  };

  const saveToFolder = async (nextPages: Page[]) => {
    if (!id) return;

    let dir = await loadBookDirHandle(id);
    if (!dir) {
      dir = await pickDirectory();
      await saveBookDirHandle(id, dir);
    }

    await writeBookBundle(
      dir,
      {
        title: book?.title ?? 'Untitled Book',
        author: book?.author ?? 'Unknown Author',
      },
      nextPages
    );
  };

  const updateActivePage = (content: string) => {
    const nextPages = pages.map((page) =>
      page.id === activePageId ? { ...page, content } : page
    );
    setPages(nextPages);
    setIsDirty(true);
  };

  const handleLeave = () => {
    if (!isDirty) return true;
    return window.confirm('You have unsaved changes. Leave anyway?');
  };

  const goBack = () => {
    if (handleLeave()) navigate('/');
  };

  const manualSave = async () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(pages));
      await saveToFolder(pages);
      setIsDirty(false);
      setSaveMessage('Saved to folder');
      window.setTimeout(() => setSaveMessage(''), 2000);
    } catch {
      setSaveMessage('Local save only');
      window.setTimeout(() => setSaveMessage(''), 2000);
    }
  };

  const handleImportPageClick = () => {
    importInputRef.current?.click();
  };

  const handleImportPage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const fileTitle = file.name.replace(/\.[^.]+$/, '') || `Page ${pages.length + 1}`;
      const replaceCurrent = window.confirm(
        'Press OK to replace the current page. Press Cancel to import as a new page.'
      );

      let nextPages: Page[];
      let nextActivePageId = activePageId;

      if (replaceCurrent && activePageId) {
        nextPages = pages.map((page) =>
          page.id === activePageId
            ? { ...page, title: fileTitle, content: text }
            : page
        );
      } else {
        const newPage: Page = {
          id: `p-${Date.now()}`,
          title: fileTitle,
          content: text,
        };
        nextPages = [...pages, newPage];
        nextActivePageId = newPage.id;
      }

      persistLocal(nextPages);
      setActivePageId(nextActivePageId);
      setIsDirty(false);

      try {
        await saveToFolder(nextPages);
        setSaveMessage('Page imported');
      } catch {
        setSaveMessage('Page imported locally');
      }

      window.setTimeout(() => setSaveMessage(''), 2000);
    } finally {
      event.target.value = '';
    }
  };

  return (
    <Layout>
      <aside className="workspace-sidebar">
        <div className="brand">Writer’s Companion</div>
        <button className="back-btn" onClick={goBack}>← Back to Dashboard</button>

        <div>
          <div style={{ fontWeight: 600 }}>{book?.title ?? 'Book'}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{book?.author ?? ''}</div>
        </div>

        <nav className="nav">
          <button className={activeView === 'editor' ? 'active' : ''} onClick={() => setActiveView('editor')}>
            Editor
          </button>
          <button className={activeView === 'outline' ? 'active' : ''} onClick={() => setActiveView('outline')}>
            Outline
          </button>
          <button className={activeView === 'planning' ? 'active' : ''} onClick={() => setActiveView('planning')}>
            Planning
          </button>
          <button className={activeView === 'settings' ? 'active' : ''} onClick={() => setActiveView('settings')}>
            Settings
          </button>
        </nav>
      </aside>

      <main className="content">
        <div className="topbar">
          <Link
            className="back"
            to="/"
            onClick={(event) => {
              if (!handleLeave()) event.preventDefault();
            }}
          >
            ← Back to Dashboard
          </Link>

          <div className="book-title">{book?.title ?? 'Book Workspace'}</div>

          <div className="actions">
            <span className="status">
              {isDirty ? 'Unsaved changes' : 'Ready'}
            </span>
            {saveMessage ? <span className="status">{saveMessage}</span> : null}
            <button onClick={manualSave}>Save</button>
            <button onClick={handleImportPageClick}>Import Page</button>
            <input
              ref={importInputRef}
              type="file"
              accept=".txt,.md,.rtf,text/plain,text/markdown"
              onChange={handleImportPage}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {activeView === 'editor' && (
          <div className="panel">
            <div className="page-list">
              {pages.map((page) => (
                <button
                  key={page.id}
                  className={`page-pill ${page.id === activePageId ? 'active' : ''}`}
                  onClick={() => {
                    if (handleLeave()) {
                      setActivePageId(page.id);
                    }
                  }}
                >
                  {page.title}
                </button>
              ))}
            </div>

            <ReactQuill
              key={activePageId}
              value={activePage?.content ?? ''}
              onChange={updateActivePage}
              className="editor"
              placeholder="Start writing this page..."
            />
          </div>
        )}

        {activeView === 'outline' && <div className="panel">Outline view (placeholder)</div>}
        {activeView === 'planning' && <div className="panel">Planning view (placeholder)</div>}
        {activeView === 'settings' && <div className="panel">Settings view (placeholder)</div>}
      </main>
    </Layout>
  );
};

export default BookWorkspace;