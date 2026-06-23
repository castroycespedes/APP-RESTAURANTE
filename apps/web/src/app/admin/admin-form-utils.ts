export function isStrongTemporaryPassword(value: string) {
  return /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() as unknown : await response.text();

  if (!response.ok) {
    if (typeof payload === 'object' && payload && 'message' in payload) {
      const message = (payload as { message: string | string[] }).message;
      throw new Error(Array.isArray(message) ? message.join(', ') : message);
    }

    throw new Error(typeof payload === 'string' && payload ? payload : httpStatusMessage(response.status));
  }

  return payload as T;
}

function httpStatusMessage(status: number) {
  if (status === 400) return 'Revisa los datos e intenta nuevamente.';
  if (status === 401) return 'Sesion expirada o token invalido. Inicia sesion nuevamente.';
  if (status === 403) return 'No tienes permiso para realizar esta accion.';
  if (status === 404) return 'No se encontro la informacion solicitada.';
  if (status >= 500) return 'Ocurrio un error en el servidor.';
  return `Error HTTP ${status}`;
}
