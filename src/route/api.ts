import express from "express";
// --- Controller ---
import userController from "@src/controller/user-controller.js";
import contactController from "@src/controller/contact-controller.js";
import addressController from "@src/controller/address-controller.js";
// --- Middleware ---
import { authMiddleware } from "@src/middleware/auth-middleware.js";

const userRouter = express.Router();
userRouter.use(authMiddleware);

// User API
userRouter.get('/api/users/current', userController.get);
userRouter.patch('/api/users/current', userController.update);
// userRouter.delete('/api/users/logout', userController.logout);

// // Contact API
// userRouter.post('/api/contacts', contactController.create);
// userRouter.get('/api/contacts/:contactId', contactController.get);
// userRouter.put('/api/contacts/:contactId', contactController.update);
// userRouter.delete('/api/contacts/:contactId', contactController.remove);
// userRouter.get('/api/contacts', contactController.search);

// // Address API
// userRouter.post('/api/contacts/:contactId/addresses', addressController.create);
// userRouter.get('/api/contacts/:contactId/addresses/:addressId', addressController.get);
// userRouter.put('/api/contacts/:contactId/addresses/:addressId', addressController.update);
// userRouter.delete('/api/contacts/:contactId/addresses/:addressId', addressController.remove);
// userRouter.get('/api/contacts/:contactId/addresses', addressController.list);

// export {
//     userRouter
// }