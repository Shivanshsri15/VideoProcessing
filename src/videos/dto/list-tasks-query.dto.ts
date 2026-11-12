import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  DEFAULT_TASK_LIST_LIMIT,
  MAX_TASK_LIST_LIMIT,
} from '../constants/task-list.constants.js';

export class ListTasksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_TASK_LIST_LIMIT)
  limit: number = DEFAULT_TASK_LIST_LIMIT;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip: number = 0;
}
