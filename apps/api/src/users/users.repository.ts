import { Prisma, PrismaService } from "@access/database";
import { Injectable } from "@nestjs/common";

export type UserWithWallet = Prisma.UserGetPayload<{ include: { wallet: true } }>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByPrivyUserId(privyUserId: string): Promise<UserWithWallet | null> {
    return this.prisma.user.findUnique({
      where: { privyUserId },
      include: { wallet: true },
    });
  }

  upsertIdentity(privyUserId: string, email: string): Promise<UserWithWallet> {
    return this.prisma.user.upsert({
      where: { privyUserId },
      create: { privyUserId, email },
      update: { email },
      include: { wallet: true },
    });
  }

  async attachWallet(
    userId: string,
    privyWalletId: string,
    stellarAddress: string,
  ): Promise<UserWithWallet> {
    await this.prisma.walletAccount.create({
      data: { userId, privyWalletId, stellarAddress },
    });

    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { wallet: true },
    });

    return account;
  }
}
