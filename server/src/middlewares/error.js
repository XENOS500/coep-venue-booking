import { ZodError } from "zod";
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof ZodError)
    return res
      .status(400)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Please correct the highlighted fields.",
          fields: err.flatten().fieldErrors,
        },
      });
  if (err.type === "entity.too.large")
    return res
      .status(413)
      .json({
        error: { code: "BODY_TOO_LARGE", message: "Request is too large." },
      });
  if (err instanceof SyntaxError && "body" in err)
    return res
      .status(400)
      .json({
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      });
  if (err.status)
    return res
      .status(err.status)
      .json({
        error: {
          code: err.code || "REQUEST_ERROR",
          message: err.message,
          ...err.extra,
        },
      });
  if (["P2002", "P2034"].includes(err.code))
    return res
      .status(409)
      .json({
        error: {
          code: "CONCURRENT_CHANGE",
          message: "A concurrent change occurred. Refresh and try again.",
        },
      });
  if (err.code === "P2025")
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Record not found." } });
  console.error(
    JSON.stringify({
      event: "request_error",
      method: req.method,
      code: err.code || err.name || "UNKNOWN",
    }),
  );
  res
    .status(500)
    .json({
      error: {
        code: "INTERNAL_ERROR",
        message: "The service could not complete your request.",
      },
    });
}
