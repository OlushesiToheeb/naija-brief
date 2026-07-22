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

  // Allow the Next.js web app (any localhost port in dev) to call the API.
  app.enableCors({ origin: corsOrigins() });

  const port = Number(process.env.API_PORT || process.env.PORT || 3001);
  await app.listen(port);
  new Logger("Bootstrap").log(`Naija Brief API on http://localhost:${port}/api`);
}
void bootstrap();
