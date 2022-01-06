const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require('../controllers/userController');
const postController = require('../controllers/postController');
const commentController = require('../controllers/commentController');
const auth = passport.authenticate('jwt', {session: false});
const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, new Date().toISOString().replace(/:/g, '-') + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg"
  ) {
    return cb(null, true);
  }
  req.fileValidationError = 'Please sent a image files';
  return cb(null, false);
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5000000 },
  fileFilter: fileFilter
});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'This is backend' });
});

// make sure all user field only container info it needs !!!

// user api calls
router.post('/user/create', upload.single('icon'), userController.user_create);
router.post('/user/login', userController.user_logIn);
router.get('/user/:id', auth, userController.user_get);
router.get('/user/:id/list/', auth, userController.userlist_get);
router.delete('/user/:id', auth, userController.user_delete);
router.put('/user/:id', auth, upload.single('icon'), userController.user_update);
router.put('/user/:id/password', auth, userController.user_update_password);
router.put('/user/:id/follow', auth, userController.user_follow);
router.put('/user/:id/unfollow', auth, userController.user_un_follow);
router.put('/user/:id/approve', auth, userController.user_approve);
router.put('/user/:id/unapprove', auth, userController.user_un_approve);
router.put('/user/:id/remove_follower', auth, userController.user_remove_follower);
router.get('/user/:id/post', auth, postController.get_user_post);
router.get('/user/:id/comment', auth, commentController.get_user_comment);
router.get('/user/:id/liked_post', auth, postController.get_user_liked_post);
router.get('/user/:id/liked_comment', auth, commentController.get_user_liked_comment);

// post api calls
router.get('/all_post', auth, postController.post_get_timeline);
router.post('/post/create', auth, upload.single('image'), postController.post_create);
router.get('/post/:id', auth, postController.post_get);
router.get('/post/:id/likes', auth, postController.post_get_likes);
// Do not allow user to update post
// router.put('/post/:id', auth, upload.single('image'), postController.post_update);
router.put('/post/:id/like', auth, postController.post_like);
router.put('/post/:id/unlike', auth, postController.post_unlike);
router.delete('/post/:id', auth, postController.post_delete);

// get media
router.get('/media/', postController.media_get);

// comment api calls
router.post('/post/:id/comment', auth, upload.single('image'), commentController.comment_create);
router.get('/comment/:id', auth, commentController.comment_get);
router.get('/comment_list/:id', auth, commentController.comment_get_list);
// router.put('/comment/:id', auth, commentController.comment_update);
router.get('/comment/:id/likes', auth, commentController.comment_get_likes);
router.put('/comment/:id/like', auth, commentController.comment_like);
router.put('/comment/:id/unlike', auth, commentController.comment_unlike);
router.delete('/comment/:id', auth, commentController.comment_delete);

module.exports = router;
