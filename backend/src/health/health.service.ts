import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface HealthCheckResult {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  database: {
    status: 'ok' | 'error';
    message?: string;
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async check(): Promise<HealthCheckResult> {
    const result: HealthCheckResult = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: 'ok',
      },
    };

    // Check database connection
    try {
      await this.dataSource.query('SELECT 1');
    } catch (error) {
      result.status = 'error';
      result.database = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Database connection failed',
      };
    }

    return result;
  }
}
