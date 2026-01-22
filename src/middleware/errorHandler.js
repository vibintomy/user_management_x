import { AppError } from '../utils/appError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export const errorHandler = (err, req, res, next) => {
  let error = err;

  // Default error
  if (!error.statusCode) {
    error = new AppError(
      'Internal Server Error',
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  // Mongoose CastError
  if (err.name === 'CastError') {
    error = new AppError(
      'Resource not found',
      HTTP_STATUS.NOT_FOUND
    );
  }

  // Duplicate key
  if (err.code === 11000) {
    error = new AppError(
      'Duplicate field value',
      HTTP_STATUS.CONFLICT
    );
  }

  // Validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map(e => e.message)
      .join(', ');
    error = new AppError(
      message,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message
  });
};
