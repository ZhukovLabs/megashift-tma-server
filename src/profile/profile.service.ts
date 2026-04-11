import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    Logger.log('meow');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        surname: true,
        patronymic: true,
        createdAt: true,
        timezone: true,
        notifyBeforeMinutes: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('No data provided');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        name: true,
        surname: true,
        patronymic: true,
        createdAt: true,
        timezone: true,
        notifyBeforeMinutes: true,
      },
    });
  }
}
