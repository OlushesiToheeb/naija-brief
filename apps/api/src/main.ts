import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { corsOrigins } from "./common/origin";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // Fire onModuleDestroy on SIGTERM/SIGINT so the cron, the safety timer and any
  // in-flight job drain cleanly instead of being hard-killed mid-write.
  app.enableShutdownHooks();

  // Behind a reverse proxy, trust the first hop so the throttler counts the real
  // client IP (from X-Forwarded-For) rather than the proxy's.
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  // Allow the Next.js web app (any localhost port in dev) to call the API.
  app.enableCors({ origin: corsOrigins() });

  const port = Number(process.env.API_PORT || process.env.PORT || 3001);
  await app.listen(port);
  new Logger("Bootstrap").log(`Naija Brief API on http://localhost:${port}/api`);
}
void bootstrap();
