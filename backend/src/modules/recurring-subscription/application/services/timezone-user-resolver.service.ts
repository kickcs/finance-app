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
    // Half-hour and quarter-hour timezones (e.g. Asia/Kolkata UTC+5:30,
    // Asia/Kathmandu UTC+5:45) push the local minute of a UTC :00 / :30 cron
    // tick away from 0. Matching only on EXTRACT(HOUR) drops users whose
    // local time at the cron tick is HH:30/HH:45/HH:15 — they would never
    // satisfy `hour = notification_hour`.
    //
    // We therefore widen the window to "the local hour equals
    // notification_hour AND the local minute is in [0, 30)". With a cron
    // running at minute 0 (and ideally also at minute 30 — see service note),
    // this gives every user exactly one notification per day, regardless of
    // their tz offset granularity.
    const rows = await this.dataSource.query<
      Array<{ id: string; timezone: string; notification_hour: number }>
    >(
      `SELECT id, timezone, notification_hour
       FROM profiles
       WHERE timezone IS NOT NULL
         AND EXTRACT(HOUR FROM NOW() AT TIME ZONE timezone)::int = notification_hour
         AND EXTRACT(MINUTE FROM NOW() AT TIME ZONE timezone)::int < 30`,
    );

    return rows.map((row) => ({
      userId: row.id,
      timezone: row.timezone,
      notificationHour: row.notification_hour,
    }));
  }
}
