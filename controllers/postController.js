const async = require('async');
const bcrypt = require('bcrypt');
const { body, check, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const passport = require('passport');
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

// send back image
// res.sendFile(path.join(__dirname, '../', req.file.path));