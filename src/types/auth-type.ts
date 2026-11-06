interface RegisterAccountRequest {
  username: string;
  email: string;
  password: string
}

interface LoginAccountRequest {
  identifier: string;
  password: string;
}

interface LoginAccountResponse {
  accessToken: string;
  refreshToken: string;
}

export type {
  RegisterAccountRequest,
  LoginAccountRequest,
  LoginAccountResponse
}