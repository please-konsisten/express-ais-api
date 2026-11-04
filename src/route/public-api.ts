import express from 'express';
import authController from '@src/controller/auth-controller';

const publicRouter = express.Router();

publicRouter.post('/api/login', authController.login);
publicRouter.post('/api/register', authController.register);
publicRouter.post('/api/refresh-token', authController.refresh_token);

export {
  publicRouter
};
