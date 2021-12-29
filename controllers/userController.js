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
            User.findOne({username: value}).exec((err, theUser) => {
                if (!theUser) {
                    return resolve(true);
                } else {
                    return reject('Username already exists')
                }
            });
        });
    }),
    body('email', 'Please enter an email address').normalizeEmail().isEmail().escape(),
    check('email').custom(async (value) => {
        return new Promise((resolve, reject) => {
            User.findOne({email: value}).exec((err, theUser) => {
                if (!theUser)
                    return resolve(true);
                else
                    return reject('Email already exists');
            })
        });
    }),
    check('password').trim().isLength({min: 6})
    .withMessage('Passowrd must be longer than 6 letter').custom(value => {
        return /\d/.test(value)
    }).withMessage('Password must inclue numbers'),
    check('confirm_password', 'Please enter the same password again')
    .custom((value, { req }) => {
        return value === req.body.password;
    }),
    body('first_name', 'First name must not be empty').trim().isLength({min: 1}).escape(),
    body('last_name', 'Last name must not be empty').trim().isLength({min: 1}).escape(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.send({errors: errors.array()});
        } else {
            bcrypt.hash(req.body.password, 10, (err, hashedPassword) => {
                if (err)
                    return next(err);
                const user = new User({
                    username: req.body.username,
                    email: req.body.email,
                    first_name: req.body.first_name,
                    last_name: req.body.last_name,
                    date_join: new Date,
                    private: req.body.private,
                });
                user.password = hashedPassword;
                user.save(err => {
                    if (err)
                        return next(err);
                    const token = jwt.sign({user}, process.env.S_KEY);
                    res.send({token, user});
                })
            })
        }
    }
]

exports.user_logIn = async (req, res, next) => {
    passport.authenticate('local', {session: false}, (err, theUser, info) => {
        if (err || !theUser) {
            return res.send({ message: info.message });
        }
        req.login(theUser, {session: false}, err => {
            if (err)
                return next(err);
            const token = jwt.sign({theUser}, process.env.S_KEY);
            return res.send({token, user: theUser});
        });
    })(req, res, next);
}

exports.user_get = (req, res, next) => {
    User.findById(req.params.id, '').populate('following').populate('follower')
    .populate('posts').populate('comments').populate('liked_post').exec((err, theUser) => {
        if (err)
            return next(err);
        if (theUser.private) {
            if (_isFollower(theUser.follower, req.user._id)) {
                res.send({user: theUser});
            } else {
                res.send({private: true});
            }
        } else {
            res.send({user: theUser});
        }
    });
}

exports.user_delete = [
    body('password').trim().escape(),
    (req, res, next) => {
        if (req.user._id.equals(req.params.id)) {
            User.findById(req.params.id).exec((err, theUser) => {
                if (err)
                    return next(err);
                if (!theUser) {
                    const err = new Error('No such user');
                    next(err);
                } else {
                    bcrypt.compare(req.body.password, theUser.password, (err, pass) => {
                        if (err)
                            return next(err);
                        if (!pass)
                            return next(new Error('Wrong password'));
                        else {
                            User.findByIdAndRemove(req.params.id, err => {
                                if (err)
                                    return next(err);
                                res.send({success: 'deleted'});
                            });
                        }
                    });
                }
            });
        } else {
            const err = new Error('Not authorize to delete this user');
            next(err);
        }    
    }
]

exports.user_update = [
    body('username', 'Username must be longer than 4 letter').trim().isLength({min: 4}).escape(),
    check('username').custom(async (value, { req }) => {
        return new Promise((resolve, reject) => {
            User.findOne({username: value}).exec((err, theUser) => {
                if (!theUser || theUser._id.equals(req.params.id)) {
                    return resolve(true);
                } else {
                    return reject('Username already exists')
                }
            });
        });
    }),
    body('email', 'Please enter an email address').normalizeEmail().isEmail().escape(),
    check('email').custom(async (value, { req }) => {
        return new Promise((resolve, reject) => {
            User.findOne({email: value}).exec((err, theUser) => {
                if (!theUser || theUser._id.equals(req.params.id))
                    return resolve(true);
                else
                    return reject('Email already exists');
            })
        });
    }),
    body('first_name', 'First name must not be empty').trim().isLength({min: 1}).escape(),
    body('last_name', 'Last name must not be empty').trim().isLength({min: 1}).escape(),
    (req, res, next) => {
        if (req.user._id.equals(req.params.id)) {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.send({errors: errors.array()});
            } else {
                User.findById(req.params.id).exec((err, theUser) => {
                    if (err)
                        return next(err);
                    if (!theUser) {
                        return next(new Error('No such user'));
                    } else {
                        const user = _createNewUser('info', req.body, theUser);
                        User.findByIdAndUpdate(req.params.id, user, {}, (err, theUser) => {
                            if (err)
                                return next(err);
                            res.send({success: 'updated'});
                        })
                    }
                });
            }
        } else {
            return next(new Error('Not authorize to edit this user'));
        }
    }
]


exports.user_update_password = [
    check('password').custom(async (value, { req }) => {
        return new Promise((resolve, reject) => {
            if (req.user._id.equals(req.params.id)) {
                bcrypt.compare(value, req.user.password, (err, res) => {
                    if (err)
                        return reject(err);
                    if (!res)
                        return reject('Incorrect password');
                    else
                        return resolve(true); 
                });
            } else {
                return reject('Not authorize to edit this user');
            }
        });
    }),
    check('new_password').trim().isLength({min: 6})
    .withMessage('Passowrd must be longer than 6 letter').custom(value => {
        return /\d/.test(value)
    }).withMessage('Password must inclue numbers'),
    check('confirm_password', 'Please enter the same password again')
    .custom((value, { req }) => {
        return value === req.body.new_password;
    }),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.send({errors: errors.array()});
        } else {
            User.findById(req.params.id).exec((err, theUser) => {
                if (err)
                return next(err);
                if (!theUser) {
                    return next(new Error('No such user'));
                } else {
                    bcrypt.hash(req.body.new_password, 10, (err, hashedPassword) => {
                        if (err)
                            return next(err);
                        const user = _createNewUser('password', hashedPassword, theUser);
                        res.send({user});
                    })
                }
            });
        }
    }
]

exports.user_follows = (req, res, next) => {
    if (req.user._id.equals(req.params.id)) {
        return next(new Error("Can't follow yourself"));
    } else {
        User.findById(req.params.id).exec((err, theUser) => {
            if (err)
                return next(err);
            if (!theUser) {
                return next(new Error('No such user'));
            } else {
                // if (_isFollower())
            }
        });
    }
}

function _createNewUser(from, body, theUser) {
    let user = '';
    if (from === 'info') {
        user = new User({
            username: body.username,
            email: body.email,
            password: theUser.password,
            first_name: body.first_name,
            last_name: body.last_name,
            private: body.private,
        });
    } else {
        user = new User({
            username: theUser.username,
            email: theUser.email,
            password: body,
            first_name: theUser.first_name,
            last_name: theUser.last_name,
            private: theUser.private,
        });
    }
    user._id = theUser.id;
    user.date_join = theUser.date_join;
    user.following = theUser.following;
    user.follower = theUser.follower;
    user.posts = theUser.posts;
    user.comments = theUser.comments;
    user.liked_post = theUser.liked_post;
    return user;
}

function _isFollower(arr, targetID) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i]._id.equals(targetID))
        return true;
    }
    return false;
}