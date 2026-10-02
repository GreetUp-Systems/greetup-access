import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import { type Request } from "express";

import { Public } from "../../auth/decorators/public.decorator";
import { BlindPayWebhookService } from "./blindpay-webhook.service";

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller("webhooks")
export class BlindPayWebhookController {
  constructor(private readonly webhookService: BlindPayWebhookService) {}

  @Public()
  @Post("blindpay")
  @HttpCode(HttpStatus.OK)
  handle(
    @Req() request: RawBodyRequest,
    @Headers("svix-id") messageId: string | undefined,
    @Headers("svix-timestamp") timestamp: string | undefined,
    @Headers("svix-signature") signature: string | undefined,
  ): Promise<{ received: true }> {
    if (request.rawBody === undefined) {
      throw new BadRequestException({
        code: "invalid_webhook_payload",
        message: "The webhook payload is invalid.",
      });
    }

    return this.webhookService.handle(request.rawBody, { messageId, timestamp, signature });
  }
}
