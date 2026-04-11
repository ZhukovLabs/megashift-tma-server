import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { ProfileModule } from './profile/profile.module';
import { ShiftTemplateModule } from './shift-template/shift-template.module';
import { ShiftModule } from './shift/shift.module';
import { StatisticModule } from './statistic/statistic.module';
import { SettingModule } from './setting/setting.module';
import { AccessModule } from './access/access.module';
import { InviteModule } from './invite/invite.module';
import { TelegramModule } from './telegram/telegram.module';
import { NotificationModule } from './notification/notification.module';
import { ShiftNotificationModule } from './shift-notification/shift-notification.module';
import { WinstonLogger } from './logger/winston-logger.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './utils/interceptors/logging.interceptor';
import { AppController } from './app.controller';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    UserModule,
    AccessModule,
    InviteModule,
    ProfileModule,
    ShiftModule,
    ShiftTemplateModule,
    StatisticModule,
    SettingModule,
    TelegramModule.forRoot(),
    NotificationModule.forRoot(),
    ShiftNotificationModule.forRoot(),
  ],
  providers: [
    WinstonLogger,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
  controllers: [AppController],
})
export class AppModule {}
