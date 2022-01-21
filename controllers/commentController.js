const async = require('async');
const { body, validationResult } = require('express-validator');
const Comment = require('../models/comment');
const Post = require('../models/post');
const User = require('../models/user');

/**
 * api call that create comment
 * store the comment in user's and the post's array 
 * allow for images file
 * return success or error
 */
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

/**
 * api call that get the comment using the id in param of url
 * return the comment or error
 */
exports.comment_get = (req, res, next) => {
    Comment.findById(req.params.id).populate('user', 'username icon')
    .populate('likes', 'username icon').exec((err, theComment) => {
        if (err)
            return next(err);
        if (!theComment) {
            return next(new Error('No such comment'));
        } else {
            const comment = theComment;
            res.send({comment});
        }
    });
}

/**
 * api call that get all comments of that post
 * return array of comment or error
 */
exports.comment_get_list = (req, res, next) => {
    Post.findById(req.params.id).exec((err, thePost) => {
        if (err)
            return next(err);
        if (!thePost) {
            return next(new Error('No such post'));
        } else {
            async.map(thePost.comments, (comment, callback) => {
                Comment.findById(comment).populate('user', 'username icon')
                .populate('likes', 'username icon').populate('belong', 'user')
                .exec(callback);
            }, (err, results) => {
                if (err)
                    return next(err);
                results.sort((a, b) => {return b.date-a.date});
                res.send({comments: results});
            });
        }
    });
}

/**
 * api call that get likes of that comment
 * return array of object that contain the array of likes and 
 * whether the user that call this api has liked or not
 * or error
 */
exports.comment_get_likes = (req, res, next) => {
    Comment.findById(req.params.id).populate('likes', 'username icon').exec((err, theComment) => {
        if (err)
            return next(err);
        if (!theComment) {
            return next(new Error('No such comment'));
        } else {
            const status = _getIndex(theComment.likes, req.user._id) > -1;
            res.send({likes: theComment.likes, status});
        }
    })
}

/**
 * api call that get all comment created by user with the id in url
 * return the array of comment or error
 */
exports.get_user_comment = (req, res, next) => {
    User.findById(req.params.id).exec((err, theUser) => {
        if (err)
            return next(err);
        if (!theUser) {
            return next(new Error('No such user'));
        } else {
            if (_getIndex(theUser.follower, req.user._id) < 0 && 
                !theUser.equals(req.user._id) && theUser.private) {
                return next(new Error('Not following the user'));
            } else {
                async.map(theUser.comments, (comment, callback) => {
                    Comment.findById(comment._id).populate('user', 'username icon')
                    .populate('likes', 'username icon').populate('belong', 'user').exec(callback);   
                }, (err, results) => {
                    if (err)
                        return next(err);
                    results.sort((a, b) => {return b.date - a.date});
                    res.send({results});
                })
            }
        }
    });
}

/**
 * api call that get all liked comment of user with the id in url
 * return the array of comment or error
 */
exports.get_user_liked_comment = (req, res, next) => {
    User.findById(req.params.id).exec((err, theUser) => {
        if (err)
            return next(err);
        if (!theUser) {
            return next(new Error('No such user'));
        } else {
            if (_getIndex(theUser.follower, req.user._id) < 0 && 
                !theUser.equals(req.user._id) && theUser.private) {
                return next(new Error('Not following the user'));
            } else {
                async.map(theUser.liked_comment, (comment, callback) => {
                    Comment.findById(comment._id).populate('user', 'username icon')
                    .populate('likes', 'username icon').populate('belong', 'user').exec(callback);   
                }, (err, results) => {
                    if (err)
                        return next(err);
                    results.sort((a, b) => {return b.date - a.date});
                    res.send({results});
                })
            }
        }
    })
}

/**
 * api call that allow user to update the comment that are created by themselves
 * only user created it can edit it
 * return success or error
 */
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
                Comment.findById(req.params.id).exec((err, theComment) => {
                    if (err)
                        return next(err);
                    if (!theComment) {
                        return next(new Error('No such comment'));
                    } else {
                        const updates = { message: req.body.comment };
                        if (req.file) {
                            fs.unlink(theComment.media, err => {
                                if (err)
                                    console.log('fail delete media');
                                else
                                    console.log('media deleted');
                            })
                            updates.media = req.file.path;
                        }
                        Comment.findByIdAndUpdate(req.params.id, updates, {}, (err, newComment) => {
                            if (err)
                                return next(err)
                            res.send({success: 'updated comment'});
                        });
                    }
                })
            }
        }
    }
]

/**
 * api call that delete the comment
 * only user who created it or the post can delete the comment
 * return success or error
 */
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
                    },
                    liked: (callback) => {
                        async.map(theComment.likes, (liked_user, cb) => {
                            User.findById(liked_user).exec((err, theUser) => {
                                if (err)
                                    return next(err);
                                if (!theUser) {
                                    return next(new Error('No such user'));
                                } else {
                                    const liked_c_arr = theUser.liked_comment;
                                    liked_c_arr.splice(_getIndex(liked_c_arr, req.params.id));
                                    User.findByIdAndUpdate(liked_user, {liked_comment: liked_c_arr},
                                        {}, cb);
                                }
                            });
                        }, callback);
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

/**
 * api call that allow user like a comment
 * update comment's likes array that added the user's id
 * return success or error
 */
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
                            res.send({success: `${req.user.username} liked this comment`});
                        });
                });
            }
        }
    });
}

/**
 * api call that allow user unlike a comment
 * update comment's likes array that removed user's id
 * return success or error
 */
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

// Helper function that get the element's index in an array
function _getIndex(arr, targetID) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i]._id.equals(targetID))
            return i;
    }
    return -1;
}
