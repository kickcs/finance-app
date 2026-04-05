import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface UserWithTimezone {
  userId: string;
  timezone: string;
}

@Injectable()
export class TimezoneUserResolverService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Returns all users (with their timezone) whose local clock currently shows
   * the given hour. Queries distinct timezones matching the hour, then collects
   * all user IDs within each timezone.
   */
  async getUsersAtLocalHour(targetHour: number): Promise<UserWithTimezone[]> {
    const matchingTimezones = await this.dataSource.query<{ timezone: string }[]>(
      `SELECT DISTINCT timezone
       FROM profiles
       WHERE timezone IS NOT NULL
         AND EXTRACT(HOUR FROM NOW() AT TIME ZONE timezone) = $1`,
      [targetHour],
    );

    if (matchingTimezones.length === 0) {
      return [];
    }

    const result: UserWithTimezone[] = [];

    for (const { timezone } of matchingTimezones) {
      const users = await this.dataSource.query<{ id: string }[]>(
        `SELECT id FROM profiles WHERE timezone = $1`,
        [timezone],
      );
      for (const { id } of users) {
        result.push({ userId: id, timezone });
      }
    }

    return result;
  }
}
