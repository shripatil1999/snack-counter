// What one employee sees in the chat tool: the snack box in the office they are in,
// offers sent to them, the receipt form, and their own reimbursements.

import { useState } from 'react';
import { format, money } from '../core/money';
import type { RefillService } from '../core/refillService';
import type { Office, Presence, Refill, Volunteer } from '../core/types';
import { Badge, ChatFeed, Stepper } from './components';
import { OFFICES, VOLUNTEERS } from './demoSetup';
import { nameOf, officeById, type RunFn, type TabProps } from './helpers';

/** Things this volunteer must act on (used for the picker dots and the tab counter). */
export function tasksFor(refills: readonly Refill[], id: string): Refill[] {
  return refills.filter(
    (r) => (r.status === 'OFFERED' || r.status === 'ACCEPTED') && r.assigneeId === id,
  );
}

function presenceValue(p: Presence): string {
  return p.kind === 'OFFICE' ? `OFFICE:${p.office}` : p.kind;
}

function parsePresence(value: string): Presence {
  if (value === 'HOME') return { kind: 'HOME' };
  if (value === 'HOLIDAY') return { kind: 'HOLIDAY' };
  return { kind: 'OFFICE', office: value.split(':')[1] as Office['id'] };
}

export function VolunteerTab(props: TabProps & { meId: string; setMeId: (id: string) => void }) {
  const { demo, run, refresh, meId, setMeId } = props;
  const { service, presence, chat } = demo;
  const me = VOLUNTEERS.find((v) => v.employeeId === meId)!;
  const refills = service.all();

  // The snack box I can see is the one in the office I'm in today.
  const where = presence.get(me);
  const inOffice = where.kind === 'OFFICE';
  const office = officeById(inOffice ? where.office : me.homeOffice);
  const open = service.openRefillFor(office.id);

  const offeredToMe = refills.filter((r) => r.status === 'OFFERED' && r.assigneeId === meId);
  const buying = refills.filter((r) => r.status === 'ACCEPTED' && r.assigneeId === meId);
  // Anyone in the office may take an open refill that isn't already theirs.
  const canTake = inOffice && open && open.status !== 'ACCEPTED' && open.assigneeId !== meId ? open : undefined;
  const myPurchases = refills.filter((r) => r.purchase?.buyerId === meId);
  const myChat = chat.messages.filter((m) => m.to === meId || m.to === `#${office.id}`);

  return (
    <div className="stack">
      <PersonPicker meId={meId} setMeId={setMeId} refills={refills} />

      <div className="layout">
        <div className="stack">
          <div className={`card office ${open ? 'is-empty' : ''}`}>
            <div className="card-head">
              <div>
                <h2>Snack box · {office.name}</h2>
                <span className={`pill ${open ? 'warn' : 'ok'}`}>{open ? 'Empty — refill in progress' : 'Stocked'}</span>
              </div>
              <button
                disabled={!inOffice}
                title={inOffice ? '' : 'You are not in an office today'}
                onClick={() => run(`${me.name} reports the box empty`, () => service.reportEmpty(office.id, meId))}
              >
                Report empty
              </button>
            </div>
            <label className="row small">
              <span className="muted">Where am I today?</span>
              <select
                value={presenceValue(where)}
                onChange={(e) => {
                  presence.set(meId, parsePresence(e.target.value));
                  service.tick(); // an UNASSIGNED refill may now find someone
                  refresh();
                }}
              >
                {OFFICES.map((o) => <option key={o.id} value={`OFFICE:${o.id}`}>In {o.name} office</option>)}
                <option value="HOME">Working from home</option>
                <option value="HOLIDAY">On holiday</option>
              </select>
            </label>
          </div>

          <div className="card">
            <h2>My tasks</h2>
            {offeredToMe.length + buying.length === 0 && !canTake && <p className="empty">Nothing for you to do right now.</p>}

            {offeredToMe.map((r) => (
              <div key={r.id} className="task">
                <Stepper status={r.status} />
                <p className="small"><strong>You were asked to refill the {officeById(r.office).name} box</strong> ({r.id}). You have 2 hours to answer.</p>
                <div className="row">
                  <button onClick={() => run(`${me.name} accepts`, () => service.accept(r.id, meId))}>I'll buy snacks</button>
                  <button className="ghost" onClick={() => run(`${me.name} declines`, () => service.decline(r.id, meId))}>Can't do it</button>
                </div>
              </div>
            ))}

            {canTake && (
              <div className="task">
                <Stepper status={canTake.status} />
                <p className="small">
                  {canTake.status === 'UNASSIGNED'
                    ? 'Nobody was available, so the office channel was asked.'
                    : `${nameOf(canTake.assigneeId)} was asked, but anyone can take it.`}
                </p>
                <div className="row">
                  <button className="ghost" onClick={() => run(`${me.name} takes it`, () => service.accept(canTake.id, meId))}>I'll take it</button>
                </div>
              </div>
            )}

            {buying.map((r) => <PurchaseForm key={r.id} refill={r} me={me} run={run} service={service} />)}
          </div>

          <div className="card">
            <h2>My reimbursements</h2>
            {myPurchases.length === 0 ? (
              <p className="empty">You haven't bought snacks yet.</p>
            ) : (
              <ul className="list">
                {[...myPurchases].reverse().map((r) => (
                  <li key={r.id}>
                    <div className="row space">
                      <strong>{format(r.purchase!.amount)}</strong>
                      <Badge status={r.status} />
                    </div>
                    <Stepper status={r.status} />
                    <span className="muted small">{r.id} · {officeById(r.office).name}{r.claimId ? ` · ${r.claimId}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card">
          <h2>My chat</h2>
          <p className="muted small">Direct messages to {me.name} and the #{office.id} channel.</p>
          <ChatFeed messages={myChat} empty="No messages yet." />
        </div>
      </div>
    </div>
  );
}

/** Row of people to switch between. A dot shows who has something to do. */
function PersonPicker(props: { meId: string; setMeId: (id: string) => void; refills: readonly Refill[] }) {
  return (
    <div className="picker">
      <span className="muted small">You are:</span>
      {OFFICES.map((o) => (
        <div key={o.id} className="picker-group">
          <span className="muted small">{o.name}</span>
          {VOLUNTEERS.filter((v) => v.homeOffice === o.id).map((v) => (
            <button
              key={v.employeeId}
              className={`person-btn ${v.employeeId === props.meId ? 'active' : ''}`}
              onClick={() => props.setMeId(v.employeeId)}
            >
              <span className="avatar">{v.name[0]}</span>
              {v.name}
              {tasksFor(props.refills, v.employeeId).length > 0 && <span className="dot" title="Has a task" />}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Receipt upload for a refill I accepted. Amount must be in the office currency. */
function PurchaseForm({ refill, me, run, service }: { refill: Refill; me: Volunteer; run: RunFn; service: RefillService }) {
  const office = officeById(refill.office);
  const [amount, setAmount] = useState(office.currency === 'NOK' ? '450' : '1200');
  const [items, setItems] = useState('chips, fruit');

  return (
    <div className="task">
      <Stepper status={refill.status} />
      <p className="small"><strong>You're buying for {office.name}</strong> ({refill.id}). Upload the receipt within 24 hours.</p>
      <div className="row">
        <label className="field">
          <input className="num" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          <span>{office.currency}</span>
        </label>
        <input className="grow" value={items} onChange={(e) => setItems(e.target.value)} placeholder="items (optional)" />
        <button
          onClick={() =>
            run(`${me.name} uploads the receipt`, () =>
              service.recordPurchase(
                refill.id,
                me.employeeId,
                money(Number(amount), office.currency),
                'receipt.jpg',
                items.split(',').map((s) => s.trim()).filter(Boolean),
              ),
            )
          }
        >
          Upload receipt
        </button>
      </div>
    </div>
  );
}
