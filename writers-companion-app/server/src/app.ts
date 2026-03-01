import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import booksRoutes from './routes/books';
import chatRoutes from './routes/chat';
import contextRoutes from './routes/context';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(
  cors({
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.options('*', cors());

app.use(bodyParser.json());

app.use('/api/books', booksRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/context', contextRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});