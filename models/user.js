const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    username: {type: String, required: true },
    email: {type: String, required: true},
    password: {type: String, required: true},
    first_name: {type: String, required: true},
    last_name: {type:String, required: true},
    date_join: {type: String, required: true},
    posts: [{type: Schema.Types.ObjectId, ref: 'Post'}],
    comments: [{type: Schema.Types.ObjectId, ref: 'Comment'}]
});

module.exports = mongoose.model('User', userSchema);