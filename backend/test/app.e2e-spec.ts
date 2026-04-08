import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AiService } from '../src/ai/ai.service';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: AiService,
          useValue: {
            getProviderName: jest.fn().mockReturnValue('vertex'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(false),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          service: 'connected-car-diagnostics-backend',
          status: 'ok',
          ai: {
            provider: 'vertex',
            fallbackToStubEnabled: false,
          },
        });
      });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
