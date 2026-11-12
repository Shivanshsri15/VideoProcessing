import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service.js';
import { AuthService } from '../auth.service.js';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../types/jwt-payload.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Nest/Passport require a prototype method for strategy validate hooks.
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    return this.validateToken(payload);
  }

  private readonly validateToken = async (
    payload: JwtPayload,
  ): Promise<AuthenticatedUser> => {
    if (!payload?.sub || !payload?.jti || payload.tv === undefined) {
      throw new UnauthorizedException('Unauthorized');
    }

    const denied = await this.authService.isTokenDenied(payload.jti);
    if (denied) {
      throw new UnauthorizedException('Unauthorized');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    if (payload.tv !== user.tokenVersion) {
      throw new UnauthorizedException('Unauthorized');
    }

    return {
      id: user.id as string,
      email: user.email,
      tokenVersion: user.tokenVersion,
      jti: payload.jti,
      exp: payload.exp,
    };
  };
}
