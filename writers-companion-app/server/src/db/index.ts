import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI || 'your_default_mongodb_uri';
const client = new MongoClient(uri);

let db: Db | null = null;

export const connectDB = async (): Promise<Db> => {
    if (!db) {
        await client.connect();
        db = client.db('writers_companion');
    }
    return db;
};

export const getDB = (): Db => {
    if (!db) {
        throw new Error('Database not initialized. Call connectDB first.');
    }
    return db;
};