import type { ApiResponse, ValidationErrorResponse, AppError } from '~/types';

/** User-friendly Mongolian messages for known error codes. */
export function getUserFriendlyMessage(code: string | undefined, fallback?: string): string {
  switch (code) {
    case 'UNAUTHORIZED':
      return 'Нэвтрэлт дууссан. Дахин нэвтэрнэ үү.';
    case 'FORBIDDEN':
      return 'Танд энэ салбарын захиалгад эрх алга байна.';
    case 'INSUFFICIENT_STOCK':
      return 'Нөөц хүрэлцэхгүй байна';
    case 'SERVER_ERROR':
    case 'INTERNAL_SERVER_ERROR':
    case 'INTERNAL_ERROR':
      return 'Серверийн алдаа. Дахин оролдоно уу.';
    case 'NETWORK_ERROR':
      return 'Холболт амжилтгүй. Дахин оролдоно уу.';
    default:
      return fallback ?? 'Алдаа гарлаа. Дахин оролдоно уу.';
  }
}

/** True if error is retriable (network/server). Do not retry for VALIDATION_ERROR or auth. */
export function isRetriableError(err: { code?: string }): boolean {
  const code = err?.code;
  return (
    code === 'NETWORK_ERROR' ||
    code === 'SERVER_ERROR' ||
    code === 'INTERNAL_SERVER_ERROR' ||
    code === 'INTERNAL_ERROR'
  );
}

/**
 * Normalize API error (network, 4xx/5xx, validation) into a single AppError.
 */
export function normalizeError(
  err: unknown,
  status?: number
): AppError {
  if (err && typeof err === 'object' && 'response' in err) {
    const ax = (err as { response?: { data?: unknown; status?: number } }).response;
    if (ax?.data && typeof ax.data === 'object') {
      const data = ax.data as ApiResponse | ValidationErrorResponse;
      const resStatus = ax?.status ?? status ?? 0;
      const code =
        resStatus >= 500 && !data.code ? 'SERVER_ERROR' : (data.code ?? 'UNKNOWN');
      const requestId = 'request_id' in data ? data.request_id : undefined;
      if (code === 'VALIDATION_ERROR' && 'errors' in data) {
        const valData = data as ValidationErrorResponse & { message?: string };
        const message = typeof valData.message === 'string' ? valData.message : 'Validation failed';
        return {
          code,
          message,
          request_id: requestId,
          status: resStatus,
          fieldErrors: data.errors,
        };
      }
      const message =
        'message' in data && typeof (data as { message?: string }).message === 'string'
          ? (data as { message: string }).message
          : `Request failed (${ax?.status ?? status ?? '?'})`;
      return {
        code,
        message,
        request_id: requestId,
        status: resStatus,
      };
    }
    const msg = err instanceof Error ? err.message : 'Network request failed';
    return { code: 'NETWORK_ERROR', message: msg, status: ax?.status ?? status };
  }
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'An error occurred';
  return { code: 'UNKNOWN', message, status };
}

/** Message for Alert – always Mongolian; never show raw "Internal error" or backend message. Log original in dev. */
export function getAlertMessage(err: AppError): string {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log('[getAlertMessage] original error:', err.code, err.message, err.status);
  }
  return getUserFriendlyMessage(err.code);
}
