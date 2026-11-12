import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const usersService = {
    create: vi.fn(),
    toPublic: vi.fn(),
    findByEmail: vi.fn(),
    updatePasswordAndBumpTokenVersion: vi.fn(),
  };
  const jwtService = {
    signAsync: vi.fn(),
  };
  const redis = {
    exists: vi.fn(),
    setWithTtlSeconds: vi.fn(),
  };
  const config = {
    get: vi.fn((key: string, fallback?: string) => {
      if (key === 'JWT_EXPIRES_IN') return '5h';
      if (key === 'BCRYPT_COST') return '4';
      return fallback;
    }),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      usersService as never,
      jwtService as unknown as JwtService,
      redis as never,
      config as unknown as ConfigService,
    );
  });

  it('registers a user without issuing a token', async () => {
    const created = {
      id: 'u1',
      email: 'a@example.com',
      createdAt: new Date(),
    };
    usersService.create.mockResolvedValue(created);
    usersService.toPublic.mockReturnValue(created);

    const result = await service.handleRegister({
      email: 'a@example.com',
      password: 'password123',
    });

    expect(usersService.create).toHaveBeenCalledOnce();
    expect(result).toEqual(created);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejects login with invalid credentials', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.handleLogin({ email: 'a@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('denylists JWT ID on logout', async () => {
    redis.setWithTtlSeconds.mockResolvedValue(undefined);
    const exp = Math.floor(Date.now() / 1000) + 3600;

    const result = await service.handleLogout({
      id: 'u1',
      email: 'a@example.com',
      tokenVersion: 0,
      jti: 'jwt-1',
      exp,
    });

    expect(result).toEqual({ message: 'Logged out' });
    expect(redis.setWithTtlSeconds).toHaveBeenCalledWith(
      'jwt:deny:jwt-1',
      '1',
      expect.any(Number),
    );
  });

  it('bumps token version path and denylists JWT ID on password change', async () => {
    const hash = await import('bcrypt').then((b) =>
      b.hash('password123', 4),
    );
    usersService.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      passwordHash: hash,
      tokenVersion: 0,
    });
    usersService.updatePasswordAndBumpTokenVersion.mockResolvedValue({
      id: 'u1',
      tokenVersion: 1,
    });
    redis.setWithTtlSeconds.mockResolvedValue(undefined);

    const exp = Math.floor(Date.now() / 1000) + 3600;
    const result = await service.handleChangePassword(
      {
        id: 'u1',
        email: 'a@example.com',
        tokenVersion: 0,
        jti: 'jwt-1',
        exp,
      },
      { currentPassword: 'password123', newPassword: 'password456' },
    );

    expect(result).toEqual({ message: 'Password changed' });
    expect(usersService.updatePasswordAndBumpTokenVersion).toHaveBeenCalledWith(
      'u1',
      expect.any(String),
    );
    expect(redis.setWithTtlSeconds).toHaveBeenCalledWith(
      'jwt:deny:jwt-1',
      '1',
      expect.any(Number),
    );
  });

  it('reports denylisted JWT IDs', async () => {
    redis.exists.mockResolvedValue(true);
    await expect(service.isTokenDenied('jwt-1')).resolves.toBe(true);
    expect(redis.exists).toHaveBeenCalledWith('jwt:deny:jwt-1');
  });
});
