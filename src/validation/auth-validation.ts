import Joi from "joi";

const registerAccountValidation = Joi.object({
    username: Joi.string().max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().max(100).required(),
});

export {
  registerAccountValidation
}