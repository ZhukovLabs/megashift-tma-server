import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const isMaintenance = process.env.MAINTENANCE_MODE === 'true';

    if (isMaintenance) {
      const req = context.switchToHttp().getRequest();
      
      // Исключаем пути, которые должны работать всегда (например, health check или webhook)
      const excludedPaths = ['/health', '/telegram/webhook'];
      if (excludedPaths.includes(req.path)) {
        return true;
      }

      throw new ServiceUnavailableException({
        statusCode: 503,
        message: 'System is under maintenance. Please try again later.',
        error: 'Maintenance',
      });
    }

    return true;
  }
}
