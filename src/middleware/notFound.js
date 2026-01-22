import { AppError } from '../utils/appError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export const notFound = (req, res, next) => {
  next(
    new AppError(
      `Route ${req.originalUrl} not found`,
      HTTP_STATUS.NOT_FOUND
    )
  );
};
