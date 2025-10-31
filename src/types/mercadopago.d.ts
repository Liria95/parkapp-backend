declare module 'mercadopago' {
  export function configure(config: { access_token: string }): void;

  export namespace preferences {
    export function create(preference: any): Promise<{
      body: {
        id: string;
        init_point: string;
        sandbox_init_point: string;
      }
    }>;
  }

  export namespace payment {
    export function findById(id: string): Promise<{
      body: {
        id: string;
        status: string;
        status_detail: string;
        transaction_amount: number;
        external_reference: string;
        payer?: {
          email: string;
        }
      }
    }>;
  }
}