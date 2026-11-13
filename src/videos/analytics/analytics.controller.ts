import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetUser } from '../../auth/decorators/get-user.decorator.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { UserThrottlerGuard } from '../../auth/guards/user-throttler.guard.js';
import type { AuthenticatedUser } from '../../auth/types/jwt-payload.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('api/videos')
@UseGuards(JwtAuthGuard, UserThrottlerGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** DevOps processing stats from video_tasks (+ caller activity). */
  @Get('analytics')
  getAnalytics(@GetUser() user: AuthenticatedUser) {
    return this.analytics.getAnalytics(user.id);
  }

  /** BullMQ queue depth / wait estimate / concurrency. */
  @Get('queue')
  getQueue() {
    return this.analytics.getQueueSnapshot();
  }

  /** API process resource snapshot + worker concurrency config. */
  @Get('system')
  getSystem() {
    return this.analytics.getSystem();
  }
}
