const mongoose = require('mongoose');
const Schema = mongoose.Schema;

//  mongoose model for user
const userSchema = new Schema({
    username: {type: String, required: true },
    email: {type: String, required: true},
    password: {type: String, required: true},
    first_name: {type: String, required: true},
    last_name: {type:String, required: true},
    date_join: {type: String, required: true},
    private: {type: Boolean, required: true},
    icon: {type: String, required: true},
    description: {type: String, required: true},
    following: [{type: Schema.Types.ObjectId, ref: 'User'}],
    follower: [{type: Schema.Types.ObjectId, ref: 'User'}],
    pending_following: [{type: Schema.Types.ObjectId, ref: 'User'}],
    pending_follower: [{type: Schema.Types.ObjectId, ref: 'User'}],
    posts: [{type: Schema.Types.ObjectId, ref: 'Post'}],
    comments: [{type: Schema.Types.ObjectId, ref: 'Comment'}],
    liked_post: [{type: Schema.Types.ObjectId, ref: 'Post'}],
    liked_comment: [{type: Schema.Types.ObjectId, ref: 'Comment'}],
});

module.exports = mongoose.model('User', userSchema);