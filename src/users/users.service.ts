import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema.js';
import type { PublicUser } from './types/public-user.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  toPublic = (user: UserDocument): PublicUser => ({
    id: user.id as string,
    email: user.email,
    createdAt: user.createdAt,
  });

  create = async (input: {
    email: string;
    passwordHash: string;
  }): Promise<UserDocument> => {
    try {
      return await this.userModel.create({
        email: input.email,
        passwordHash: input.passwordHash,
        tokenVersion: 0,
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  };

  findByEmail = async (
    email: string,
    withPassword = false,
  ): Promise<UserDocument | null> => {
    const query = this.userModel.findOne({ email: email.toLowerCase() });
    if (withPassword) {
      query.select('+passwordHash');
    }
    return query.exec();
  };

  findById = async (id: string): Promise<UserDocument | null> =>
    this.userModel.findById(id).exec();

  findByIdOrThrow = async (id: string): Promise<UserDocument> => {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  };

  updatePasswordAndBumpTokenVersion = async (
    userId: string,
    passwordHash: string,
  ): Promise<UserDocument> => {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: { passwordHash },
          $inc: { tokenVersion: 1 },
        },
        { new: true },
      )
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  };
}
