import { Test, type TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { TimezoneUserResolverService } from './timezone-user-resolver.service';

describe('TimezoneUserResolverService', () => {
  let service: TimezoneUserResolverService;
  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimezoneUserResolverService, { provide: DataSource, useValue: mockDataSource }],
    }).compile();

    service = module.get<TimezoneUserResolverService>(TimezoneUserResolverService);
    jest.clearAllMocks();
  });

  it('should return mapped users when query yields rows', async () => {
    mockDataSource.query.mockResolvedValue([
      { id: 'user-1', timezone: 'Asia/Tashkent', notification_hour: 9, language: 'ru' },
      { id: 'user-2', timezone: 'Europe/Berlin', notification_hour: 12, language: 'en' },
    ]);

    const result = await service.getUsersDueForNotification();

    expect(result).toEqual([
      { userId: 'user-1', timezone: 'Asia/Tashkent', notificationHour: 9, language: 'ru' },
      { userId: 'user-2', timezone: 'Europe/Berlin', notificationHour: 12, language: 'en' },
    ]);
    expect(mockDataSource.query).toHaveBeenCalledTimes(1);
    const firstCall = mockDataSource.query.mock.calls[0] as [string];
    const sql = firstCall[0];
    expect(sql).toContain('FROM profiles');
    expect(sql).toContain('AT TIME ZONE timezone');
    expect(sql).toMatch(/=\s*notification_hour/);
    // Half-hour timezones require a sub-hour minute filter so users in
    // Asia/Kolkata, Asia/Kathmandu, etc. are not dropped at hour boundaries.
    expect(sql).toMatch(/EXTRACT\(MINUTE FROM NOW\(\) AT TIME ZONE timezone\)/);
  });

  it('should return [] when no rows match', async () => {
    mockDataSource.query.mockResolvedValue([]);

    const result = await service.getUsersDueForNotification();

    expect(result).toEqual([]);
    expect(mockDataSource.query).toHaveBeenCalledTimes(1);
  });
});
