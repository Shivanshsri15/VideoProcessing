import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { VideoTaskMetadata } from '../types/video-task-metadata.js';
import {
  VIDEO_TASK_STATUSES,
  type VideoTaskStatus,
} from '../types/video-task-status.js';

export type VideoTaskDocument = HydratedDocument<VideoTask>;

@Schema({ timestamps: true, collection: 'video_tasks' })
export class VideoTask {
  @Prop({ required: true, unique: true, index: true })
  taskId!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    enum: VIDEO_TASK_STATUSES,
    default: 'queued',
  })
  status!: VideoTaskStatus;

  @Prop({ required: true })
  s3Key!: string;

  @Prop({
    type: {
      durationSec: { type: Number, required: true },
    },
    required: true,
    _id: false,
  })
  metadata!: VideoTaskMetadata;

  @Prop({ required: true, default: 0, min: 0, max: 100 })
  progress!: number;

  @Prop({ required: true })
  etaSeconds!: number;

  @Prop({ required: false })
  failureReason?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const VideoTaskSchema = SchemaFactory.createForClass(VideoTask);
VideoTaskSchema.index({ userId: 1, createdAt: -1 });
