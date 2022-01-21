const async = require('async');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const User = require('../models/user');
const Post = require('../models/post');

/**
 * api call that create a post
 * return success or error
 */
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
                            res.send({id: post._id});
                    });
                });
            }
        }
    }
]

/**
 * api call that get post with the provided id
 * return the post or error
 */
exports.post_get = (req, res, next) => {
    Post.findById(req.params.id).populate('user', 'username icon')
    .populate('likes', 'username icon').populate('comments').exec((err, thePost) => {
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

/**
 * api call that get the likes of the id's post
 * return array of object that contain likes' array and whether user liked or not 
 * or error
 */
exports.post_get_likes = (req, res, next) => {
    Post.findById(req.params.id).populate('likes', 'username icon').exec((err, thePost) => {
        if (err)
            return next(err);
        if (!thePost) {
            return next(new Error('No such post'));
        } else {
            const status = _getIndex(thePost.likes, req.user._id) > -1;
            res.send({likes: thePost.likes, status});
        }
    });
}

/**
 * api call that get the post of a user's timeline
 * return array of post or error
 */
exports.post_get_timeline = (req, res, next) => {
    async.map(req.user.following, (user, callback) => {
        User.findById(user._id).populate('posts').sort({date: -1}).exec((err, theUser) => {
            if (err)
                return callback(err);
            callback(null, theUser.posts);
        });
    }, (err, results) => {
        if (err)
            return next(err);
        User.findById(req.user._id).populate('posts').sort({date: -1})
        .exec((err, thisUser) => {
            if (err)
                return next(err);
                const all_posts = [];
                thisUser.posts.forEach(post => {
                    all_posts.push(post);
                });
                results.forEach(post_arr => {
                    post_arr.forEach(post => {
                        all_posts.push(post);
                    })
                })
                all_posts.sort((a, b) => {return b.date - a.date});
                async.map(all_posts, (myPost, cb) => {
                    Post.findById(myPost._id).populate('user').exec(cb);
                }, (err, result_arr) => {
                    if(err)
                        return next(err);
                    res.send({all_posts: result_arr});
                })
        })
    });
}

/**
 * api call that get all post of that user
 * return array of post or error
 */
exports.get_user_post = (req, res, next) => {
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
                async.map(theUser.posts, (post, callback) => {
                    Post.findById(post._id).populate('user', 'username icon')
                    .populate('likes', 'username icon').exec(callback);   
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
 * api call that get user's liked post
 * return array of post or error
 */
exports.get_user_liked_post = (req, res, next) => {
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
                async.map(theUser.liked_post, (post, callback) => {
                    Post.findById(post._id).populate('user', 'username icon')
                    .populate('likes', 'username icon').exec(callback);   
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
 * api call that update a post
 * only user that created the post can update it
 * return success or error
 */
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

/**
 * api call that delete a post
 * only user who created the post can delete it
 * return success or error
 */
exports.post_delete = (req, res, next) => {
    Post.findById(req.params.id).exec((err, thePost) => {
        if (err)
            return next(err);
        if (!thePost) {
            return next(new Error('No such post'));
        } else {
            if (thePost.user.equals(req.user._id)) {
                const my_post = req.user.posts;
                my_post.splice(_getIndex(req.user.posts, req.params.id), 1);
                async.parallel({
                    post: (callback) => {
                        Post.findByIdAndRemove(req.params.id, callback);
                    },
                    user: (callback) => {
                        User.findByIdAndUpdate(req.user._id, {posts: my_post},
                            {}, callback);
                    },
                    liked_user: (callback) => {
                        async.map(thePost.likes, (user, cb) => {
                            User.findById(user).exec((err, theUser) => {
                                if (err)
                                    return next(err);
                                if (!theUser) {
                                    return next(new Error('No such user'));
                                } else {
                                    const theLikes = theUser.liked_post;
                                    theLikes.splice(_getIndex(theLikes, req.params.id), 1);
                                    User.findByIdAndUpdate(user, {liked_post: theLikes}, 
                                        {}, cb);
                                }
                            });
                        }, callback);
                    }
                }, (err, results) => {
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

/**
 * api call that allow user to like a post
 * return success or error
 */
exports.post_like = (req, res, next) => {
    Post.findById(req.params.id).exec((err, thePost) => {
        if (err)
            return next(err);
        if(!thePost) {
            return next(new Error('No such post'));
        } else {
            const like_exist = _getIndex(thePost.likes, req.user._id);
            if (like_exist < 0) {
                const like_arr = thePost.likes;
                const my_arr = req.user.liked_post;
                my_arr.push(req.params.id);
                like_arr.push(req.user._id);
                async.parallel({
                    mine: (callback) => {
                        User.findByIdAndUpdate(req.user._id, {liked_post: my_arr}, 
                            {}, callback);
                    },
                    target: (callback) => {
                        Post.findByIdAndUpdate(req.params.id, {likes: like_arr}, 
                            {}, callback);
                    }
                }, (err, results) => {
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

/**
 * api call that allow user to unlike a post
 * return success or error
 */
exports.post_unlike = (req, res, next) => {
    Post.findById(req.params.id).exec((err, thePost) => {
        if (err)
            return next(err);
        if (!thePost) {
            return next(new Error('No such post'));
        } else {
            const like_exist = _getIndex(thePost.likes, req.user._id);
            if (like_exist > -1) {
                const like_arr = thePost.likes;
                const my_index = _getIndex(req.user.liked_post, req.params.id);
                const my_arr = req.user.liked_post;
                like_arr.splice(like_exist, 1);
                my_arr.splice(my_index, 1);
                async.parallel({
                    mine: (callback) => {
                        User.findByIdAndUpdate(req.user._id, {liked_post: my_arr}, 
                            {}, callback);
                    },
                    target: (callback) => {
                        Post.findByIdAndUpdate(req.params.id, {likes: like_arr}, 
                            {}, callback);
                    }
                }, (err, results) => {
                    if (err)
                        return next(err);
                    res.send({success: 'unliked post'});
                });
            } else {
                return next(new Error(`${req.user.username} did not liked this post`));
            }
        }
    })
}

/**
 * api call that get the media with the name of the file given
 * return media file or error
 */
exports.media_get = (req, res, next) => {
    const imagePath = path.join(__dirname, '../', req.query.name);
    if (fs.access(imagePath, fs.F_OK, (err) => {
        if (err)
            return next(err);
        res.sendFile(imagePath);
    }));
}

// helper function that find the index of targetd id in array
function _getIndex(arr, targetID) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i]._id.equals(targetID))
            return i;
    }
    return -1;
}