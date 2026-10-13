import bcrypt from "bcrypt";
import { v4 as uuid } from "uuid";

import { validate } from "@src/validation/validation.ts";
import {
  getUserValidation,
  loginUserValidation,
  registerUserValidation,
  updateUserValidation } from "@src/validation/user-validation.ts";
import { prismaClient } from "@src/application/database.ts";
import { ResponseError } from "@src/error/response-error.js";

import type { 
  LoginUserRequest, 
  RegisterUserRequest } from "@src/type/user-type.ts";

const register = async (request: RegisterUserRequest) => {
  const user = validate(registerUserValidation, request);

  const countUser = await prismaClient.user.count({
    where: {
      username: user.username
    }
  });

  if (countUser === 1) {
    throw new ResponseError(400, "Username already exists");
  }

  user.password = await bcrypt.hash(user.password, 10);

  return prismaClient.user.create({
    data: user,
    select: {
      username: true,
      name: true
    }
  });
}

const login = async (request: LoginUserRequest) => {
  const loginRequest = validate(loginUserValidation, request);

  const user = await prismaClient.user.findUnique({
    where: {
      username: loginRequest.username
    },
    select: {
      username: true,
      password: true
    }
  });

  if (!user) {
    throw new ResponseError(401, "Username or password wrong");
  }

  const isPasswordValid = await bcrypt.compare(loginRequest.password, user.password);
  if (!isPasswordValid) {
    throw new ResponseError(401, "Username or password wrong");
  }

  const token = uuid().toString()
  return prismaClient.user.update({
    data: {
      token: token
    },
    where: {
      username: user.username
    },
    select: {
      token: true
    }
  });
}

// const get = async (username: any) => {
//   username = validate(getUserValidation, username);

//   const user = await prismaClient.user.findUnique({
//     where: {
//       username: username
//     },
//     select: {
//       username: true,
//       name: true
//     }
//   });

//   if (!user) {
//     throw new ResponseError(404, "user is not found");
//   }

//   return user;
// }

// const update = async (request: any) => {
//   const user = validate(updateUserValidation, request);

//   const totalUserInDatabase = await prismaClient.user.count({
//     where: {
//       username: user.username
//     }
//   });

//   if (totalUserInDatabase !== 1) {
//     throw new ResponseError(404, "user is not found");
//   }

//   const data = {};
//   if (user.name) {
//     data.name = user.name;
//   }
//   if (user.password) {
//     data.password = await bcrypt.hash(user.password, 10);
//   }

//   return prismaClient.user.update({
//     where: {
//       username: user.username
//     },
//     data: data,
//     select: {
//       username: true,
//       name: true
//     }
//   })
// }

// const logout = async (username: any) => {
//   username = validate(getUserValidation, username);

//   const user = await prismaClient.user.findUnique({
//     where: {
//       username: username
//     }
//   });

//   if (!user) {
//     throw new ResponseError(404, "user is not found");
//   }

//   return prismaClient.user.update({
//     where: {
//       username: username
//     },
//     data: {
//       token: null
//     },
//     select: {
//       username: true
//     }
//   })
// }

export default {
  register,
  login,
  // get,
  // update,
  // logout
}