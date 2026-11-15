import express from 'express';
import authController from '@src/modules/auth/auth.controller';

const publicRouter = express.Router();

publicRouter.post('/auth/login', authController.login);
publicRouter.post('/auth/register', authController.register);
publicRouter.post('/auth/refresh-token', authController.refresh_token);

export {
  publicRouter
};
