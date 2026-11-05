import express from 'express';
import authController from '@src/controller/auth-controller';

const publicRouter = express.Router();

publicRouter.post('/login', authController.login);
publicRouter.post('/register', authController.register);
publicRouter.post('/refresh-token', authController.refresh_token);

export {
  publicRouter
};
