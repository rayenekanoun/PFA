import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai/ai.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
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

    appController = app.get<AppController>(AppController);
  });

  it('returns a health payload', () => {
    expect(appController.getHealth()).toMatchObject({
      service: 'connected-car-diagnostics-backend',
      status: 'ok',
      ai: {
        provider: 'vertex',
        fallbackToStubEnabled: false,
      },
    });
  });
});
