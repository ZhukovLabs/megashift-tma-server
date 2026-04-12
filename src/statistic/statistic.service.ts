import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ShiftStatsItemCount = {
  id: string | null;
  color: string;
  shiftName: string;
  count: number;
};

type ShiftStatsItemHours = {
  id: string | null;
  color: string;
  shiftName: string;
  hours: number;
};

type SalaryStats = {
  salary: number;
  typeSalary: string;
  maxSalary: number | null;
};

type CombinedStats = {
  shifts: ShiftStatsItemCount[];
  hours: ShiftStatsItemHours[];
  salary: SalaryStats;
};

@Injectable()
export class StatisticService {
  constructor(private readonly prisma: PrismaService) {}

  private calculateHours(start: Date | null, end: Date | null): number {
    if (!start || !end) return 0;

    let diffMs = end.getTime() - start.getTime();

    // Если разница отрицательная, значит смена перешла через полночь (на след. день)
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000;
    }

    return diffMs / (1000 * 60 * 60);
  }

  async getCombinedStats(
    userId: string,
    year: number,
    month: number,
  ): Promise<CombinedStats> {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    const [shifts, user, templates] = await Promise.all([
      this.prisma.shift.findMany({
        where: {
          ownerId: userId,
          date: { gte: startDate, lt: endDate },
        },
        include: { shiftTemplate: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { salary: true, typeSalary: true, maxSalary: true },
      }),
      this.prisma.shiftTemplate.findMany({
        where: { ownerId: userId },
        select: { id: true, label: true, color: true },
        orderBy: { label: 'asc' },
      }),
    ]);

    const countMap = new Map<string | null, number>();
    const hoursMap = new Map<string | null, number>();

    for (const shift of shifts) {
      const templateId = shift.shiftTemplateId ?? null;
      countMap.set(templateId, (countMap.get(templateId) ?? 0) + 1);

      const start = shift.actualStartTime ?? shift.shiftTemplate?.startTime;
      const end = shift.actualEndTime ?? shift.shiftTemplate?.endTime;
      
      const hours = this.calculateHours(start, end);
      hoursMap.set(templateId, (hoursMap.get(templateId) ?? 0) + hours);
    }

    const shiftStats: ShiftStatsItemCount[] = templates.map((t) => ({
      id: t.id,
      color: t.color,
      shiftName: t.label,
      count: countMap.get(t.id) ?? 0,
    }));
    if (countMap.has(null)) {
      shiftStats.push({
        id: '0',
        color: '#ffbbee',
        shiftName: '(Без шаблона смены)',
        count: countMap.get(null) ?? 0,
      });
    }

    const hoursStats: ShiftStatsItemHours[] = templates.map((t) => ({
      id: t.id,
      color: t.color,
      shiftName: t.label,
      hours: hoursMap.get(t.id) ?? 0,
    }));
    if (hoursMap.has(null)) {
      hoursStats.push({
        id: '0',
        color: '#ffbbee',
        shiftName: '(Без названия)',
        hours: hoursMap.get(null) ?? 0,
      });
    }

    let totalSalary = 0;
    if (user?.salary && user?.typeSalary) {
      if (user.typeSalary === 'MONTHLY') {
        totalSalary = user.salary;
      } else if (user.typeSalary === 'SHIFT') {
        totalSalary = shifts.length * user.salary;
      } else if (user.typeSalary === 'HOURLY') {
        totalSalary =
          Array.from(hoursMap.values()).reduce((a, b) => a + b, 0) *
          user.salary;
      }
    }

    return {
      shifts: shiftStats,
      hours: hoursStats,
      salary: {
        salary: totalSalary,
        typeSalary: user?.typeSalary ?? 'UNKNOWN',
        maxSalary: user?.maxSalary ?? null,
      },
    };
  }

  async getShiftsByTemplate(
    userId: string,
    year: number,
    month: number,
  ): Promise<ShiftStatsItemCount[]> {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    const grouped = await this.prisma.shift.groupBy({
      by: ['shiftTemplateId'],
      where: {
        ownerId: userId,
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      _count: {
        _all: true,
      },
    });

    const countsMap = new Map<string | null, number>();
    for (const item of grouped) {
      countsMap.set(item.shiftTemplateId ?? null, item._count._all);
    }

    const templateIds = Array.from(countsMap.keys()).filter(
      (id): id is string => id !== null,
    );

    let templates: { id: string; label: string; color: string }[] = [];
    if (templateIds.length > 0) {
      templates = await this.prisma.shiftTemplate.findMany({
        where: {
          ownerId: userId,
          id: { in: templateIds },
        },
        select: {
          id: true,
          label: true,
          color: true,
        },
        orderBy: { label: 'asc' },
      });
    }

    const result: ShiftStatsItemCount[] = templates.map((t) => ({
      id: t.id,
      color: t.color,
      shiftName: t.label,
      count: countsMap.get(t.id) ?? 0,
    }));

    const withoutTemplateCount = countsMap.get(null) ?? 0;
    if (withoutTemplateCount > 0) {
      result.push({
        id: '0',
        color: '#ffbbee',
        shiftName: '(Без шаблона смены)',
        count: withoutTemplateCount,
      });
    }

    return result;
  }

  async getShiftsHoursByTemplate(
    userId: string,
    year: number,
    month: number,
  ): Promise<ShiftStatsItemHours[]> {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    const shifts = await this.prisma.shift.findMany({
      where: {
        ownerId: userId,
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        shiftTemplate: true,
      },
    });

    const hoursMap = new Map<string | null, number>();

    for (const shift of shifts) {
      const start = shift.actualStartTime ?? shift.shiftTemplate?.startTime;
      const end = shift.actualEndTime ?? shift.shiftTemplate?.endTime;

      const hours = this.calculateHours(start, end);

      const key = shift.shiftTemplateId ?? null;
      hoursMap.set(key, (hoursMap.get(key) ?? 0) + hours);
    }

    const templateIds = Array.from(hoursMap.keys()).filter(
      (id): id is string => id !== null,
    );

    let templates: { id: string; label: string; color: string }[] = [];
    if (templateIds.length > 0) {
      templates = await this.prisma.shiftTemplate.findMany({
        where: {
          ownerId: userId,
          id: { in: templateIds },
        },
        select: {
          id: true,
          label: true,
          color: true,
        },
        orderBy: { label: 'asc' },
      });
    }

    const result: ShiftStatsItemHours[] = templates.map((t) => ({
      id: t.id,
      color: t.color,
      shiftName: t.label,
      hours: hoursMap.get(t.id) ?? 0,
    }));

    const withoutTemplateHours = hoursMap.get(null) ?? 0;
    if (withoutTemplateHours > 0) {
      result.push({
        id: '0',
        color: '#ffbbee',
        shiftName: '(Без названия)',
        hours: withoutTemplateHours,
      });
    }

    return result;
  }

  async getSalaryForMonth(userId: string, year: number, month: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        salary: true,
        typeSalary: true,
        maxSalary: true,
      },
    });

    if (!user || user.salary === null || !user.typeSalary) {
      return { salary: 0, typeSalary: 'UNKNOWN' };
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    let totalSalary = 0;

    if (user.typeSalary === 'MONTHLY') {
      totalSalary = user.salary;
    } else if (user.typeSalary === 'SHIFT') {
      const shiftCount = await this.prisma.shift.count({
        where: {
          ownerId: userId,
          date: {
            gte: startDate,
            lt: endDate,
          },
        },
      });
      totalSalary = shiftCount * user.salary;
    } else if (user.typeSalary === 'HOURLY') {
      const shifts = await this.prisma.shift.findMany({
        where: {
          ownerId: userId,
          date: {
            gte: startDate,
            lt: endDate,
          },
        },
        include: {
          shiftTemplate: true,
        },
      });

      let totalHours = 0;
      for (const shift of shifts) {
        const start = shift.actualStartTime ?? shift.shiftTemplate?.startTime;
        const end = shift.actualEndTime ?? shift.shiftTemplate?.endTime;
        totalHours += this.calculateHours(start, end);
      }
      totalSalary = totalHours * user.salary;
    }

    return {
      salary: totalSalary,
      typeSalary: user.typeSalary,
      maxSalary: user.maxSalary,
    };
  }
}
