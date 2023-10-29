const Password = require('./../models/passwordModel');


/* exports.getAllPasswords = async (req, res, next) => {
  try {
    const passwords = await Password.find().select('-__v');

    res.status(200).json({
      status: 'succes',
      passwords,
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      err,
    });
  }
}; */

exports.createPassword = async (req, res, next) => {
  try {
    const passwords = await Password.create({
      'hubName':req.body.hubName,
      'email':req.body.email,
      'password':req.body.password,
      'user':req.user.id

    });

    res.status(200).json({
      status: 'succes',
      passwords,
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      err,
    });
  }
};

//these get passwords for logged in user
exports.getAllPasswords = async (req ,res) => {
  try {
    const passwords = await Password.find({user:req.user.id}).select('-__v');
    res.status(200).json({
      status: 'success',
      passwords,
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      err,
    });
  }

};

exports.deletePassword = async (req , res) => {
  try 
  {
    const id = +req.params.id;
    const password = await Password.findByIdAndDelete(id);
    if (!password) {
      return res.status(404).json({
        status:'fail' ,
        message:'Password not found'
      });
    }
    res.status(201).json({
      status: 'success',
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      err,
    });
  }


};

exports.updatePassword = async (req , res) => {
  try {
    const password = await Password.findByIdAndUpdate(req.params.id , req.body ,{
      runValidators:true ,
      new:true,
    });
    if (!password) {
      return res.status(404).json({
        status:'fail' ,
        message:'Password not found'
      });
    }
    res.status(200).json({
      status:'success' ,
      password
    });

  } catch (err) {
    res.status(400).json({
      status: 'fail',
      err,
    });
  }
  
};