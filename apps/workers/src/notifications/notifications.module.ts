import { type WorkerConfig } from "@access/config";
import { DynamicModule, Module } from "@nestjs/common";

import { EMAIL_GATEWAY, ResendEmailGateway } from "./email.gateway";
import { NotificationsRepository } from "./notifications.repository";
import { NOTIFY_CONFIG, NotifyService } from "./notify.service";
import { NotifyWorker } from "./notify.worker";

@Module({})
export class NotificationsModule {
  /** Without e-mail settings (development) the queue is not consumed at all (SPEC-008 §8). */
  static forRoot(config: WorkerConfig): DynamicModule {
    const email = config.email;
    if (email === undefined) {
      return { module: NotificationsModule };
    }

    return {
      module: NotificationsModule,
      providers: [
        {
          provide: EMAIL_GATEWAY,
          useFactory: () =>
            new ResendEmailGateway({ apiKey: email.resendApiKey, from: email.from }),
        },
        { provide: NOTIFY_CONFIG, useValue: { appPublicUrl: email.appPublicUrl } },
        NotificationsRepository,
        NotifyService,
        {
          provide: NotifyWorker,
          useFactory: (service: NotifyService) => new NotifyWorker(config.redisUrl, service),
          inject: [NotifyService],
        },
      ],
    };
  }
}
