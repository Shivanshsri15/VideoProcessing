import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  FFPROBE_DEFAULT_PATH,
  FFPROBE_DURATION_ARGS,
} from './constants/ffprobe.constants.js';
import type { FfprobeJson } from './types/ffprobe-json.js';

const execFileAsync = promisify(execFile);

@Injectable()
export class FfprobeService {
  private readonly logger = new Logger(FfprobeService.name);
  private readonly ffprobePath: string;

  constructor(config: ConfigService) {
    this.ffprobePath = config.get<string>(
      'FFPROBE_PATH',
      FFPROBE_DEFAULT_PATH,
    );
  }

  getDurationSeconds = async (filePath: string): Promise<number> => {
    try {
      const { stdout } = await execFileAsync(
        this.ffprobePath,
        [...FFPROBE_DURATION_ARGS, filePath],
        { windowsHide: true },
      );
      const parsed = JSON.parse(stdout) as FfprobeJson;
      const duration = Number(parsed.format?.duration);
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error('invalid duration');
      }
      return duration;
    } catch (error) {
      this.logger.error(`FFprobe failed for path=${filePath}`, error);
      throw new UnprocessableEntityException(
        'Unable to read video duration',
      );
    }
  };
}
