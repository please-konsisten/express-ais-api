import bcrypt from "bcrypt";

import { prisma } from "@src/lib/prisma-client"
import { loginAccountValidation, registerAccountValidation } from "@src/validation/auth-validation"
import { validate } from "@src/validation/validation"
import { ResponseError } from "@src/error/response-error";
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';

import type { LoginAccountRequest, LoginAccountResponse, RegisterAccountRequest } from "@src/types/auth-type"


const login = async (dataRequest: LoginAccountRequest) : Promise<LoginAccountResponse> => {
  const accountValidation = validate(loginAccountValidation, dataRequest)
  const { identifier, password } = accountValidation

  const account = await prisma.account.findFirst({
    where: {
      OR: [
        { email: identifier },
        { username: identifier }
      ]
    }
  });

  if (!account) {
    throw new ResponseError(401,'Email atau password salah');
  }

  const isPasswordValid = await bcrypt.compare(password, account.password);
  if (!isPasswordValid) {
    throw new ResponseError(401,'Email atau password salah');
  }

  const accessToken = generateAccessToken(account);
  const refreshToken = await generateRefreshToken(account.id);

  return{
    accessToken,
    refreshToken
  }
}

const register = async (dataRequest: RegisterAccountRequest) => {
  const accountValidation = validate(registerAccountValidation, dataRequest)
  const { email, username, password } = accountValidation

  const existingAccount = await prisma.account.count({
    where: {
      OR: [{ email }, { username }]
    }
  });

  if (existingAccount === 1) {
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

const refresh_token = (cookieToken: string) => {
  if (!cookieToken) {
    throw new ResponseError(401, "Refresh token tidak ditemukan");
  }
}

export default {
  register,
  login,
  refresh_token
}