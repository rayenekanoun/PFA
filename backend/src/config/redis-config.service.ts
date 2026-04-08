import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisConfigService {
  public constructor(private readonly configService: ConfigService) {}

  public getBullConnection() {
    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
    const parsed = new URL(redisUrl);

    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      db: parsed.pathname ? Number(parsed.pathname.slice(1) || 0) : 0,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  }
}
