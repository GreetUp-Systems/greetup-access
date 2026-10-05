// NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so each one is read by its
// literal name. Both are public (the API URL and the Privy App ID); secrets never come here.
function required(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is not set. See .env.example.`);
  }
  return value.trim();
}

export const publicEnv = {
  apiUrl: required("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL).replace(/\/+$/, ""),
  privyAppId: required("NEXT_PUBLIC_PRIVY_APP_ID", process.env.NEXT_PUBLIC_PRIVY_APP_ID),
} as const;
