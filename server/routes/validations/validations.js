const Joi = require('joi');

const registerValidation = (data) => {
  const validationSchema = Joi.object({
    firstname: Joi.string()
    .min(2)
    .required(),
    lastname: Joi.string()
    .min(2)
    .required(),
    password: Joi.string()
    .pattern(new RegExp('^[a-zA-Z0-9]{3,30}$'))
    .min(6),
    email: Joi.string()
    .min(6)
    .required()
    .email(),
  })

  return validationSchema.validate(data);
}

module.exports.registerValidation = registerValidation;
