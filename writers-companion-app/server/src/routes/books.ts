import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import Book from '../models/Book';

const router = Router();

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

// Rate limiting (helps mitigate request flooding / expensive DB access)
const booksReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300, // adjust as needed
  standardHeaders: true,
  legacyHeaders: false,
});

const booksWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 60, // stricter for writes
  standardHeaders: true,
  legacyHeaders: false,
});

// ---- In-memory fallback (used when Mongo isn't connected) ----
type InMemoryBook = {
  _id: string;
  title: string;
  author: string;
  chapters: any[];
  createdAt: string;
  updatedAt: string;
};

const mem = {
  books: [] as InMemoryBook[],
};

const isMongoConnected = (): boolean => mongoose.connection.readyState === 1;

const newId = (): string => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
// -------------------------------------------------------------

// Create a new book
router.post('/', booksWriteLimiter, async (req: Request, res: Response) => {
  try {
    const { title, author } = req.body ?? {};
    if (!title || !author) {
      return res.status(400).json({ message: 'title and author are required' });
    }

    if (!isMongoConnected()) {
      const now = new Date().toISOString();
      const created: InMemoryBook = {
        _id: newId(),
        title,
        author,
        chapters: [],
        createdAt: now,
        updatedAt: now,
      };
      mem.books.unshift(created);
      return res.status(201).json(created);
    }

    const newBook = new Book(req.body);
    await newBook.save();
    return res.status(201).json(newBook);
  } catch (error: unknown) {
    return res.status(400).json({ message: getErrorMessage(error) });
  }
});

// Get all books
router.get('/', booksReadLimiter, async (_req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      return res.status(200).json(mem.books);
    }

    const books = await Book.find();
    return res.status(200).json(books);
  } catch (error: unknown) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
});

// Get a book by ID
router.get('/:id', booksReadLimiter, async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      const book = mem.books.find((b) => b._id === req.params.id);
      if (!book) return res.status(404).json({ message: 'Book not found' });
      return res.status(200).json(book);
    }

    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    return res.status(200).json(book);
  } catch (error: unknown) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
});

// Update a book by ID
router.put('/:id', booksWriteLimiter, async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      const idx = mem.books.findIndex((b) => b._id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'Book not found' });

      mem.books[idx] = {
        ...mem.books[idx],
        ...req.body,
        updatedAt: new Date().toISOString(),
      };
      return res.status(200).json(mem.books[idx]);
    }

    const id = req.params.id;
    if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid book id' });
    }

    const update = pickBookUpdate(req.body);
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No updatable fields provided' });
    }

    const updatedBook = await Book.findOneAndUpdate(
      { _id: { $eq: id } },
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!updatedBook) return res.status(404).json({ message: 'Book not found' });
    return res.status(200).json(updatedBook);
  } catch (error: unknown) {
    return res.status(400).json({ message: getErrorMessage(error) });
  }
});

// Delete a book by ID
router.delete('/:id', booksWriteLimiter, async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      const before = mem.books.length;
      mem.books = mem.books.filter((b) => b._id !== req.params.id);
      if (mem.books.length === before) return res.status(404).json({ message: 'Book not found' });
      return res.status(204).send();
    }

    const deletedBook = await Book.findByIdAndDelete(req.params.id);
    if (!deletedBook) return res.status(404).json({ message: 'Book not found' });
    return res.status(204).send();
  } catch (error: unknown) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
});

const pickBookUpdate = (body: unknown): Partial<{ title: string; author: string; chapters: unknown[] }> => {
  const src = (body && typeof body === 'object' ? (body as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;

  for (const key of Object.keys(src)) {
    if (key.startsWith('$') || key.includes('.')) {
      throw new Error(`Invalid update key: ${key}`);
    }
  }

  const update: Partial<{ title: string; author: string; chapters: unknown[] }> = {};

  if (typeof src.title === 'string') update.title = src.title;
  if (typeof src.author === 'string') update.author = src.author;
  if (Array.isArray(src.chapters)) update.chapters = src.chapters;

  return update;
};

export default router;