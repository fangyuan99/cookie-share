import type { ErrorPayload } from "./types";

export class HttpError extends Error {
  public readonly status: number;
  public readonly payload: ErrorPayload;
  public readonly plain: boolean;

  public constructor(
    status: number,
    message: string,
    payload?: ErrorPayload,
    options?: { plain?: boolean },
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.payload = payload ?? { success: false, message };
    this.plain = Boolean(options?.plain);
  }
}
