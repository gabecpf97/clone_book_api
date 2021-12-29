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
            if (_containUser(theUser.follower, req.user._id) > -1) {
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
                        const user = {
                            username: req.body.username,
                            email: req.body.email,
                            password: theUser.password,
                            first_name: req.body.first_name,
                            last_name: req.body.last_name,
                            private: req.body.private,
                        };
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
                        User.findByIdAndUpdate(req.params.id, 
                            { password: hashedPassword }, {}, (err, newUser) => {
                            if (err)
                                return next(err);
                            res.send({success: 'changed password'});
                        });
                    })
                }
            });
        }
    }
]

exports.user_follow = (req, res, next) => {
    if (req.user._id.equals(req.params.id)) {
        return next(new Error("Can't follow yourself"));
    } else {
        User.findById(req.params.id).exec((err, theUser) => {
            if (err)
                return next(err);
            if (!theUser) {
                return next(new Error('No such user'));
            } else {
                if (_containUser(theUser.follower, req.user._id) > -1) {
                    res.send({message: 'Alreaday Follower'});
                } else if (_containUser(theUser.pending_follower, req.user._id) > -1) {
                    res.send({message: 'Already sent request'})
                } else {
                    if (theUser.private) {
                        const pFollower = theUser.pending_follower;
                        pFollower.push(req.user._id);
                        User.findByIdAndUpdate(req.params.id, 
                            {pending_follower: pFollower}, {}, (err, newUser) => {
                                if (err)
                                    return next(err);
                            res.send({success: 'added to pending'});
                        });
                    } else {
                        const target_arr = theUser.follower
                        const my_arr = req.user.following
                        my_arr.push(req.params.id);
                        target_arr.push(req.user._id);
                        async.parallel({
                            target: (callback) => {
                                User.findByIdAndUpdate(req.params.id, {follower: target_arr}, 
                                    {}, callback);
                            },
                            mine: (callback) => {
                                User.findByIdAndUpdate(req.user._id, {following: my_arr},
                                    {}, callback);
                            }
                        }, (err, results) => {
                            if (err)
                                return next(err);
                            if (!results.mine) {
                                return next(new Error('No such user'));
                            } else {
                                res.send({success: 'following'});
                            }
                        })
                    }
                }
            }
        });
    }
}

exports.user_un_follow = (req, res, next) => {
    if (req.user._id.equals(req.params.id)) {
        return next(new Error("Can't unfollow yourself"));
    } else {
        User.findById(req.params.id).exec((err, theUser) => {
            if (err)
                return next(err);
            if (!theUser) {
                return next(new Error('No such user'));
            } else {
                let f_array = [];
                let my_array = [];
                const my_array_index = _containUser(req.user.following, theUser._id);
                const follower_index = _containUser(theUser.follower, req.user._id);
                const pending_index = _containUser(theUser.pending_follower, req.user._id);
                if (follower_index < 0 && pending_index > 0) {
                    res.send({err: 'No pending or following this user'});
                } else {
                    if (follower_index > -1) {
                        f_array = theUser.follower;
                        my_array = req.user.following;
                        f_array.splice(follower_index, 1);
                        my_array.splice(my_array_index, 1);
                        async.parallel({
                            target: (callback) => {
                                User.findByIdAndUpdate(req.params.id, {follower: f_array},
                                    {}, callback);
                            },
                            mine: (callback) => {
                                User.findByIdAndUpdate(req.user._id, {following: my_array},
                                    {}, callback);
                            }
                        }, (err, results) => {
                            if (err)
                                return next(err);
                            if (!results.mine) {
                                return next(new Error('No such user'));
                            } else {
                                res.send({success: 'unfollowed'});
                            }
                        })
                    } else {
                        const f_array = theUser.pending_follower;
                        f_array.splice(pending_index, 1);
                        User.findByIdAndUpdate(req.params.id, {pending_follower: f_array},
                            {}, (err, newUser) => {
                                if (err)
                                    return next(err);
                                res.send({success: 'Removed from pending'});
                            });
                    }
                }
            }
        });

    }
}

exports.user_approve = (req, res, next) => {
    const target_index = _containUser(req.user.pending_follower, req.params.id);
    if (target_index > -1) {
        User.findById(req.params.id).exec((err, theUser) => {
            if (err)
                return next(err);
            if (!theUser) {
                return next(new Error('No such user'));
            } else {
                const p_array = req.user.pending_follower;
                const f_array = req.user.follower;
                const target_f_array = theUser.following;
                p_array.splice(target_index, 1);
                f_array.push(req.params.id);
                target_f_array.push(req.user._id);
                async.parallel({
                    mine: (callback) => {
                        User.findByIdAndUpdate(req.user._id, {
                            pending_follower: p_array,
                            follower: f_array
                        }, {}, callback);
                    },
                    target: (callback) => {
                        User.findByIdAndUpdate(req.params.id, {following: target_f_array},
                            {}, callback);
                    }
                }, (err, results) => {
                    if (err)
                        return next(err);
                    if (!results.mine) {
                        return next(new Error('No such user'));
                    } else {
                        res.send({success: `${theUser.username} now follows you`});
                    }
                });
            }
        })
    } else {
        return next(new Error('No such user in your pending list'));
    }
}

function _containUser(arr, targetID) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i]._id.equals(targetID))
            return i;
    }
    return -1;
}