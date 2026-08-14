export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// Translates raw Prisma error codes into safe, actionable messages instead
// of leaking internal query/ORM details to the client.
function describePrismaError(error) {
  if (error.code === "P2003") {
    return {
      statusCode: 409,
      message: "This action references a record that no longer exists (e.g. a deleted employee). Please refresh and try again.",
    };
  }
  if (error.code === "P2025") {
    return { statusCode: 404, message: "The record you tried to update or delete was not found." };
  }
  return null;
}

export function errorHandler(error, req, res, next) {
  console.error("API Error:", error);

  if (res.headersSent) {
    return next(error);
  }

  const prismaMatch = error.name === "PrismaClientKnownRequestError" ? describePrismaError(error) : null;
  const statusCode = prismaMatch?.statusCode || error.statusCode || error.status || 500;
  const message = prismaMatch?.message || error.message || "Internal server error.";

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development"
      ? { stack: error.stack }
      : {}),
  });
}