import { Schema, model } from 'mongoose';

const chapterSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  bookId: {
    type: Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
  },
  order: {
    type: Number,
    required: true,
  },
}, { timestamps: true });

const Chapter = model('Chapter', chapterSchema);

export default Chapter;