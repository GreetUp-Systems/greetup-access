import { type INestApplication } from "@nestjs/common";
import { type Request, json, urlencoded } from "express";

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

export function configureApplication(app: INestApplication): void {
  app.setGlobalPrefix("api");
  app.use(
    json({
      limit: "1mb",
      verify: (request, _response, buffer) => {
        const rawBodyRequest = request as RawBodyRequest;
        if (rawBodyRequest.originalUrl.startsWith("/api/webhooks/blindpay")) {
          rawBodyRequest.rawBody = Buffer.from(buffer);
        }
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: "1mb" }));
  app.enableShutdownHooks();
}
