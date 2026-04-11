import { Module, DynamicModule } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({})
export class NotificationModule {
  static async forRoot(): Promise<DynamicModule> {
    const telegramModule = await TelegramModule.forRoot();

    return {
      module: NotificationModule,
      imports: [telegramModule],
      providers: [NotificationService],
      exports: [NotificationService],
    };
  }
}