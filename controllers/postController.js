const async = require('async');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const User = require('../models/user');
const Post = require('../models/post');

exports.post_create = [
    body('message', 'Please do not post empty message').trim().isLength({min: 1}).escape(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.send({err: errors.array()});
        } else {
            if (req.fileValidationError) {
                return next(new Error(req.fileValidationError));
            } else {
                const post = new Post({
                    user: req.user._id,
                    message: req.body.message,
                    date: new Date,
                });
                if (req.file) {
                    post.media = req.file.path;
                }
                post.save(err => {
                    if (err)
                    return next(err);
                    const post_array = req.user.posts;
                    post_array.push(post._id);
                    User.findByIdAndUpdate(req.user._id, 
                        {posts: post_array}, {}, (err, theUser) => {
                            if (err)
                                return next(err);
                            res.send({post});
                    });
                });
            }
        }
    }
]

exports.post_get = (req, res, next) => {
    Post.findById(req.params.id).populate('user', 'username icon')
    .populate('likes', 'username icon').populate('comments', 'username icon').exec((err, thePost) => {
        if (err)
            return next(err);
        if (!thePost) {
            return next(new Error('No such post'));
        } else {
            const post = thePost;
            res.send({post});
        }
    });
}

exports.post_get_timeline = (req, res, next) => {
    async.map(req.user.following, (user, callback) => {
        User.findById(user._id).populate('posts').exec((err, theUser) => {
            if (err)
                return callback(err);
            callback(null, theUser.posts);
        });
    }, (err, results) => {
        if (err)
            return next(err);
        const all_posts = [];
        results.forEach(post_arr => {
            post_arr.forEach(post => {
                all_posts.push(post);
            })
        })
        // res.send({all_posts});
        async.map(all_posts, (myPost, cb) => {
            Post.findById(myPost._id).populate('user').exec(cb);
        }, (err, result_arr) => {
            if(err)
                return next(err);
            res.send({all_posts: result_arr});
        })
    });
}

exports.get_user_post = (req, res, next) => {
    User.findById(req.params.id).exec((err, theUser) => {
        if (err)
            return next(err);
        if (!theUser) {
            return next(new Error('No such user'));
        } else {
            if (_checkLiked(theUser.follower, req.user._id) < 0 && 
                !theUser.equals(req.user._id)) {
                return next(new Error('Not following the user'));
            } else {
                async.map(theUser.posts, (post, callback) => {
                    Post.findById(post._id).populate('user')
                    .populate('likes').populate('comments').exec(callback);   
                }, (err, results) => {
                    if (err)
                        return next(err);
                    res.send({results});
                })
            }
        }
    });
}

exports.post_update = [
    body('message', "Message must not be empty").trim().isLength({min: 1}).escape(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.send({err: errors.array()});
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
                        const update = { message: req.body.message };
                        if (req.file) {
                            fs.unlink(thePost.media, err => {
                                if (err)
                                    console.log('fail delete media');
                                else
                                    console.log('media deleted');
                            })
                            update.media = req.file.path;
                        }
                        Post.findByIdAndUpdate(req.params.id, update, {}, (err, newPost) => {
                            if (err)
                                return next(err);
                            res.send({success: 'post updated'});
                        })
                    }
                });
            }
        }
    }
]

exports.post_delete = (req, res, next) => {
    Post.findById(req.params.id).exec((err, thePost) => {
        if (err)
            return next(err);
        if (!thePost) {
            return next(new Error('No such post'));
        } else {
            console.log(req.user);
            if (thePost.user.equals(req.user._id)) {
                Post.findByIdAndRemove(req.params.id, err => {
                    if (err)
                        return next(err);
                    res.send({success: 'deleted post'});
                })
            } else {
                return next(new Error('Not authorize to delete this post'));
            }
        }
    })
}

exports.post_like = (req, res, next) => {
    Post.findById(req.params.id).exec((err, thePost) => {
        if (err)
            return next(err);
        if(!thePost) {
            return next(new Error('No such post'));
        } else {
            const like_exist = _checkLiked(thePost.likes, req.user._id);
            if (like_exist < 0) {
                const like_arr = thePost.likes;
                like_arr.push(req.user._id);
                Post.findByIdAndUpdate(req.params.id, {likes: like_arr}, {}, (err, newPost) => {
                    if (err)
                        return next(err);
                    res.send({success: 'Liked post'});
                });
            } else {
                return next(new Error('Already liked'));
            }
        }
    })
}

exports.post_unlike = (req, res, next) => {
    Post.findById(req.params.id).exec((err, thePost) => {
        if (err)
            return next(err);
        if (!thePost) {
            return next(new Error('No such post'));
        } else {
            const like_exist = _checkLiked(thePost.likes, req.user._id);
            if (like_exist > -1) {
                const like_arr = thePost.likes;
                like_arr.splice(like_exist, 1);
                Post.findByIdAndUpdate(req.params.id, {likes: like_arr}, {}, (err, newPost) => {
                    if (err)
                        return next(err);
                    res.send({success: 'Unliked post'});
                });
            } else {
                return next(new Error(`${req.user.username} did not liked this post`));
            }
        }
    })
}

exports.media_get = (req, res, next) => {
    const imagePath = path.join(__dirname, '../', req.query.name);
    if (fs.access(imagePath, fs.F_OK, (err) => {
        if (err)
            return next(err);
        res.sendFile(imagePath);
    }));
}

function _checkLiked(arr, targetID) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i]._id.equals(targetID))
            return i;
    }
    return -1;
}