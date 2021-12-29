const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/userController');
const postController = require('../controllers/postController');
const commentController = require('../controllers/commentController');
const auth = passport.authenticate('jwt', {session: false});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'This is backend' });
});

// user api calls
router.post('/user/create', userController.user_create);
router.post('/user/login', userController.user_logIn);
router.get('/user/:id', auth, userController.user_get);
router.delete('/user/:id', auth, userController.user_delete);
router.put('/user/:id', auth, userController.user_update);
router.put('/user/:id/password', auth, userController.user_update_password);


// post api calls
// router.post('/post', auth, postController.post_create);
// router.get('/post/:id', auth, postController.post_get);
// router.put('/post/:id', auth, postController.post_update);
// router.delete('/post/:id', auth, postController.post_delete);

// comment api calls
// router.post('/comment', auth, postController.comment_create);
// router.get('/comment/:id', auth, commentController.comment_get);
// router.put('/comment/:id', auth, commentController.comment_update);
// router.put('/comment/:id', auth, commentController.comment_delete);

module.exports = router;
