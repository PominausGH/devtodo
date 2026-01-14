function authMiddleware(req, res, next) {
  const apiToken = process.env.API_TOKEN;

  // If no API_TOKEN is configured, skip auth (development mode)
  if (!apiToken) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid authorization header format' });
  }

  const token = parts[1];

  if (token !== apiToken) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  next();
}

module.exports = { authMiddleware };
