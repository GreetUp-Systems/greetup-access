DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'access_app_runtime') THEN
    CREATE ROLE access_app_runtime
      NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'access_runtime') THEN
    CREATE ROLE access_runtime
      LOGIN PASSWORD 'access_runtime'
      NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'access_blindpay_webhook') THEN
    CREATE ROLE access_blindpay_webhook
      NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'access_blindpay_webhook_login') THEN
    CREATE ROLE access_blindpay_webhook_login
      LOGIN PASSWORD 'access_blindpay_webhook'
      NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

GRANT access_app_runtime TO access_runtime;
GRANT access_blindpay_webhook TO access_blindpay_webhook_login;
