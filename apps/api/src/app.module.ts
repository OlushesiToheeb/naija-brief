import { resolve } from "node:path";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BriefModule } from "./brief/brief.module";
import { ChatModule } from "./chat/chat.module";
import { JobsModule } from "./jobs/jobs.module";
import { HealthController } from "./health.controller";
import { buildDbConnectionOptions } from "./db/connection";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // The API runs from apps/api, but .env lives at the monorepo root.
      envFilePath: [
        resolve(process.cwd(), "../../.env"),
        resolve(process.cwd(), ".env"),
      ],
    }),
    ScheduleModule.forRoot(),
    // Per-IP rate limiting. A generous global default; paid endpoints tighten it
    // per-route (see ChatController, JobsController). In-memory storage is right
    // for a single instance. Configurable so tests can lift the ceiling.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get<string>("THROTTLE_TTL") || 60_000),
          limit: Number(config.get<string>("THROTTLE_LIMIT") || 120),
        },
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildDbConnectionOptions({ get: (k) => config.get<string>(k) }),
        autoLoadEntities: true,
        // Schema changes come from migrations (npm run migration:run). Auto-sync
        // is an opt-in dev convenience only — DB_SYNC=1 — never in production.
        synchronize: config.get<string>("DB_SYNC") === "1",
      }),
    }),
    BriefModule,
    ChatModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
