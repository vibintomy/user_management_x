import { jest } from '@jest/globals';
import httpMocks from 'node-mocks-http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* 🔴 MOCK FIRST */
jest.unstable_mockModule(path.resolve(__dirname, '../../models/user.js'), () => ({
  default: {
    findById: jest.fn(),
  },
}));

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: jest.fn(),
  },
}));

/* 🔴 IMPORT AFTER MOCK */
const jwt = (await import('jsonwebtoken')).default;
const User = (await import(path.resolve(__dirname, '../../models/user.js'))).default;
const { protect } = await import(path.resolve(__dirname, '../../middleware/auth.js'));

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks request without token', async () => {
    const req = httpMocks.createRequest();
    const res = httpMocks.createResponse();
    const next = jest.fn();

    await protect(req, res, next);
    
    expect(res.statusCode).toBe(401);
    const data = res._getJSONData();
    
    // Match your actual error message
    expect(data.message).toBe('Not authorized to access this route');
  });

  it('blocks request with invalid Bearer format', async () => {
    const req = httpMocks.createRequest({
      headers: { authorization: 'InvalidFormat token123' },
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();

    await protect(req, res, next);
    
    expect(res.statusCode).toBe(401);
  });

  it('blocks request with invalid token', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    const req = httpMocks.createRequest({
      headers: { authorization: 'Bearer invalidtoken' },
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();

    await protect(req, res, next);
    
    expect(res.statusCode).toBe(401);
  });

  it('allows valid token and attaches user to request', async () => {
    const mockUser = { 
      _id: '123', 
      name: 'Test User',
      email: 'test@example.com' 
    };

    jwt.verify.mockReturnValue({ id: '123' });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser)
    });

    const req = httpMocks.createRequest({
      headers: { authorization: 'Bearer validtoken' },
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();

    await protect(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(); // No error passed
    expect(req.user).toEqual(mockUser);
  });

  it('blocks request when user not found in database', async () => {
    jwt.verify.mockReturnValue({ id: '999' });
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null)
    });

    const req = httpMocks.createRequest({
      headers: { authorization: 'Bearer token' },
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();

    await protect(req, res, next);
    
    expect(res.statusCode).toBe(401);
  });

  it('handles expired token', async () => {
    jwt.verify.mockImplementation(() => {
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';
      throw error;
    });

    const req = httpMocks.createRequest({
      headers: { authorization: 'Bearer expiredtoken' },
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();

    await protect(req, res, next);
    
    expect(res.statusCode).toBe(401);
  });

  it('handles malformed token', async () => {
    jwt.verify.mockImplementation(() => {
      const error = new Error('jwt malformed');
      error.name = 'JsonWebTokenError';
      throw error;
    });

    const req = httpMocks.createRequest({
      headers: { authorization: 'Bearer malformedtoken' },
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();

    await protect(req, res, next);
    
    expect(res.statusCode).toBe(401);
  });
});