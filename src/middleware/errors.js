// SupportDesk – øverste fejlhåndtering.
// Alle kastede fejl samles her, så API'et altid svarer med JSON og aldrig crasher.

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (message) => new ApiError(400, message);
export const notFound = (message) => new ApiError(404, message);
export const conflict = (message) => new ApiError(409, message);
export const forbidden = (message) => new ApiError(403, message);

// eslint-disable-next-line no-unused-vars -- Express kræver 4 parametre for fejl-middleware
export function errorHandler(err, req, res, next) {
  // Mongoose: ugyldigt ObjectId eller valideringsfejl => kontrolleret 400/404
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Ugyldigt id-format' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: Object.values(err.errors).map(e => e.message).join('. ') });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }
  // Rigtig uventet fejl: logges, men serveren svarer stadig kontrolleret
  console.error('Uventet fejl:', err);
  return res.status(500).json({ error: 'Der opstod en uventet fejl på serveren' });
}
