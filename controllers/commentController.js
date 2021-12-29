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