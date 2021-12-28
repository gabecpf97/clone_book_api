const async = require('async');
const bcrypt = require('bcrypt');
const { body, check, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const User = require('../models/user');
const Post = require('../models/post');
const Comment = require('../models/comment');

exports.user_create = [
    body('username', 'Username must be longer than 4 letter').trim().isLength({min: 4}).escape(),
    check('username').custom(async (value) => {
        return new Promise((resolve, reject) => {
            User.findOne({username}).exec((err, theUser) => {
                if (!theUser) {
                    return resolve(true);
                } else {
                    return reject('Username already existed')
                }
            });
        });
    }),
    body('email', 'Please enter an email address').normalizeEmail().isEmail().escape(),
    check('password').trim().isLength({min: 6})
    .withMessage('Passowrd must be longer than 6 letter').custom(value => {
        return /\d/.test(value)
    }).withMessage('Password must inclue numbers'),
    body('first_name', 'First name must not be empty').trim().isLength({min: 1}).escape(),
    body('last_name', 'Last name must not be empty').trim().isLength({min: 1}).escape(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.send({errors: errors.array()});
        } else {
            bcrypt.hash(req.body.password, (err, hashedPassword) => {
                if (err)
                    return next(err);
                const user = new User({
                    username: req.body.username,
                    email: req.body.email,
                    first_name: req.body.first_name,
                    last_name: req.body.last_name,
                    date_join: new Date,
                });
                user.password = hashedPassword;
                user.save(err => {
                    if (err)
                        return next(err);
                    const token = jwt.sign({user}, 'secret_key');
                    res.send({token, user});
                })
            })
        }
    }
]