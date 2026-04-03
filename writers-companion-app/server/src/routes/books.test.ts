import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import router from './books';
import Book from '../models/Book';

type MockBookModel = jest.Mock & {
  find: jest.Mock;
  findById: jest.Mock;
  findOneAndUpdate: jest.Mock;
  findByIdAndDelete: jest.Mock;
};

const mockSave = jest.fn();

jest.mock('../models/Book', () => {
  const BookConstructor = jest.fn().mockImplementation((data: Record<string, unknown>) => ({
    ...data,
    save: mockSave,
  })) as MockBookModel;

  BookConstructor.find = jest.fn();
  BookConstructor.findById = jest.fn();
  BookConstructor.findOneAndUpdate = jest.fn();
  BookConstructor.findByIdAndDelete = jest.fn();

  return {
    __esModule: true,
    default: BookConstructor,
  };
});

const MockBook = Book as unknown as MockBookModel;

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/books', router);
  return app;
};

const setMongoReadyState = (state: number) => {
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    value: state,
  });
};

describe('books routes', () => {
  let isValidSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    setMongoReadyState(0);
    isValidSpy = jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);
  });

  afterEach(() => {
    isValidSpy.mockRestore();
  });

  it('creates an in-memory book when mongo is disconnected', async () => {
    const response = await request(buildApp()).post('/api/books').send({
      title: 'Test Book',
      author: 'Test Author',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      title: 'Test Book',
      author: 'Test Author',
      chapters: [],
    });
  });

  it('creates a persistent book from only title and author', async () => {
    setMongoReadyState(1);

    const response = await request(buildApp()).post('/api/books').send({
      title: '  Test Book  ',
      author: '  Test Author  ',
      chapters: ['chapter-1'],
      role: 'admin',
    });

    expect(MockBook).toHaveBeenCalledWith({
      title: 'Test Book',
      author: 'Test Author',
    });
    expect(mockSave).toHaveBeenCalled();
    expect(response.status).toBe(201);
  });

  it('rejects create when title is missing', async () => {
    const response = await request(buildApp()).post('/api/books').send({
      author: 'Test Author',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'title and author are required' });
  });

  it('rejects create when author is missing', async () => {
    const response = await request(buildApp()).post('/api/books').send({
      title: 'Test Book',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'title and author are required' });
  });

  it('rejects update when the id is invalid', async () => {
    setMongoReadyState(1);
    isValidSpy.mockReturnValue(false);

    const response = await request(buildApp()).put('/api/books/not-an-id').send({
      title: 'Updated Title',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid book id' });
  });

  it('rejects empty updates', async () => {
    setMongoReadyState(1);

    const response = await request(buildApp())
      .put('/api/books/507f191e810c19729de860ea')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'No updatable fields provided' });
  });

  it('returns not found for in-memory updates when the book does not exist', async () => {
    const response = await request(buildApp()).put('/api/books/book-1').send({
      title: 'Updated Title',
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Book not found' });
  });

  it('rejects operator update keys', async () => {
    setMongoReadyState(1);

    const response = await request(buildApp())
      .put('/api/books/507f191e810c19729de860ea')
      .send({
        $set: { title: 'Oops' },
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid update key: $set' });
  });

  it('lists in-memory books when mongo is disconnected', async () => {
    const createResponse = await request(buildApp()).post('/api/books').send({
      title: 'Listable Book',
      author: 'List Author',
    });

    expect(createResponse.status).toBe(201);

    const response = await request(buildApp()).get('/api/books');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: createResponse.body._id,
          title: 'Listable Book',
          author: 'List Author',
        }),
      ])
    );
  });

  it('returns an in-memory book by id when mongo is disconnected', async () => {
    const createResponse = await request(buildApp()).post('/api/books').send({
      title: 'Lookup Book',
      author: 'Lookup Author',
    });

    const response = await request(buildApp()).get(`/api/books/${createResponse.body._id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      _id: createResponse.body._id,
      title: 'Lookup Book',
      author: 'Lookup Author',
    });
  });

  it('updates an existing in-memory book when mongo is disconnected', async () => {
    const createResponse = await request(buildApp()).post('/api/books').send({
      title: 'Original Title',
      author: 'Original Author',
    });

    const response = await request(buildApp())
      .put(`/api/books/${createResponse.body._id}`)
      .send({
        title: 'Updated Title',
        author: 'Updated Author',
        chapters: ['chapter-1'],
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      _id: createResponse.body._id,
      title: 'Updated Title',
      author: 'Updated Author',
      chapters: ['chapter-1'],
    });
  });

  it('deletes an existing in-memory book when mongo is disconnected', async () => {
    const createResponse = await request(buildApp()).post('/api/books').send({
      title: 'Delete Me',
      author: 'Delete Author',
    });

    const deleteResponse = await request(buildApp()).delete(`/api/books/${createResponse.body._id}`);
    expect(deleteResponse.status).toBe(204);

    const getResponse = await request(buildApp()).get(`/api/books/${createResponse.body._id}`);
    expect(getResponse.status).toBe(404);
    expect(getResponse.body).toEqual({ message: 'Book not found' });
  });
});