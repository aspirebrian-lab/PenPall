import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
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
  min-height: 100vh;
  padding: 40px 24px 72px;
  background:
    radial-gradient(circle at top left, rgba(182, 201, 190, 0.24), transparent 30%),
    radial-gradient(circle at bottom right, rgba(214, 205, 188, 0.28), transparent 28%),
    linear-gradient(180deg, #f5f1ea 0%, #f1eee7 100%);
  color: #1f2933;

  .page-shell {
    max-width: 1280px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }

  .workspace-sidebar,
  .workspace-header,
  .panel {
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(31, 41, 51, 0.08);
    border-radius: 28px;
    backdrop-filter: blur(12px);
    box-shadow: 0 16px 50px rgba(31, 41, 51, 0.08);
  }

  .workspace-sidebar {
    padding: 28px;
    color: #1f2933;
    display: flex;
    flex-direction: column;
    gap: 18px;
    position: sticky;
    top: 24px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    padding: 7px 12px;
    border-radius: 999px;
    background: rgba(31, 41, 51, 0.06);
    color: #52606d;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .book-meta {
    padding: 18px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.78);
    border: 1px solid rgba(31, 41, 51, 0.08);
  }

  .book-meta-title {
    margin: 0 0 4px;
    font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
    font-size: 1.5rem;
    line-height: 1.05;
    color: #18212b;
  }

  .book-meta-author {
    color: #616e7c;
    font-size: 0.95rem;
  }

  .nav {
    display: grid;
    gap: 10px;
  }

  .nav button {
    min-height: 48px;
    padding: 0 16px;
    border-radius: 999px;
    text-align: left;
    background: rgba(255, 255, 255, 0.8);
    color: #3e4c59;
    border: 1px solid rgba(31, 41, 51, 0.08);
    font-weight: 600;
  }

  .nav button.active {
    background: #18212b;
    color: #ffffff;
    border-color: #18212b;
    box-shadow: 0 10px 24px rgba(24, 33, 43, 0.18);
  }

  .nav button:not(.active):hover {
    background: rgba(24, 33, 43, 0.04);
    border-color: rgba(24, 33, 43, 0.14);
    color: #18212b;
    transform: translateY(-1px);
  }

  .nav button.active:hover {
    background: #0f1720;
    transform: translateY(-1px);
  }

  .content {
    padding: 0;
    display: grid;
    gap: 18px;
  }

  .workspace-header {
    padding: 24px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
  }

  .header-copy {
    min-width: 0;
  }

  .back {
    display: inline-block;
    margin-bottom: 10px;
    color: #7b8794;
    font-size: 0.95rem;
  }

  .book-title {
    margin: 0;
    font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
    font-size: clamp(2rem, 4vw, 3.2rem);
    line-height: 0.98;
    letter-spacing: -0.04em;
    color: #18212b;
  }

  .workspace-subtitle {
    margin-top: 8px;
    color: #616e7c;
    font-size: 1rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
  }

  .status {
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(31, 41, 51, 0.06);
    color: #52606d;
    font-size: 0.9rem;
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

  .panel {
    padding: 24px;
  }

  .page-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 18px;
  }

  .page-pill {
    padding: 10px 14px;
    border-radius: 999px;
    border: 1px solid rgba(31, 41, 51, 0.08);
    background: rgba(255, 255, 255, 0.78);
    color: #3e4c59;
    font-weight: 600;
  }

  .page-pill:hover {
    background: rgba(255, 255, 255, 0.96);
    border-color: rgba(24, 33, 43, 0.14);
    transform: translateY(-1px);
    box-shadow: 0 10px 20px rgba(31, 41, 51, 0.08);
  }

  .page-pill.active {
    background: #f3efe8;
    border-color: rgba(93, 70, 48, 0.18);
    color: #5d4630;
  }

  .page-pill.active:hover {
    background: #f3efe8;
    border-color: rgba(93, 70, 48, 0.24);
    color: #5d4630;
  }

  .editor {
    min-height: 520px;
  }

  .editor .ql-toolbar {
    border: 1px solid rgba(31, 41, 51, 0.08);
    border-radius: 18px 18px 0 0;
    background: rgba(250, 248, 244, 0.92);
  }

  .editor .ql-container {
    border: 1px solid rgba(31, 41, 51, 0.08);
    border-top: 0;
    border-radius: 0 0 22px 22px;
    background: rgba(255, 255, 255, 0.92);
    min-height: 460px;
    font-size: 1rem;
    color: #1f2933;
  }

  .editor .ql-editor {
    min-height: 460px;
    padding: 24px 24px 32px;
    line-height: 1.8;
  }

  .editor .ql-editor.ql-blank::before {
    color: #8a94a0;
    font-style: normal;
  }

  @media (max-width: 1040px) {
    .page-shell {
      grid-template-columns: 1fr;
    }

    .workspace-sidebar {
      position: static;
    }

    .workspace-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .actions {
      justify-content: flex-start;
    }
  }

  @media (max-width: 640px) {
    padding: 24px 16px 48px;

    .workspace-sidebar,
    .workspace-header,
    .panel {
      border-radius: 22px;
      padding: 22px;
    }

    .actions {
      width: 100%;
    }

    .primary-action,
    .secondary-action {
      width: 100%;
    }
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
      <div className="page-shell">
        <aside className="workspace-sidebar">
          <div className="brand">Writer's Companion</div>
          <button className="secondary-action" onClick={goBack}>
            Back to Dashboard
          </button>

          <div className="book-meta">
            <h1 className="book-meta-title">{book?.title ?? 'Book'}</h1>
            <div className="book-meta-author">{book?.author ?? 'Unknown author'}</div>
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
          <div className="workspace-header">
            <div className="header-copy">
              <Link className="back" to="/" onClick={handleLeave}>
                Back to Dashboard
              </Link>
              <div className="book-title">{book?.title ?? 'Book Workspace'}</div>
              <div className="workspace-subtitle">
                Draft, revise, and manage pages in one place.
              </div>
            </div>

            <div className="actions">
              <span className="status">{isDirty ? 'Unsaved changes' : 'Ready'}</span>
              {saveMessage ? <span className="status">{saveMessage}</span> : null}
              <button className="primary-action" onClick={manualSave}>Save</button>
              <button className="secondary-action" onClick={handleImportPageClick}>Import Page</button>
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
      </div>
    </Layout>
  );
};

export default BookWorkspace;