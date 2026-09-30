CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "privy_user_id" TEXT NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wallet_accounts" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "privy_wallet_id" TEXT NOT NULL,
  "stellar_address" VARCHAR(56) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wallet_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_privy_user_id_key" ON "users"("privy_user_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "wallet_accounts_user_id_key" ON "wallet_accounts"("user_id");
CREATE UNIQUE INDEX "wallet_accounts_privy_wallet_id_key"
  ON "wallet_accounts"("privy_wallet_id");
CREATE UNIQUE INDEX "wallet_accounts_stellar_address_key"
  ON "wallet_accounts"("stellar_address");

ALTER TABLE "wallet_accounts"
  ADD CONSTRAINT "wallet_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
