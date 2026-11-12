import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../redis/redis.service.js';
import { UsersService } from '../users/users.service.js';
import type { PublicUser } from '../users/types/public-user.js';
import { AuthCredentialsDto } from './dto/auth-credentials.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import type {
  AuthenticatedUser,
  JwtPayload,
} from './types/jwt-payload.js';

@Injectable()
export class AuthService {
  private readonly denyPrefix = 'jwt:deny:';

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  handleRegister = async (dto: AuthCredentialsDto): Promise<PublicUser> => {
    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
    });
    return this.usersService.toPublic(user);
  };

  handleLogin = async (
    dto: AuthCredentialsDto,
  ): Promise<{
    accessToken: string;
    tokenType: 'Bearer';
    expiresIn: string;
    user: PublicUser;
  }> => {
    const user = await this.usersService.findByEmail(dto.email, true);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.signAccessToken({
      sub: user.id as string,
      email: user.email,
      tv: user.tokenVersion,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '5h'),
      user: this.usersService.toPublic(user),
    };
  };

  handleChangePassword = async (
    currentUser: AuthenticatedUser,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> => {
    const user = await this.usersService.findByEmail(currentUser.email, true);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Unauthorized');
    }

    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.usersService.updatePasswordAndBumpTokenVersion(
      currentUser.id,
      passwordHash,
    );
    await this.denyToken(currentUser.jti, currentUser.exp);

    return { message: 'Password changed' };
  };

  handleLogout = async (
    currentUser: AuthenticatedUser,
  ): Promise<{ message: string }> => {
    await this.denyToken(currentUser.jti, currentUser.exp);
    return { message: 'Logged out' };
  };

  isTokenDenied = async (jti: string): Promise<boolean> =>
    this.redis.exists(`${this.denyPrefix}${jti}`);

  private hashPassword = async (password: string): Promise<string> => {
    const cost = Number(this.config.get<string>('BCRYPT_COST') ?? 12);
    return bcrypt.hash(password, cost);
  };

  private signAccessToken = async (input: {
    sub: string;
    email: string;
    tv: number;
  }): Promise<string> => {
    const payload: JwtPayload = {
      sub: input.sub,
      email: input.email,
      jti: randomUUID(),
      tv: input.tv,
    };
    return this.jwtService.signAsync(payload);
  };

  private denyToken = async (jti: string, exp?: number): Promise<void> => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttlSeconds = exp ? exp - nowSeconds : 5 * 60 * 60;
    if (ttlSeconds <= 0) {
      return;
    }
    await this.redis.setWithTtlSeconds(
      `${this.denyPrefix}${jti}`,
      '1',
      ttlSeconds,
    );
  };
}
