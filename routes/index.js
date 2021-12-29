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

// user api calls
router.post('/user/create', userController.user_create);
router.post('/user/login', userController.user_logIn);
router.get('/user/:id', auth, userController.user_get);
router.delete('/user/:id', auth, userController.user_delete);
router.put('/user/:id', auth, userController.user_update);
router.put('/user/:id/password', auth, userController.user_update_password);
router.put('/user/:id/follow', auth, userController.user_follow);
router.put('/user/:id/unfollow', auth, userController.user_un_follow);
router.put('/user/:id/approve', auth, userController.user_approve);
router.put('/user/:id/unapprove', auth, userController.user_un_approve);
router.put('/user/:id/remove_follower', auth, userController.user_remove_follower);

// post api calls
router.post('/post/create', auth, upload.single('image'), postController.post_create);
router.get('/post/:id', auth, postController.post_get);
router.put('/post/:id', auth, upload.single('image'), postController.post_update);
router.put('/post/:id/like', auth, postController.post_like);
router.delete('/post/:id', auth, postController.post_delete);
router.get('/media/', auth, postController.media_get);
// get media
// http://localhost:3000/media/?name=uploads\\2021-12-29T06-50-27.997Ztest_post_1.jpg

// comment api calls
// router.post('/comment', auth, postController.comment_create);
// router.get('/comment/:id', auth, commentController.comment_get);
// router.put('/comment/:id', auth, commentController.comment_update);
// router.put('/comment/:id', auth, commentController.comment_delete);

module.exports = router;
