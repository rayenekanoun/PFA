import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AI_PROVIDER_TOKEN, AiService } from './ai.service';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import { StubAiProvider } from './providers/stub-ai.provider';
import { VertexAiProvider } from './providers/vertex-ai.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    StubAiProvider,
    OpenAiCompatibleProvider,
    GeminiProvider,
    VertexAiProvider,
    {
      provide: AI_PROVIDER_TOKEN,
      inject: [ConfigService, StubAiProvider, OpenAiCompatibleProvider, GeminiProvider, VertexAiProvider],
      useFactory: (
        configService: ConfigService,
        stubProvider: StubAiProvider,
        openAiCompatibleProvider: OpenAiCompatibleProvider,
        geminiProvider: GeminiProvider,
        vertexAiProvider: VertexAiProvider,
      ) => {
        const provider = configService.get<string>('AI_PROVIDER', 'stub');
        if (provider === 'openai-compatible') {
          return openAiCompatibleProvider;
        }
        if (provider === 'gemini') {
          return geminiProvider;
        }
        if (provider === 'vertex') {
          return vertexAiProvider;
        }
        return stubProvider;
      },
    },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
