declare module '@paystack/inline-js' {
  export interface PaystackTransactionResponse {
    reference: string;
    trans?: string;
    status?: string;
    message?: string;
    transaction?: string;
    trxref?: string;
    redirecturl?: string;
  }

  export interface PaystackResumeCallbacks {
    onLoad?: (response: any) => void;
    onSuccess?: (transaction: PaystackTransactionResponse) => void;
    onCancel?: () => void;
    onError?: (error: { message?: string; [key: string]: any }) => void;
  }

  export default class PaystackPop {
    resumeTransaction(accessCode: string, callbacks?: PaystackResumeCallbacks): void;
    newTransaction(options: Record<string, any>): void;
  }
}
