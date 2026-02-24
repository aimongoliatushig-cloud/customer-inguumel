import { api } from './client';
import { config } from '~/constants/config';
import { normalizeError } from '~/utils/errors';
import type { ApiResponse, ValidationErrorResponse, AppError } from '~/types';
import type { RegisterRequest, RegisterResponseData } from '~/types/auth';

const REGISTER_ENDPOINT = config.registerEndpoint;

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
    // eslint-disable-next-line no-console
    console.log('AUTH RAW', res?.status, res?.data);
    // eslint-disable-next-line no-console
    console.log('AUTH RAW STRING', JSON.stringify(res?.data));
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
