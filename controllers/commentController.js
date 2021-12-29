const async = require('async');
const { body, validationResult } = require('express-validator');
const Comment = require('../models/comment');
const Post = require('../models/post');
const User = require('../models/user');

exports.comment_create = [
    body('comment', 'Comment must not be empty').trim().isLength({min: 1}).escape(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.send({err: errors.array()});
        } else {
            if (req.fileValidationError) {
                return next(new Error(req.fileValidationError));
            } else {
                Post.findById(req.params.id).exec((err, thePost) => {
                    if (err)
                        return next(err);
                    if (!thePost) {
                        return next(new Error('No such post'));
                    } else {
                        const comment = new Comment({
                            user: req.user._id,
                            message: req.body.comment,
                            date: new Date,
                            belong: thePost._id
                        });
                        if (req.file)
                            comment.media = req.file.path;
                        async.parallel({
                            user: (callback) => {
                                const comment_arr = req.user.comments;
                                comment_arr.push(comment._id);
                                User.findByIdAndUpdate(req.user._id, 
                                    {comments: comment_arr}, {}, callback);
                            },
                            post: (callback) => {
                                const comment_arr = thePost.comments;
                                comment_arr.push(comment._id);
                                Post.findByIdAndUpdate(req.params.id, 
                                    {comments: comment_arr}, {}, callback);
                            },
                        }, (err) => {
                            if (err)
                                return next(err);
                            comment.save(err => {
                                if (err)
                                    return next(err);
                                res.send({success: 'comment added'});
                            });
                        });
                    }
                });
            }
        }
    }
]

exports.comment_get = (req, res, next) => {
    Comment.findById(req.params.id).populate('user')
    .populate('likes').populate('comments').exec((err, theComment) => {
        if (err)
            return next(err);
        if (!theComment) {
            return next(new Error('No such comment'));
        } else {
            const comment = theComment;
            comment.user = { _id: comment.user._id, username: comment.user.username };
            comment.likes = _filterInfo(comment.likes);
            res.send({comment});
        }
    });
}

exports.comment_update = [
    body('comment', 'Comment must not be empty').trim().isLength({min: 1}).escape(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.send({err: errors.array()});
        } else {
            if (req.fileValidationError) {
                return next(new Error(req.fileValidationError));
            } else {
                const updates = { message: req.body.comment };
                if (req.file)
                    updates.media = req.file.path;
                Comment.findByIdAndUpdate(req.params.id, updates, {}, (err, newComment) => {
                    if (err)
                        return next(err)
                    res.send({success: 'updated comment'});
                });
            }
        }
    }
]

exports.comment_delete = (req, res, next) => {
    Comment.findById(req.params.id).exec((err, theComment) => {
        if (err)
            return next(err);
        if (!theComment) {
            return next(new Error('No such Comment'));
        } else {
            if (!theComment.user._id.equals(req.user._id)) {
                return next(new Error('Not authorized to edit this comment'));
            } else {
                async.parallel({
                    post: (callback) => {
                        Post.findById(theComment.belong).exec((err, thePost) => {
                            if (err)
                                return next(err);
                            if (!thePost) {
                                return next(new Error('No such post'));
                            } else {
                                const comment_arr = thePost.comments;
                                comment_arr.splice(_getIndex(thePost.comments, req.params.id));
                                Post.findByIdAndUpdate(theComment.belong, 
                                    {comments: comment_arr}, {}, callback);
                            }
                        });
                    },
                    user: (callback) => {
                        const comment_arr = req.user.comments;
                        comment_arr.splice(_getIndex(req.user.comments, req.params.id));
                        User.findByIdAndUpdate(req.user._id, 
                            {comments: comment_arr}, {}, callback);
                    }
                }, (err, results) => {
                    if (err)
                        return next(err);
                    Comment.findByIdAndRemove(req.params.id, err => {
                        if (err)
                            return next(err);
                        res.send({success: 'Comment deleted'});
                    });
                })
            }
        }
    });
}

exports.comment_like = (req, res, next) => {
    Comment.findById(req.params.id).exec((err, theComment) => {
        if (err)
            return next(err);
        if(!theComment) {
            return next(new Error('No such comment'));
        } else {
            const like_arr = theComment.likes;
            if (_getIndex(like_arr, req.user._id) > -1) {
                return next(new Error('Already liked this comment'));
            } else {
                like_arr.push(req.user._id);
                Comment.findByIdAndUpdate(req.params.id, {likes: like_arr}, {}, (err, newComment) => {
                    if (err)
                        return next(err);
                    const myLikeC = req.user.liked_comment;
                    myLikeC.push(req.params.id);
                    User.findByIdAndUpdate(req.user._id, {liked_comment: myLikeC},
                        {}, (err, newUser) => {
                            if (err)
                                return next(err);
                            res.send({success: `${req.user.username} liked this post`});
                        });
                });
            }
        }
    });
}

exports.comment_unlike = (req, res, next) => {
    Comment.findById(req.params.id).exec((err, theComment) => {
        if (err)
            return next(err);
        if(!theComment) {
            return next(new Error('No such comment'));
        } else {
            const like_arr = theComment.likes;
            const like_index = _getIndex(like_arr, req.user._id); 
            if (like_index < -1) {
                return next(new Error('Did not like this comment'));
            } else {
                like_arr.splice(like_index, 1);
                Comment.findByIdAndUpdate(req.params.id, {likes: like_arr}, {}, (err, newComment) => {
                    if (err)
                        return next(err);
                    const myLikeC = req.user.liked_comment;
                    const myLike_index = _getIndex(myLikeC, req.params.id);
                    myLikeC.splice(myLike_index);
                    User.findByIdAndUpdate(req.user._id, {liked_comment: myLikeC},
                        {}, (err, newUser) => {
                            if (err)
                                return next(err);
                            res.send({success: `${req.user.username} unliked this post`});
                        });    
                });
            }
        }
    });

}


function _getIndex(arr, targetID) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i]._id.equals(targetID))
            return i;
    }
    return -1;
}

function _filterInfo(arr) {
    for (let i = 0; i < arr.length; i++) {
        arr[i] = {
            _id: arr[i]._id,
            username: arr[i].username,
        }
    }
    return arr;
}