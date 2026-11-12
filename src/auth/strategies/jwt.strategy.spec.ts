import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtStrategy } from './jwt.strategy.js';

describe('JwtStrategy', () => {
  const usersService = {
    findById: vi.fn(),
  };
  const authService = {
    isTokenDenied: vi.fn(),
  };

  let strategy: JwtStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new JwtStrategy(
      {
        getOrThrow: vi.fn().mockReturnValue('test-secret'),
      } as unknown as ConfigService,
      usersService as never,
      authService as never,
    );
  });

  it('rejects denylisted JWT IDs', async () => {
    authService.isTokenDenied.mockResolvedValue(true);

    await expect(
      strategy.validate({
        sub: 'u1',
        email: 'a@example.com',
        jti: 'jwt-1',
        tv: 0,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects mismatched token versions', async () => {
    authService.isTokenDenied.mockResolvedValue(false);
    usersService.findById.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      tokenVersion: 2,
    });

    await expect(
      strategy.validate({
        sub: 'u1',
        email: 'a@example.com',
        jti: 'jwt-1',
        tv: 0,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a valid token with matching token version', async () => {
    authService.isTokenDenied.mockResolvedValue(false);
    usersService.findById.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      tokenVersion: 1,
    });

    await expect(
      strategy.validate({
        sub: 'u1',
        email: 'a@example.com',
        jti: 'jwt-1',
        tv: 1,
        exp: 123,
      }),
    ).resolves.toEqual({
      id: 'u1',
      email: 'a@example.com',
      tokenVersion: 1,
      jti: 'jwt-1',
      exp: 123,
    });
  });
});
