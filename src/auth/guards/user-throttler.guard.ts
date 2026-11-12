import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limits authenticated routes by user id (JWT must run first).
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { id?: string } | undefined;
    if (user?.id) {
      return `user:${user.id}`;
    }
    return this.getIpTracker(req);
  }

  private getIpTracker = (req: Record<string, unknown>): string => {
    const ip = req.ip;
    if (typeof ip === 'string' && ip.length > 0) {
      return ip;
    }
    return 'unknown';
  };
}
