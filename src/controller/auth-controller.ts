// import authService from '@src/services/auth-service';

// import type { Request, Response, NextFunction } from 'express';
// import type { LoginAccountRequest, RegisterAccountRequest } from '@src/types/auth-type';

// const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret';

// const login = async (
//   req: Request <unknown, unknown, LoginAccountRequest>, 
//   res: Response, next: NextFunction
// ) => {
//   try {
//     const { identifier, password } = req.body;
//     const { accessToken, refreshToken } = await authService.login({ identifier, password })
//     res.cookie('refreshToken', refreshToken, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production',
//       sameSite: 'strict',
//       maxAge: 7 * 24 * 60 * 60 * 1000
//     });

//     res.status(200).json({ 
//       data: { accessToken } 
//     }); 
//   } catch (e) {
//     next(e)
//   }
// }

// const register = async (
//   req: Request <unknown, unknown, RegisterAccountRequest>, 
//   res: Response, next: NextFunction
// ) => {
//   try {
//     const { username, email, password } = req.body;
//     const result = await authService.register({ username, email, password });
//     res.status(201).json({
//       data: result
//     });
//   } catch (e) {
//     next(e)
//   }
// }

// const refresh_token = async (
//   req: Request<unknown, unknown, LoginAccountRequest>,
//   res: Response, 
//   next: NextFunction
// ) => {
//   try {
//     const cookieToken = req.cookies.refreshToken
//     const result = await authService.refresh_token(cookieToken)

//     res.cookie('refreshToken', result.newRefreshToken, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === 'production', 
//       sameSite: 'strict',
//       maxAge: 7 * 24 * 60 * 60 * 1000
//     });

//     return res.status(200).json({
//       status: "success",
//       message: "Token berhasil diperbarui",
//       data: {
//         accessToken: result.newAccessToken
//       }
//     });
//   } catch (e) {
//     next(e)
//   }

// }

// export default {
//   login,
//   register,
//   refresh_token
// }

import authService from '@src/services/auth-service';

import type { Request, Response, NextFunction } from 'express';
import type { LoginAccountRequest, RegisterAccountRequest } from '@src/types/auth-type';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; 

const REFRESH_COOKIE_PATH = '/api/auth';

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: REFRESH_COOKIE_PATH,
};

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseCookieOptions,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
};

const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions);
};

const login = async (
  req: Request<unknown, unknown, LoginAccountRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { identifier, password } = req.body;
    const { accessToken, refreshToken } = await authService.login({ identifier, password });
    // set refresh token ke cookie
    setRefreshCookie(res, refreshToken);

    res.status(200).json({
      data: { accessToken },
    });
  } catch (e) {
    next(e);
  }
};

const register = async (
  req: Request<unknown, unknown, RegisterAccountRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, email, password } = req.body;

    const result = await authService.register({ username, email, password });

    res.status(201).json({
      data: result,
    });
  } catch (e) {
    next(e);
  }
};

const refresh_token = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cookieToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];

    const { newAccessToken, newRefreshToken } = await authService.refresh_token(cookieToken);

    setRefreshCookie(res, newRefreshToken);

    res.status(200).json({
      status: 'success',
      message: 'Token berhasil diperbarui',
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (e) {
    // Kalau refresh gagal, hapus cookie supaya client tidak terus mengirim token rusak
    clearRefreshCookie(res);
    next(e);
  }
};

const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cookieToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];

    // Cabut token di DB (idempotent: aman dipanggil walau token kosong/sudah dicabut)
    if (cookieToken) {
      await authService.logout(cookieToken);
    }

    clearRefreshCookie(res);

    res.status(200).json({
      status: 'success',
      message: 'Logout berhasil',
    });
  } catch (e) {
    next(e);
  }
};

export default {
  login,
  register,
  refresh_token,
  logout,
};