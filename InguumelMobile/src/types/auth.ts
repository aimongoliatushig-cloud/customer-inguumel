/** Register: POST /api/v1/auth/register */
export type RegisterRequest = {
  phone: string;
  pin: string;
  pin_confirm: string;
};

/** Login: POST /api/v1/auth/login */
export type LoginRequest = {
  phone: string;
  pin: string;
};

/** Register 200 OK → data: { user_id } */
export type RegisterResponseData = { user_id: number } | null;

export type DeleteAccountResponseData =
  | {
      deleted: boolean;
      retention_note?: string | null;
    }
  | null;
