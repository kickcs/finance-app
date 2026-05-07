import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface UserWithTimezone {
  userId: string;
  timezone: string;
  notificationHour: number;
}

@Injectable()
export class TimezoneUserResolverService {
  constructor(private readonly dataSource: DataSource) {}

  async getUsersDueForNotification(): Promise<UserWithTimezone[]> {
    const rows = await this.dataSource.query<
      Array<{ id: string; timezone: string; notification_hour: number }>
    >(
      `SELECT id, timezone, notification_hour
       FROM profiles
       WHERE timezone IS NOT NULL
         AND EXTRACT(HOUR FROM NOW() AT TIME ZONE timezone)::int = notification_hour`,
    );

    return rows.map((row) => ({
      userId: row.id,
      timezone: row.timezone,
      notificationHour: row.notification_hour,
    }));
  }
}
