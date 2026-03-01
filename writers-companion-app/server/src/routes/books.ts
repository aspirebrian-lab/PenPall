import { Router, Request, Response } from 'express';
import Book from '../models/Book';

const router = Router();

const getErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Unknown error';

// Create a new book
router.post('/', async (req: Request, res: Response) => {
    try {
        const newBook = new Book(req.body);
        await newBook.save();
        res.status(201).json(newBook);
    } catch (error: unknown) {
        res.status(400).json({ message: getErrorMessage(error) });
    }
});

// Get all books
router.get('/', async (_req: Request, res: Response) => {
    try {
        const books = await Book.find();
        res.status(200).json(books);
    } catch (error: unknown) {
        res.status(500).json({ message: getErrorMessage(error) });
    }
});

// Get a book by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        res.status(200).json(book);
    } catch (error: unknown) {
        res.status(500).json({ message: getErrorMessage(error) });
    }
});

// Update a book by ID
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const updatedBook = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedBook) {
            return res.status(404).json({ message: 'Book not found' });
        }
        res.status(200).json(updatedBook);
    } catch (error: unknown) {
        res.status(400).json({ message: getErrorMessage(error) });
    }
});

// Delete a book by ID
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const deletedBook = await Book.findByIdAndDelete(req.params.id);
        if (!deletedBook) {
            return res.status(404).json({ message: 'Book not found' });
        }
        res.status(204).send();
    } catch (error: unknown) {
        res.status(500).json({ message: getErrorMessage(error) });
    }
});

export default router;