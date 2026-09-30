export interface AccountView {
  user: {
    id: string;
    email: string;
  };
  wallet: {
    address: string;
    chainType: "stellar";
  };
}
