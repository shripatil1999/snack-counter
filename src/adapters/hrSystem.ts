import type { Money } from '../core/types';

export interface ClaimRequest {
  employeeId: string;
  amount: Money;
  description: string;
  receiptImage: string;
}

export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** What the core needs from the external HR system. */
export interface HrSystem {
  createClaim(request: ClaimRequest): string; // returns claim id
  getClaimStatus(claimId: string): ClaimStatus;
}

/** Simulated HR system. Tests decide when a claim is approved or rejected. */
export class FakeHrSystem implements HrSystem {
  readonly claims = new Map<string, ClaimRequest & { status: ClaimStatus }>();
  /** Set to true to simulate the HR system being down. */
  unavailable = false;
  private nextId = 1;

  createClaim(request: ClaimRequest): string {
    if (this.unavailable) throw new Error('HR system unavailable');
    const id = `claim-${this.nextId++}`;
    this.claims.set(id, { ...request, status: 'PENDING' });
    return id;
  }

  getClaimStatus(claimId: string): ClaimStatus {
    const claim = this.claims.get(claimId);
    if (!claim) throw new Error(`Unknown claim ${claimId}`);
    return claim.status;
  }

  approve(claimId: string): void {
    this.setStatus(claimId, 'APPROVED');
  }

  reject(claimId: string): void {
    this.setStatus(claimId, 'REJECTED');
  }

  private setStatus(claimId: string, status: ClaimStatus): void {
    const claim = this.claims.get(claimId);
    if (!claim) throw new Error(`Unknown claim ${claimId}`);
    claim.status = status;
  }
}
