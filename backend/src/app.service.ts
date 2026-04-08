import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai/ai.service';

@Injectable()
export class AppService {
  public constructor(
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
  ) {}

  public getHealth() {
    return {
      service: 'connected-car-diagnostics-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
      ai: {
        provider: this.aiService.getProviderName(),
        fallbackToStubEnabled: this.configService.get<boolean>('AI_ALLOW_STUB_FALLBACK', false) === true,
      },
    };
  }
}
