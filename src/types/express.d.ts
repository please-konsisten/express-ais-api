// Menambah properti ke Request Express. Diisi oleh middleware authenticate dan validate.
export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        roleId: string;
        isSuperAdmin: boolean;
        permissions: string[];
      };
      // req.query read-only di Express 5, jadi hasil validasi query disimpan di sini
      validatedQuery?: unknown;
    }
  }
}
