import { type INestApplication } from "@nestjs/common";
import { type Request, json, urlencoded } from "express";

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

export function configureApplication(
  app: INestApplication,
  options: { corsOrigins?: string[] } = {},
): void {
  app.setGlobalPrefix("api");
  // The web app calls the API from the browser with a Bearer token, never with cookies.
  if (options.corsOrigins !== undefined && options.corsOrigins.length > 0) {
    app.enableCors({
      origin: options.corsOrigins,
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
      credentials: false,
      maxAge: 600,
    });
  }
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
