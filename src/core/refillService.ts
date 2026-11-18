import type { ChatTool } from '../adapters/chatTool';
import type { HrSystem } from '../adapters/hrSystem';
import { remainingBudget } from './budget';
import { DAY, HOUR, type Clock } from './clock';
import { format, greaterThan } from './money';
import type { PresenceRegistry } from './presence';
import {
  OPEN_STATUSES,
  type Money,
  type Office,
  type OfficeId,
  type Refill,
  type RefillStatus,
  type Result,
  type Volunteer,
} from './types';
import { chooseVolunteer } from './volunteerSelector';

export interface RefillConfig {
  offerTimeoutMs: number; // time to accept an offer before it moves on
  completionTimeoutMs: number; // time to buy after accepting
  hrReminderAfterMs: number; // nudge the manager if HR has not decided
}

export const DEFAULT_CONFIG: RefillConfig = {
  offerTimeoutMs: 2 * HOUR,
  completionTimeoutMs: 24 * HOUR,
  hrReminderAfterMs: 7 * DAY,
};

export interface RefillServiceDeps {
  offices: Office[];
  volunteers: Volunteer[];
  presence: PresenceRegistry;
  chat: ChatTool;
  hr: HrSystem;
  clock: Clock;
  config?: RefillConfig;
}

/**
 * Owns the refill lifecycle. Every state change goes through this class, and
 * JavaScript runs one call at a time, so each check-and-update below is atomic.
 * In a real database the same rule becomes a conditional update (compare-and-set).
 */
export class RefillService {
  private readonly refills: Refill[] = [];
  private readonly config: RefillConfig;
  private readonly deps: RefillServiceDeps;
  private nextId = 1;

  constructor(deps: RefillServiceDeps) {
    this.deps = deps;
    this.config = deps.config ?? DEFAULT_CONFIG;
  }

  // ---------- Queries ----------

  get(refillId: string): Refill | undefined {
    return this.refills.find((r) => r.id === refillId);
  }

  all(): readonly Refill[] {
    return this.refills;
  }

  openRefillFor(office: OfficeId): Refill | undefined {
    return this.refills.find((r) => r.office === office && OPEN_STATUSES.includes(r.status));
  }

  remaining(office: OfficeId): Money {
    return remainingBudget(this.office(office), this.refills, this.now());
  }

  // ---------- Commands ----------

  /** Anyone can report an empty box. Only one open refill per office is allowed. */
  reportEmpty(office: OfficeId, reportedBy: string): Result<Refill> {
    const existing = this.openRefillFor(office);
    if (existing) {
      this.deps.chat.sendDirect(reportedBy, `Thanks! A refill is already in progress (${existing.id}).`);
      return { ok: true, value: existing };
    }

    const left = this.remaining(office);
    if (left.amountMinor <= 0) {
      this.deps.chat.postToOfficeChannel(office, `Snack budget for this month is used up. No refill until next month.`);
      return { ok: false, reason: 'BUDGET_EXHAUSTED' };
    }

    const now = this.now();
    const refill: Refill = {
      id: `refill-${this.nextId++}`,
      office,
      status: 'UNASSIGNED',
      reportedBy,
      reportedAt: now,
      passedOver: [],
      hrReminderSent: false,
      history: [],
    };
    this.refills.push(refill);
    this.log(refill, 'UNASSIGNED', `Reported empty by ${reportedBy}`);
    this.offerToNext(refill);
    return { ok: true, value: refill };
  }

  /**
   * First accept wins. The offered volunteer, or anyone else who wants to help,
   * can accept while the refill is OFFERED or UNASSIGNED. Everyone after that
   * gets ALREADY_TAKEN, so two people never commit to the same refill.
   */
  accept(refillId: string, employeeId: string): Result<Refill> {
    const refill = this.get(refillId);
    if (!refill) return { ok: false, reason: 'NOT_FOUND' };
    if (!this.isVolunteer(employeeId)) return { ok: false, reason: 'NOT_A_VOLUNTEER' };
    if (refill.status !== 'OFFERED' && refill.status !== 'UNASSIGNED') {
      return { ok: false, reason: 'ALREADY_TAKEN' };
    }

    const previouslyOffered = refill.assigneeId;
    refill.assigneeId = employeeId;
    refill.acceptedAt = this.now();
    this.log(refill, 'ACCEPTED', `Accepted by ${employeeId}`);

    if (previouslyOffered && previouslyOffered !== employeeId) {
      this.deps.chat.sendDirect(previouslyOffered, `No need to refill ${refill.id}, ${employeeId} took it.`);
    }
    const left = this.remaining(refill.office);
    this.deps.chat.sendDirect(
      employeeId,
      `You're on ${refill.id}. Budget left this month: ${format(left)}. Upload the receipt within 24 hours.`,
    );
    return { ok: true, value: refill };
  }

  /** The offered volunteer says no (not in office, busy). Move to the next person. */
  decline(refillId: string, employeeId: string): Result<Refill> {
    const refill = this.get(refillId);
    if (!refill) return { ok: false, reason: 'NOT_FOUND' };
    if (refill.status !== 'OFFERED' || refill.assigneeId !== employeeId) {
      return { ok: false, reason: 'NOT_OFFERED_TO_YOU' };
    }
    this.passOver(refill, `Declined by ${employeeId}`);
    return { ok: true, value: refill };
  }

  /** The buyer uploads the receipt. Within budget the HR claim is created at once. */
  recordPurchase(
    refillId: string,
    employeeId: string,
    amount: Money,
    receiptImage: string,
    items?: string[],
  ): Result<Refill> {
    const refill = this.get(refillId);
    if (!refill) return { ok: false, reason: 'NOT_FOUND' };
    if (refill.status !== 'ACCEPTED' || refill.assigneeId !== employeeId) {
      return { ok: false, reason: 'NOT_YOUR_REFILL' };
    }
    const office = this.office(refill.office);
    if (amount.currency !== office.currency) return { ok: false, reason: 'WRONG_CURRENCY' };
    if (amount.amountMinor <= 0) return { ok: false, reason: 'INVALID_AMOUNT' };

    const now = this.now();
    const left = remainingBudget(office, this.refills, now, refill.id);
    refill.purchase = { amount, receiptImage, purchasedAt: now, buyerId: employeeId, items };

    if (greaterThan(amount, left)) {
      this.log(refill, 'NEEDS_APPROVAL', `${format(amount)} exceeds remaining ${format(left)}`);
      this.deps.chat.sendDirect(
        office.managerId,
        `${refill.id}: ${employeeId} spent ${format(amount)}, only ${format(left)} was left. Please approve.`,
      );
      return { ok: true, value: refill };
    }

    this.log(refill, 'PURCHASED', `Bought for ${format(amount)}`);
    this.submitClaim(refill);
    return { ok: true, value: refill };
  }

  /** Manager accepts an over-budget purchase so the volunteer still gets paid. */
  approveOverBudget(refillId: string, managerId: string): Result<Refill> {
    const refill = this.get(refillId);
    if (!refill) return { ok: false, reason: 'NOT_FOUND' };
    if (refill.status !== 'NEEDS_APPROVAL') return { ok: false, reason: 'NOT_WAITING_FOR_APPROVAL' };
    if (this.office(refill.office).managerId !== managerId) return { ok: false, reason: 'NOT_THE_MANAGER' };
    this.log(refill, 'PURCHASED', `Over-budget purchase approved by ${managerId}`);
    this.submitClaim(refill);
    return { ok: true, value: refill };
  }

  /**
   * Called on a schedule (for example every 15 minutes). Handles everything
   * time-based: expired offers, abandoned refills, HR retries and status sync.
   */
  tick(): void {
    const now = this.now().getTime();
    for (const refill of this.refills) {
      switch (refill.status) {
        case 'OFFERED':
          if (now - refill.offeredAt!.getTime() >= this.config.offerTimeoutMs) {
            this.passOver(refill, `${refill.assigneeId} did not answer in time`);
          }
          break;
        case 'ACCEPTED':
          if (now - refill.acceptedAt!.getTime() >= this.config.completionTimeoutMs) {
            this.deps.chat.sendDirect(refill.assigneeId!, `${refill.id} was handed to someone else since it was not completed.`);
            this.passOver(refill, `${refill.assigneeId} did not complete in time`);
          }
          break;
        case 'UNASSIGNED':
          this.offerToNext(refill, true); // someone may be back in the office now
          break;
        case 'PURCHASED':
          this.submitClaim(refill); // previous attempt failed, retry
          break;
        case 'CLAIM_SUBMITTED':
          this.syncClaim(refill, now);
          break;
      }
    }
  }

  // ---------- Internals ----------

  /** isRetry: called from tick() for a refill that is already UNASSIGNED and announced. */
  private offerToNext(refill: Refill, isRetry = false): void {
    const { volunteers, presence } = this.deps;
    const chosen = chooseVolunteer(refill.office, volunteers, presence, this.refills, this.now(), refill.passedOver);

    if (!chosen) {
      refill.assigneeId = undefined;
      refill.offeredAt = undefined;
      if (!isRetry) {
        this.log(refill, 'UNASSIGNED', 'No eligible volunteer available');
        this.deps.chat.postToOfficeChannel(refill.office, `The snack box is empty and nobody is available. Can anyone help? (${refill.id})`);
      }
      return;
    }

    refill.assigneeId = chosen.employeeId;
    refill.offeredAt = this.now();
    this.log(refill, 'OFFERED', `Offered to ${chosen.employeeId}`);
    this.deps.chat.sendDirect(
      chosen.employeeId,
      `Hi ${chosen.name}, the snack box is empty. Can you refill it? Budget left: ${format(this.remaining(refill.office))}. Reply accept or decline (${refill.id}).`,
    );
  }

  private passOver(refill: Refill, note: string): void {
    if (refill.assigneeId) refill.passedOver.push(refill.assigneeId);
    refill.acceptedAt = undefined;
    refill.history.push({ at: this.now(), status: refill.status, note });
    this.offerToNext(refill);
  }

  private submitClaim(refill: Refill): void {
    const p = refill.purchase!;
    try {
      refill.claimId = this.deps.hr.createClaim({
        employeeId: p.buyerId,
        amount: p.amount, // local currency; HR converts to the buyer's payroll currency
        description: `Snack refill ${refill.office} (${refill.id})`,
        receiptImage: p.receiptImage,
      });
    } catch {
      return; // stays PURCHASED, tick() retries
    }
    refill.claimSubmittedAt = this.now();
    this.log(refill, 'CLAIM_SUBMITTED', `HR claim ${refill.claimId}`);
    this.deps.chat.sendDirect(p.buyerId, `Thanks! Your claim of ${format(p.amount)} was sent to HR.`);
  }

  private syncClaim(refill: Refill, now: number): void {
    const status = this.deps.hr.getClaimStatus(refill.claimId!);
    const buyer = refill.purchase!.buyerId;
    if (status === 'APPROVED') {
      this.log(refill, 'REIMBURSED', 'HR approved the claim');
      this.deps.chat.sendDirect(buyer, `Your snack claim ${refill.claimId} was approved.`);
    } else if (status === 'REJECTED') {
      this.log(refill, 'CLAIM_REJECTED', 'HR rejected the claim');
      this.deps.chat.sendDirect(buyer, `Your snack claim ${refill.claimId} was rejected. Your office manager has been told.`);
      this.deps.chat.sendDirect(this.office(refill.office).managerId, `HR rejected ${refill.claimId} for ${refill.id}.`);
    } else if (!refill.hrReminderSent && now - refill.claimSubmittedAt!.getTime() >= this.config.hrReminderAfterMs) {
      refill.hrReminderSent = true;
      this.deps.chat.sendDirect(
        this.office(refill.office).managerId,
        `Claim ${refill.claimId} (${refill.id}) has waited 7 days for HR approval.`,
      );
    }
  }

  private log(refill: Refill, status: RefillStatus, note: string): void {
    refill.status = status;
    refill.history.push({ at: this.now(), status, note });
  }

  private office(id: OfficeId): Office {
    const office = this.deps.offices.find((o) => o.id === id);
    if (!office) throw new Error(`Unknown office ${id}`);
    return office;
  }

  private isVolunteer(employeeId: string): boolean {
    return this.deps.volunteers.some((v) => v.employeeId === employeeId);
  }

  private now(): Date {
    return this.deps.clock.now();
  }
}
