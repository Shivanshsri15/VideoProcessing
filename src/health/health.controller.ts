import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  /**
   * Use case: liveness probe for the API process (M0).
   * Confirms the NestJS server is up; does not check Mongo, Redis, or S3.
   */
  @Get()
  check(): { status: string } {
    return this.handleCheck();
  }

  private readonly handleCheck = (): { status: string } => ({
    status: 'ok',
  });
}
