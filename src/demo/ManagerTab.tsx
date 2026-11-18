// What an office manager sees: their budget, over-budget purchases waiting for
// them, the office's refills, and messages sent to them (rejections, HR delays).

import { format } from '../core/money';
import type { OfficeId } from '../core/types';
import { Badge, BudgetBar, ChatFeed, Stepper } from './components';
import { OFFICES } from './demoSetup';
import { nameOf, officeById, type TabProps } from './helpers';

export function ManagerTab(props: TabProps & { officeId: OfficeId; setOfficeId: (id: OfficeId) => void }) {
  const { demo, run, officeId, setOfficeId } = props;
  const { service, chat } = demo;
  const office = officeById(officeId);
  const refills = service.all().filter((r) => r.office === officeId);
  const waiting = refills.filter((r) => r.status === 'NEEDS_APPROVAL');
  const messages = chat.messages.filter((m) => m.to === office.managerId || m.to === `#${officeId}`);

  return (
    <div className="stack">
      <div className="picker">
        <span className="muted small">You are:</span>
        {OFFICES.map((o) => (
          <button key={o.id} className={`person-btn ${o.id === officeId ? 'active' : ''}`} onClick={() => setOfficeId(o.id)}>
            <span className="avatar">M</span>
            {o.name} manager
            {service.all().some((r) => r.office === o.id && r.status === 'NEEDS_APPROVAL') && <span className="dot" />}
          </button>
        ))}
      </div>

      <div className="layout">
        <div className="stack">
          <div className="card">
            <BudgetBar office={office} demo={demo} />
          </div>

          <div className="card">
            <h2>Waiting for your approval</h2>
            <p className="muted small">Purchases over the remaining budget. The volunteer already paid, so these are held, not blocked.</p>
            {waiting.length === 0 ? (
              <p className="empty">Nothing to approve.</p>
            ) : (
              <ul className="list">
                {waiting.map((r) => (
                  <li key={r.id}>
                    <div className="row space">
                      <span><strong>{format(r.purchase!.amount)}</strong> by {nameOf(r.purchase!.buyerId)}</span>
                      <button onClick={() => run(`${office.name} manager approves`, () => service.approveOverBudget(r.id, office.managerId))}>
                        Approve
                      </button>
                    </div>
                    <span className="muted small">{r.id}{r.purchase!.items?.length ? ` · ${r.purchase!.items.join(', ')}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2>{office.name} refills</h2>
            {refills.length === 0 ? (
              <p className="empty">No refills yet.</p>
            ) : (
              <ul className="list">
                {[...refills].reverse().map((r) => (
                  <li key={r.id}>
                    <div className="row space">
                      <span><strong>{r.id}</strong> <span className="muted small">· {nameOf(r.purchase?.buyerId ?? r.assigneeId)}</span></span>
                      <Badge status={r.status} />
                    </div>
                    <Stepper status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card">
          <h2>My chat</h2>
          <p className="muted small">Direct messages to the {office.name} manager and the #{officeId} channel.</p>
          <ChatFeed messages={messages} empty="No messages yet." />
        </div>
      </div>
    </div>
  );
}
