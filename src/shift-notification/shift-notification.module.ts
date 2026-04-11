import { Module, DynamicModule } from '@nestjs/common';
import { ShiftNotificationService } from './shift-notification.service';
import { NotificationModule } from '../notification/notification.module';
import { RedisModule } from '../redis/redis.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({})
export class ShiftNotificationModule {
  static async forRoot(): Promise<DynamicModule> {
    const notificationModule = await NotificationModule.forRoot();

    return {
      module: ShiftNotificationModule,
      imports: [notificationModule, RedisModule],
      providers: [ShiftNotificationService, PrismaService],
      exports: [ShiftNotificationService],
    };
  }
}