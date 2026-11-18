// Domain types shared by the whole core. No framework code here.

export type OfficeId = 'OSLO' | 'BLR';
export type Currency = 'NOK' | 'INR';

/** Money is stored in minor units (øre / paise) as integers to avoid float rounding errors. */
export interface Money {
  amountMinor: number;
  currency: Currency;
}

export interface Office {
  id: OfficeId;
  name: string;
  currency: Currency;
  timeZone: string; // used to decide which month a purchase belongs to
  monthlyBudget: Money;
  managerId: string; // approves over-budget purchases, gets HR reminders
}

export interface Volunteer {
  employeeId: string;
  name: string;
  homeOffice: OfficeId;
}

/** Where a volunteer is today. Default (when not set) is their home office. */
export type Presence =
  | { kind: 'OFFICE'; office: OfficeId }
  | { kind: 'HOME' }
  | { kind: 'HOLIDAY' };

export type RefillStatus =
  | 'OFFERED' // asked one specific volunteer; anyone may still take it
  | 'UNASSIGNED' // nobody eligible right now; retried on every tick
  | 'ACCEPTED' // one volunteer has committed to buy
  | 'PURCHASED' // receipt recorded, claim not yet accepted by HR system
  | 'NEEDS_APPROVAL' // purchase exceeds remaining budget, waiting for manager
  | 'CLAIM_SUBMITTED' // claim created in HR system, waiting for approval
  | 'REIMBURSED' // HR approved, paid through payroll
  | 'CLAIM_REJECTED'; // HR rejected the claim

export const OPEN_STATUSES: readonly RefillStatus[] = ['OFFERED', 'UNASSIGNED', 'ACCEPTED'];

export interface Purchase {
  amount: Money;
  receiptImage: string;
  purchasedAt: Date;
  buyerId: string;
  items?: string[];
}

export interface RefillEvent {
  at: Date;
  status: RefillStatus;
  note: string;
}

export interface Refill {
  id: string;
  office: OfficeId;
  status: RefillStatus;
  reportedBy: string;
  reportedAt: Date;
  assigneeId?: string;
  offeredAt?: Date;
  acceptedAt?: Date;
  /** Volunteers who declined or let it time out; not offered this refill again. */
  passedOver: string[];
  purchase?: Purchase;
  claimId?: string;
  claimSubmittedAt?: Date;
  hrReminderSent: boolean;
  history: RefillEvent[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; reason: string };
