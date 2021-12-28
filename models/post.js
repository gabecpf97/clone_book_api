const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const postSchema = new Schema({
    user: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    message: {type: String, required: true},
    media: [{type: String}],
    date: {type: Date, required: true},
    likes: [{type: Schema.Types.ObjectId, ref: 'User'}],
    comments: {type: Schema.Types.ObjectId, ref: 'Comment'},
});

module.exports = mongoose.model('Post'. postSchema);