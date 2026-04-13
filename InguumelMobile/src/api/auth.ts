import { api } from './client';
import { config, isDev } from '~/constants/config';
import { normalizeError } from '~/utils/errors';
import type { ApiResponse, ValidationErrorResponse, AppError } from '~/types';
import type {
  DeleteAccountResponseData,
  RegisterRequest,
  RegisterResponseData,
} from '~/types/auth';

const REGISTER_ENDPOINT = config.registerEndpoint;
const DELETE_ACCOUNT_ENDPOINT = config.deleteAccountEndpoint;

/**
 * Register user. Sends { phone, pin, pin_confirm }. Throws normalized AppError on failure.
 */
export async function register(
  payload: RegisterRequest
): Promise<RegisterResponseData> {
  try {
    const res = await api.post<ApiResponse<RegisterResponseData>>(
      REGISTER_ENDPOINT,
      payload
    );
    if (isDev) {
      console.log('AUTH RAW', res?.status, res?.data);
      console.log('AUTH RAW STRING', JSON.stringify(res?.data));
    }
    const body = res.data;
    if (!body.success) {
      const code = body.code ?? 'UNKNOWN';
      const requestId = body.request_id;
      if (code === 'VALIDATION_ERROR' && 'errors' in body) {
        const errBody = body as ValidationErrorResponse;
        throw {
          code,
          message: body.message ?? 'Validation failed',
          request_id: requestId,
          status: res.status,
          fieldErrors: errBody.errors,
        } as AppError;
      }
      throw {
        code,
        message: body.message ?? 'Request failed',
        request_id: requestId,
        status: res.status,
      } as AppError;
    }
    return body.data ?? null;
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
      throw err as AppError;
    }
    const appErr = normalizeError(err);
    if (appErr.message.toLowerCase().includes('timeout')) {
      throw { ...appErr, code: 'TIMEOUT' } as AppError;
    }
    throw appErr;
  }
}

export async function deleteAccount(): Promise<DeleteAccountResponseData> {
  try {
    const res = await api.post<ApiResponse<DeleteAccountResponseData>>(
      DELETE_ACCOUNT_ENDPOINT
    );
    const body = res.data;
    if (!body.success) {
      throw {
        code: body.code ?? 'UNKNOWN',
        message: body.message ?? 'Request failed',
        request_id: body.request_id,
        status: res.status,
      } as AppError;
    }
    return body.data ?? { deleted: true };
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
      throw err as AppError;
    }
    const appErr = normalizeError(err);
    if (isDev && appErr.message.toLowerCase().includes('timeout')) {
      throw { ...appErr, code: 'TIMEOUT' } as AppError;
    }
    throw appErr;
  }
}
