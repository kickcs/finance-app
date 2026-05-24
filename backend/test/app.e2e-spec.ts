import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface HealthResponse {
  status: 'ok' | 'error';
  database: { status: 'ok' | 'error' };
}

interface SupertestResponse {
  body: unknown;
}

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health → 200 when database is reachable', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res: SupertestResponse) => {
        const body = res.body as HealthResponse;
        expect(body.status).toBe('ok');
        expect(body.database.status).toBe('ok');
      });
  });
});
