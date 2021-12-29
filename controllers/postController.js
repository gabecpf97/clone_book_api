const async = require('async');
const bcrypt = require('bcrypt');
const { body, check, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const passport = require('passport');
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
    Post.findById(req.params.id).populate('user')
    .populate('likes').populate('comments').exec((err, thePost) => {
        if (err)
            return next(err);
        if (!thePost) {
            return next(new Error('No such post'));
        } else {
            const post = thePost;
            post.likes = _filterUser(thePost.likes);
            post.user = {
                _id: thePost.user._id,
                username: thePost.user.username,
            }
            res.send({post});
        }
    });
}

exports.post_update = [
    body('message', "Message must not be empty").trim().isLength({min: 0}).escape(),
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
                        if (req.file)
                            update.media = req.file.path;
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
                res.send({err: 'Not authorize to delete this post'});
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

function _filterUser(arr) {
    for (let i = 0; i < arr.length; i++) {
        arr[i] = {
            _id: arr[i]._id,
            username: arr[i].username,
        }
    }
    return arr;
}

function _checkLiked(arr, targetID) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i]._id.equals(targetID))
            return i;
    }
    return -1;
}