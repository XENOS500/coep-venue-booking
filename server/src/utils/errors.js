export class AppError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    Object.assign(this, { status, code, extra });
  }
}
export const fail = (status, code, message, extra) => {
  throw new AppError(status, code, message, extra);
};
