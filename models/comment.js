const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const commentSchema = new Schema({
    user: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    message: {type: String, required: true},
    date: {type: Date, required: true},
    belong: {type: Schema.Types.ObjectId, ref: 'Post', required: true},
    media: {type: String},
    likes: [{type: Schema.Types.ObjectId, ref: 'User'}],
    // comments: [{type: Schema.Types.ObjectId, ref: 'Comment'}],
});

module.exports = mongoose.model('Comment', commentSchema);