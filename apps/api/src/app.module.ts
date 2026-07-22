import { resolve } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BriefModule } from "./brief/brief.module";
import { ChatModule } from "./chat/chat.module";
import { HealthController } from "./health.controller";

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
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>("DATABASE_URL");
        const base = {
          type: "postgres" as const,
          autoLoadEntities: true,
          // Fine for an MVP against a dev database; switch to migrations before
          // running anything you can't afford to drop.
          synchronize: config.get<string>("DB_SYNC") !== "0",
        };
        if (url) return { ...base, url };
        return {
          ...base,
          host: config.get<string>("PGHOST") || "localhost",
          port: Number(config.get<string>("PGPORT") || 5432),
          username: config.get<string>("PGUSER") || process.env.USER,
          password: config.get<string>("PGPASSWORD") || undefined,
          database: config.get<string>("PGDATABASE") || "naija_brief",
        };
      },
    }),
    BriefModule,
    ChatModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
