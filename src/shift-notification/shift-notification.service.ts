import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';
import { NotificationService } from '../notification/notification.service';
import { REDIS } from '../redis/redis.provider';
import { RedisClientType } from 'redis';
import { isBefore, addMinutes, subMinutes, startOfDay } from 'date-fns';

@Injectable()
export class ShiftNotificationService {
  private readonly logger = new Logger(ShiftNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    @Inject(REDIS) private readonly redis: RedisClientType,
  ) {
    this.logger.log('ShiftNotificationService initialized');
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleShiftNotifications() {
    const now = new Date();
    console.log(`[ShiftNotification] Tick at ${now.toISOString()}`);

    try {
      const users = await this.prisma.user.findMany({
        where: { notifyBeforeMinutes: { gt: 0 } },
        select: { id: true, timezone: true, notifyBeforeMinutes: true },
      });

      for (const user of users) {
        const { id: userId, timezone, notifyBeforeMinutes: minutesBefore } = user;

        const shifts = await this.prisma.shift.findMany({
          where: {
            ownerId: userId,
            shiftTemplateId: { not: null },
            date: {
              gte: startOfDay(subMinutes(now, 1440)),
              lte: startOfDay(addMinutes(now, 1440)),
            },
          },
          include: { shiftTemplate: true },
        });

        for (const shift of shifts) {
          const template = shift.shiftTemplate;
          if (!template) continue;

          // 1. Получаем часы и минуты начала смены из template.startTime
          // template.startTime хранится как UTC-время, но представляет "настенное" время пользователя
          const hours = template.startTime.getUTCHours();
          const minutes = template.startTime.getUTCMinutes();

          // 2. Получаем дату смены (shift.date хранится как UTC midnight)
          const shiftDate = new Date(shift.date);
          const year = shiftDate.getUTCFullYear();
          const month = shiftDate.getUTCMonth();
          const day = shiftDate.getUTCDate();

          // 3. Создаем дату-время начала смены как "настенное" время в таймзоне пользователя
          // Например, если смена 15 января в 09:00 в Europe/Moscow,
          // то shiftStartWallClock = 2025-01-15T09:00:00 (без таймзоны, но подразумевается Europe/Moscow)
          const shiftStartWallClock = new Date(year, month, day, hours, minutes, 0);

          // 4. Конвертируем "настенное" время из таймзоны пользователя в UTC
          const shiftStartUTC = fromZonedTime(shiftStartWallClock, timezone);

          const diffMs = shiftStartUTC.getTime() - now.getTime();
          const minutesUntilShift = Math.floor(diffMs / 60000);

          console.log(`[ShiftNotification] User ${userId}, Shift "${template.label}":
            Date: ${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}
            Time (${timezone}): ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}
            Target UTC: ${shiftStartUTC.toISOString()}
            Current UTC: ${now.toISOString()}
            Diff minutes: ${minutesUntilShift} (Setting: ${minutesBefore})`);

          if (minutesUntilShift < -60) continue; 

          const isUpcoming = minutesUntilShift >= 0 && minutesUntilShift <= minutesBefore;

          if (isUpcoming) {
            const redisKey = `shift_notify_v6:${userId}:${shift.id}`;
            const alreadyNotified = await this.redis.get(redisKey);

            if (!alreadyNotified) {
              await this.sendNotification(userId, {
                label: template.label,
                startTime: shiftStartUTC,
                minutesUntil: minutesUntilShift,
                timezone,
              });
              await this.redis.set(redisKey, '1', { EX: 86400 });
            }
          }
        }
      }
    } catch (error) {
      console.error('[ShiftNotification] Error:', error);
    }
  }

  private async sendNotification(
    userId: string,
    {
      label,
      startTime,
      minutesUntil,
      timezone,
    }: {
      label: string;
      startTime: Date;
      minutesUntil: number;
      timezone: string;
    },
  ) {
    const zonedTime = format(toZonedTime(startTime, timezone), 'HH:mm');
    const text = `⏰ <b>Напоминание о смене</b>\n\nЧерез ${minutesUntil} мин (${zonedTime}) начнётся смена: <b>${label}</b>`;

    try {
      await this.notificationService.sendToUser(userId, text);
      console.log(`[ShiftNotification] SUCCESS: Sent to ${userId}`);
    } catch (e) {
      console.error(`[ShiftNotification] FAILED to send: ${e.message}`);
    }
  }
}
