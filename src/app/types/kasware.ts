// Kasware Wallet TypeScript Definitions

declare global {
  interface Window {
    kasware?: KaswareWallet;
  }
}

export interface KaswareWallet {
  // Connection
  requestAccounts(): Promise<string[]>;
  getAccounts(): Promise<string[]>;
  disconnect(origin: string): Promise<void>;
  
  // Account Info
  getPublicKey(): Promise<string>;
  getBalance(): Promise<WalletBalance>;
  getKRC20Balance(): Promise<KRC20Balance>;
  
  // Network
  getNetwork(): Promise<string>;
  switchNetwork(network: string): Promise<string>;
  
  // Transactions
  sendKaspa(address: string, amount: number, options?: SendKaspaOptions): Promise<string>;
  signMessage(message: string): Promise<string>;
  verifyMessage(publicKey: string, message: string, signature: string): Promise<boolean>;
  signKRC20Transaction(data: string, type: string, address: string, fee: number): Promise<string>;
  
  // Advanced
  signPskt(params: SignPsktParams): Promise<string>;
  pushTx(signedTx: string): Promise<string>;
  buildScript(params: BuildScriptParams): Promise<BuildScriptResult>;
  getUtxoEntries(address?: string): Promise<UtxoEntry[]>;
  
  // Batch operations
  krc20BatchTransferTransaction(transfers: BatchTransferItem[]): Promise<string>;
  cancelKRC20BatchTransfer(): Promise<void>;
  
  // Commit/Reveal
  submitCommit(params: CommitParams): Promise<string>;
  submitReveal(params: RevealParams): Promise<string>;
  submitCommitReveal(commit: CommitParams, reveal: RevealParams, script: string, networkId: string): Promise<string>;
  
  // Event handling
  on(event: string, handler: Function): void;
  removeListener(event: string, handler: Function): void;
}

export interface WalletBalance {
  confirmed: number;
  unconfirmed: number;
  total: number;
}

export interface KRC20Balance {
  [ticker: string]: {
    balance: string;
    decimals: number;
  };
}

export interface SendKaspaOptions {
  priorityFee?: number;
  payload?: string;
}

export interface SignPsktParams {
  txJsonString: string;
  options: {
    signInputs: Array<{
      index: number;
      sighashType: SighashType;
    }>;
  };
}

export interface BuildScriptParams {
  type: BuildScriptType;
  data: string;
}

export interface BuildScriptResult {
  script: string;
  p2shAddress: string;
}

export interface UtxoEntry {
  transactionId: string;
  index: number;
  amount: string;
  scriptPublicKey: string;
  address: string;
  blockDaaScore: string;
  isCoinbase: boolean;
}

export interface BatchTransferItem {
  tick: string;
  dec: string;
  to: string;
  amount: number;
}

export interface BatchTransferResult {
  index?: number;
  tick?: string;
  to?: string;
  amount?: number;
  status: 'success' | 'failed' | 'preparing 20%' | 'preparing 40%' | 
          'preparing 60%' | 'preparing 80%' | 'preparing 100%';
  errorMsg?: string;
  txId?: {
    commitId: string;
    revealId: string;
  };
}

export interface CommitParams {
  priorityEntries: UtxoEntry[];
  entries: UtxoEntry[];
  outputs: Array<{ address: string; amount: number }>;
  changeAddress: string;
  priorityFee: number;
}

export interface RevealParams {
  priorityEntries: UtxoEntry[];
  entries: UtxoEntry[];
  outputs: Array<{ address: string; amount: number }>;
  changeAddress: string;
  priorityFee: number;
  networkId: string;
  script: string;
}

export enum KaspaNetwork {
  MAINNET = 'kaspa_mainnet',
  TESTNET_11 = 'kaspa_testnet_11',
  TESTNET_10 = 'kaspa_testnet_10',
  DEVNET = 'kaspa_devnet'
}

export enum TxType {
  SIGN_KRC20_DEPLOY = 'SIGN_KRC20_DEPLOY',
  SIGN_KRC20_MINT = 'SIGN_KRC20_MINT',
  SIGN_KRC20_TRANSFER = 'SIGN_KRC20_TRANSFER'
}

export enum SighashType {
  All = 0b00000001,
  None = 0b00000010,
  Single = 0b00000100,
  AllAnyOneCanPay = 0b10000001,
  NoneAnyOneCanPay = 0b10000010,
  SingleAnyOneCanPay = 0b10000100
}

export enum BuildScriptType {
  KRC20 = 'KRC20',
  KNS = 'KNS',
  KSPR_KRC721 = 'KSPR_KRC721'
}

export interface KaswareError {
  code: number;
  message: string;
  data?: any;
}