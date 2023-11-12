const userModel = require('./../models/userModel');
const sendEmail = require('./../utils/email');
const hashToken = require('./../utils/hashToken');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const createSendToken = (res, status, user) => {
  const token = jwt.sign({ id: user.id }, process.env.SECRET_KEY, {
    expiresIn: process.env.EXPIRE_IN,
  });

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
  };

  res.cookie('jwt', token, cookieOptions);

  res.status(status).json({
    status: 'success',
    user,
    token,
  });
};

exports.signup = async (req, res) => {
  try {
    // create a user but marked as not authenticated
    const newUser = await userModel.create({
      name: req.body.name,
      password: req.body.password,
      passwordConfirm: req.body.passwordConfirm,
      email: req.body.email,
    });
    newUser.authenticated = false;

    // Generate random confirm token
    const confirmToken = newUser.createEmailConfirmToken();
    newUser.save({ validateBeforeSave: false });

    // Send confirm token to user email
    try {
      await sendEmail({
        email: 'mhmadalaa666@gmail.com',
        subject: 'Email Confirm',
        message: `That's a 10 minutes valid token ${confirmToken} to Confirm your Email`,
      });

      res.status(200).json({
        status: 'success',
        message: 'An email will be send to complete the steps',
        // FIXME: the confirm token shouldn't be returned to the client with the response
        // it must be returned in a trusted place which the correct user have access to
        // aka the `email`
        confirmToken,
      });
    } catch (err) {
      await userModel.findByIdAndDelete(newUser._id);

      res.status(500).json({
        status: 'fail',
        message:
          'There is an error while sending the email, pleas signup again!',
      });
    }
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

exports.confirmSignup = async (req, res, next) => {
  // encrypt the token to match the saved one
  const hashedToken = hashToken(req.params.confirmToken);

  // find the user by token and not exceded the expires date
  const user = await userModel.findOne({
    emailCofirmToken: hashedToken,
    emailConfirmExpires: { $gt: Date.now() },
  });
  if (!user) {
    return next('Token is invalide or has been expired!', 400);
  }

  // authenticate the created user before as a regular user
  user.authenticated = true;
  user.emailCofirmToken = undefined;
  user.emailConfirmExpires = undefined;
  await user.save({ validateBeforeSave: false });

  createSendToken(res, 201, user);
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'fail',
        message: 'You must provide an email address',
      });
    }

    if (!password) {
      return res.status(400).json({
        status: 'fail',
        message: 'You must provide a password',
      });
    }

    const user = await userModel.findOne({ email }).select('+password');
    // we check if user is authenticated and added this field
    // to avoid the case where the user signup but not authenticated yet
    // so the user was created and if we don't check if it's authenticated or not he can login
    // so we must check that,
    // and we need TODO: a background-task (example: workerThread)
    // to delete these not authenticated users
    // or but them in a separated service to avoid an attack of
    // tons of not-authenticated users at the same time
    // which will down our app
    if (
      !user ||
      !(await user.correctPassword(password, user.password)) ||
      !user.authenticated
    ) {
      return res.status(404).json({
        status: 'fail',
        message: 'There is no user with that email and password',
      });
    }

    createSendToken(res, 200, user);
  } catch (err) {
    res.status(401).json({
      status: 'fail',
      message: err.message,
    });
  }
};

exports.isLogin = async (req, res, next) => {
  if (req.headers.cookie === undefined) {
    return res.status(401).json({
      status: 'fail',
      message: 'You must be logged in to access this page',
    });
  }

  const token = req.headers.cookie.split('=')[1];
  const decode = await promisify(jwt.verify)(token, process.env.SECRET_KEY);
  const user = await userModel.findById(decode.id);
  if (!user) {
    return res.status(401).json({
      status: 'fail',
      message: 'User not found',
    });
  }

  if (user.changedPasswordAfter(decode.iat)) {
    return res.status(401).json({
      status: 'fail',
      message: 'Password is incorrect',
    });
  }

  req.user = user;
  next();
};

exports.logout = (req, res) => {
  const cookieOptions = {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  };

  res.cookie('jwt', 'logged out', cookieOptions);
  res.status(200).json({ status: 'success' });
};

exports.updateUser = async (req, res, next) => {
  // The other fields [password, email] can not be updated
  // with this regular update function it needs mor confirmation
  if (req.body.email || req.body.password) {
    return res.status(401).json({
      status: 'fail',
      message:
        'You can not update curcial data with this regualar update router',
    });
  }

  await userModel.findByIdAndUpdate(req.user.id, req.body, {
    new: true,
    runValidators: true,
  });

  const user = await userModel.findById(req.user.id);

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });

  next();
};
