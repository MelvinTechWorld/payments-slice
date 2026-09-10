export type PaymentEventType = 'INITIATION' | 'VERIFICATION' | 'FULFILLMENT' | 'FAILURE' | 'CANCELLATION';

export type ProviderEvent = {
  type: PaymentEventType;
  /** The unique event ID from the provider, used as an idempotency key */
  providerReference: string;
  /** Our internal user ID (if available, e.g. from checkout session client_reference_id) */
  userId?: string;
  /** The provider's customer ID */
  customerId: string;
  /** The provider's subscription ID, if applicable */
  subscriptionId?: string;
  /** Our internal plan ID (e.g. 'monthly' or 'yearly') */
  planId?: string;
  /** Amount paid in minor units (cents) */
  amountInMinorUnits?: number;
  /** The start date of the granted access period */
  periodStart?: Date;
  /** The end date of the granted access period */
  periodEnd?: Date;
  /** Any error message or context */
  message?: string;
};

export interface PaymentProvider {
  /** 
   * Creates a checkout session URL for the user to initiate payment.
   * Note: The abstraction receives our internal planId (e.g., 'monthly'),
   * and the adapter handles mapping it to the provider's specific price IDs.
   */
  createCheckoutSession(userId: string, email: string, planId: string): Promise<string>;
  
  /** 
   * Creates a portal session URL for the user to manage their active subscription.
   */
  createCustomerPortalSession(customerId: string): Promise<string>;
  
  /** 
   * Parses and cryptographically verifies an incoming webhook request,
   * translating provider-specific events into our unified domain events.
   */
  parseWebhook(body: string, signature: string): Promise<ProviderEvent>;

  /**
   * Upgrades a user's subscription to a new plan.
   * Relies on the provider's native proration engine to execute the charge.
   */
  upgradeSubscription(subscriptionId: string, newPlanId: string): Promise<void>;

  /**
   * Downgrades a user's subscription to a new plan.
   * Schedules the change to take effect at the end of the current billing cycle.
   */
  downgradeSubscription(subscriptionId: string, newPlanId: string): Promise<void>;
}
