import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";

// Boots the full app (NestJS + TypeORM against the configured Postgres) and
// exercises the public HTTP surface. Requires a reachable database.
describe("Naija Brief API (e2e)", () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health -> ok", () => {
    return request(app.getHttpServer())
      .get("/api/health")
      .expect(200)
      .expect({ status: "ok" });
  });

  it("GET /api/status -> a status object", async () => {
    const res = await request(app.getHttpServer()).get("/api/status").expect(200);
    expect(res.body).toHaveProperty("status");
    expect(["idle", "running", "done", "error"]).toContain(res.body.status);
  });

  it("GET /api/brief?date=1999-01-01 -> 404", () => {
    return request(app.getHttpServer())
      .get("/api/brief?date=1999-01-01")
      .expect(404);
  });

  it("GET /api/brief?date=bad -> 400", () => {
    return request(app.getHttpServer()).get("/api/brief?date=bad").expect(400);
  });

  it("GET /api/briefs -> { dates: [...] }", async () => {
    const res = await request(app.getHttpServer()).get("/api/briefs").expect(200);
    expect(Array.isArray(res.body.dates)).toBe(true);
  });

  it("POST /api/chat with an invalid body -> 400", () => {
    return request(app.getHttpServer())
      .post("/api/chat")
      .send({ date: "bad", storyId: "x", messages: [] })
      .expect(400);
  });
});
