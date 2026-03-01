import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001';

export type Chapter = {
  _id?: string;
  title: string;
  content: string;
};

export type Book = {
  _id?: string;
  title: string;
  author: string;
  chapters?: Chapter[];
  createdAt?: string;
  updatedAt?: string;
};

export type AIResponse = {
  suggestion?: string;
  suggestions?: string[];
  message?: string;
  feedback?: string;
};

export const createBook = async (bookData: Book): Promise<Book> => {
  const response = await axios.post<Book>(`${API_BASE_URL}/api/books`, bookData);
  return response.data;
};

export const getBooks = async (): Promise<Book[]> => {
  const response = await axios.get<Book[]>(`${API_BASE_URL}/api/books`);
  return response.data;
};

export const getBookById = async (id: string): Promise<Book> => {
  const response = await axios.get<Book>(`${API_BASE_URL}/api/books/${id}`);
  return response.data;
};

export const updateBook = async (id: string, bookData: Partial<Book>): Promise<Book> => {
  const response = await axios.put<Book>(`${API_BASE_URL}/api/books/${id}`, bookData);
  return response.data;
};

export const deleteBook = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/api/books/${id}`);
};

export const getAISuggestions = async (
  userInput: string,
  storyContext?: unknown
): Promise<AIResponse> => {
  const response = await axios.post<AIResponse>(`${API_BASE_URL}/api/chat/suggestions`, {
    userInput,
    storyContext,
  });
  return response.data;
};