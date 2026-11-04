import bcrypt from "bcrypt";

import { prisma } from "@src/lib/prisma-client"
import { registerAccountValidation } from "@src/validation/auth-validation"
import { validate } from "@src/validation/validation"

import type { Request } from "express"
import type { RegisterAccountRequest } from "@src/types/auth-type"
import { ResponseError } from "@src/error/response-error";


const login = () => {

}

const register = async (req: RegisterAccountRequest) => {
  const account = validate(registerAccountValidation, req)
  const { email, username, password } = account

  const existingUser = await prisma.account.count({
    where: {
      OR: [{ email }, { username }]
    }
  });

  if (existingUser === 1) {
    throw new ResponseError(400, "Username already exists");
  }

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const newAccount = await prisma.account.create({
    data: {
      username,
      email,
      password: hashedPassword
    }
  });

  return newAccount
}

const refresh_token = () => {

}

export default {
  register
}