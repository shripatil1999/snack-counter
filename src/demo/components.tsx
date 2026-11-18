// Small presentational pieces reused by several role tabs.

import type { ChatMessage } from '../adapters/chatTool';
import { format } from '../core/money';
import type { Office, RefillStatus } from '../core/types';
import type { Demo } from './demoSetup';
import { humanize, nameOf } from './helpers';

export function Badge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{humanize(status)}</span>;
}

// Lifecycle steps shown in the stepper, and where each status sits on it.
const STEPS = ['Offered', 'Accepted', 'Purchased', 'Claim sent', 'Reimbursed'];
const STEP_OF: Record<RefillStatus, number> = {
  UNASSIGNED: 0, OFFERED: 0, ACCEPTED: 1, NEEDS_APPROVAL: 2, PURCHASED: 2,
  CLAIM_SUBMITTED: 3, REIMBURSED: 4, CLAIM_REJECTED: 3,
};

/** Progress bar of the refill lifecycle: done steps filled, current step highlighted. */
export function Stepper({ status }: { status: RefillStatus }) {
  const current = STEP_OF[status];
  return (
    <ol className="stepper">
      {STEPS.map((s, i) => (
        <li key={s} className={i < current ? 'done' : i === current ? 'current' : ''}>{s}</li>
      ))}
    </ol>
  );
}

/** Budget left this month for one office, with a bar that turns amber/red. */
export function BudgetBar({ office, demo }: { office: Office; demo: Demo }) {
  const left = demo.service.remaining(office.id);
  const usedPct = Math.min(100, Math.max(0, 100 - (left.amountMinor / office.monthlyBudget.amountMinor) * 100));
  const tone = usedPct >= 100 ? 'over' : usedPct >= 80 ? 'warn' : '';
  return (
    <div className="budget">
      <div className="row space small">
        <span className="muted">{office.name} budget left this month</span>
        <span><strong className="big">{format(left)}</strong> <span className="muted">of {format(office.monthlyBudget)}</span></span>
      </div>
      <div className={`bar ${tone}`}><div style={{ width: `${usedPct}%` }} /></div>
    </div>
  );
}

/** Chat messages, newest first. Direct messages and channel posts look different. */
export function ChatFeed({ messages, empty }: { messages: ChatMessage[]; empty: string }) {
  if (messages.length === 0) return <p className="empty">{empty}</p>;
  return (
    <ul className="chat">
      {[...messages].reverse().map((m, i) => (
        <li key={messages.length - i} className={m.to.startsWith('#') ? 'channel' : 'dm'}>
          <span className="to">{m.to.startsWith('#') ? `${m.to} channel` : `Direct to ${nameOf(m.to)}`}</span>
          <span>{m.text}</span>
        </li>
      ))}
    </ul>
  );
}
