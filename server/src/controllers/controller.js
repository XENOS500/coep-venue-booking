// HTTP adapters only; validation and business rules live in their respective layers.
export const respond =
  (handler, status = 200, envelope = true) =>
  async (req, res, next) => {
    try {
      const result = await handler(req);
      res.status(status).json(envelope ? { data: result } : result);
    } catch (e) {
      next(e);
    }
  };
