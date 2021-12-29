const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const compression = require('compression');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const passportJwt = require('passport-jwt');
const JWTStrategy = passportJwt.Strategy;
const ExtractJWT = passportJwt.ExtractJwt;
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/user');
const indexRouter = require('./routes/index');

// passport setup
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password',
  },
  (email, password, done) => {
  User.findOne({email}, (err, user) => {
    if (err)
      return done(err);
    if (!user)
      return done(null, false, {message: 'Email not found'});
    bcrypt.compare(password, user.password, (err, res) => {
      if (err)
        return next(err);
      if (!res)
        return done(null, false, {message: 'Password incorrect'});
      return done(null, user, 'Loged in');
    });
  });
}));

passport.use(new JWTStrategy({
    jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.S_KEY,
  },
  (jwtPayload, cb) => {
    User.findById(jwtPayload.user._id, (err, user) => {
      if (err)
        return cb(err);
      if (user === null) {
        const err = new Error("Please login or sign up");
        err.status = 404;
        return cb(err);
      } else {
        return cb(null, user);
      }
    });
  }
  ));


const app = express();

// mongodb setup
const mongoose = require('mongoose');
const mongoDB = `mongodb+srv://admin:${process.env.DB_PASSWORD}@cluster0.92d3a.mongodb.net/cloneBookDB?retryWrites=true&w=majority`;
mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(cors());
app.use(compression());
app.use(helmet());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.send({err: res.locals.message});
});

module.exports = app;
