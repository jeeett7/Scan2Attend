const jwt = require('jsonwebtoken')

function authenticate(request, response, next) {
  const authorization = request.headers.authorization

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return response.status(401).json({
      message: 'Login is required.'
    })
  }

  const token = authorization.slice(7)

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET,
      { issuer: 'scan2attend' }
    )

    request.user = {
      id: payload.userId,
      role: payload.role,
      issuedAt: payload.iat
    }

    next()
  } catch {
    return response.status(401).json({
      message: 'Your login session has expired. Please log in again.'
    })
  }
}

function authorizeRoles(...allowedRoles) {
  return (request, response, next) => {
    if (!allowedRoles.includes(request.user.role)) {
      return response.status(403).json({
        message: 'You do not have permission to access this data.'
      })
    }

    next()
  }
}

module.exports = {
  authenticate,
  authorizeRoles
}
