import Joi from "joi";

const registerAccountValidation = Joi.object({
    username: Joi.string().max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().max(100).required(),
});

const loginAccountValidation = Joi.object({
  identifier: Joi.alternatives().try(
    Joi.string().email().max(100).required(),
    Joi.string().alphanum().min(3).max(100).required()
  ).required().messages({
    'alternatives.match': 'Identifier harus berupa email atau username yang valid'
  }),
  password: Joi.string().max(100).required(),
});


export {
  registerAccountValidation,
  loginAccountValidation
}