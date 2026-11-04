// ------------ User Request ------------ //
export interface RegisterUserRequest {
  username: string;
  password: string;
  name: string;
}

export interface LoginUserRequest {
  username: string;
  password: string;
}

export interface UpdateUserRequest {
  username: string;
  password?: string;
  name?: string;
}