export class HttpError extends Error {
  readonly statusCode: number;
  readonly expose: boolean;

  constructor(statusCode: number, message: string, options: { expose?: boolean } = {}) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.expose = options.expose ?? statusCode < 500;
  }
}

export function badRequest(message: string) {
  return new HttpError(400, message);
}

export function serviceUnavailable(message: string) {
  return new HttpError(503, message, { expose: true });
}

export function badGateway(message: string) {
  return new HttpError(502, message, { expose: true });
}
