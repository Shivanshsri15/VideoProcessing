import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { GetUser } from './decorators/get-user.decorator.js';
import { AuthCredentialsDto } from './dto/auth-credentials.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { UserThrottlerGuard } from './guards/user-throttler.guard.js';
import type { AuthenticatedUser } from './types/jwt-payload.js';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Use case: create a new user account (no access token issued).
   */
  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: AuthCredentialsDto) {
    return this.authService.handleRegister(dto);
  }

  /**
   * Use case: authenticate with email/password and receive a JWT access token.
   */
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: AuthCredentialsDto) {
    return this.authService.handleLogin(dto);
  }

  /**
   * Use case: change password, bump token version (all sessions), denylist current JWT ID.
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  changePassword(
    @GetUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.handleChangePassword(user, dto);
  }

  /**
   * Use case: logout by denylisting the current access token JWT ID in Redis.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  logout(@GetUser() user: AuthenticatedUser) {
    return this.authService.handleLogout(user);
  }
}
