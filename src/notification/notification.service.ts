import { Injectable, Inject } from '@nestjs/common';
import { Bot } from 'grammy';
import { TELEGRAM_BOT } from '../telegram/telegram-bot.provider';

export interface SendNotificationOptions {
  chatId: number;
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
}

@Injectable()
export class NotificationService {
  constructor(@Inject(TELEGRAM_BOT) private bot: Bot) {}

  async send(options: SendNotificationOptions): Promise<boolean> {
    try {
      await this.bot.api.sendMessage(options.chatId, options.text, {
        parse_mode: options.parseMode || 'HTML',
      });
      return true;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return false;
    }
  }

  async sendToUser(userId: string, text: string): Promise<boolean> {
    const chatId = parseInt(userId, 10);
    if (isNaN(chatId)) {
      console.error('Invalid user ID:', userId);
      return false;
    }
    return this.send({ chatId, text });
  }
}