import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mongoose from 'mongoose';
import booksRoutes from './routes/books';
import chatRoutes from './routes/chat';
import contextRoutes from './routes/context';

const app = express();
const PORT = process.env.PORT || 5001;

const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL || '';

const corsOptions: cors.CorsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(bodyParser.json());

app.use('/api/books', booksRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/context', contextRoutes);

async function start() {
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri, {
        // Mongoose v5 options typing can be finicky under TS strict
        useNewUrlParser: true,
        useUnifiedTopology: true,
      } as any);
      console.log('MongoDB connected');
    } catch (e) {
      console.warn('MongoDB connection failed; continuing with in-memory books store.');
    }
  } else {
    console.warn('No MONGODB_URI/DATABASE_URL set; using in-memory books store.');
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

start();