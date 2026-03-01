import { Schema, model } from 'mongoose';

const bookSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    author: {
        type: String,
        required: true,
    },
    chapters: [{
        type: Schema.Types.ObjectId,
        ref: 'Chapter',
    }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

bookSchema.pre('save', function(next) {
    this.set('updatedAt', new Date());
    next();
});

const Book = model('Book', bookSchema);

export default Book;