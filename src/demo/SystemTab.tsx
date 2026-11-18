// Behind the scenes: what the app itself knows. Nobody uses this screen in real
// life; it is here to explain the fairness rule and show every refill and message.

import { DAY } from '../core/clock';
import { format } from '../core/money';
import type { Presence } from '../core/types';
import { chooseVolunteer, FAIRNESS_WINDOW_DAYS } from '../core/volunteerSelector';
import { Badge, ChatFeed } from './components';
import { OFFICES, VOLUNTEERS } from './demoSetup';
import { humanize, nameOf, officeById, type TabProps } from './helpers';

function presenceText(p: Presence): string {
  if (p.kind === 'OFFICE') return `In ${officeById(p.office).name} office`;
  return p.kind === 'HOME' ? 'Working from home' : 'On holiday';
}

export function SystemTab({ demo }: TabProps) {
  const { service, presence, clock, chat } = demo;
  const now = clock.now();
  const refills = [...service.all()];
  const since = now.getTime() - FAIRNESS_WINDOW_DAYS * DAY;
  const recentCount = (id: string) =>
    refills.filter((r) => r.purchase?.buyerId === id && r.purchase.purchasedAt.getTime() >= since).length;
  // The person each office would ask next, using the real fairness rule.
  const nextIds = OFFICES.map((o) => chooseVolunteer(o.id, VOLUNTEERS, presence, refills, now)?.employeeId);

  return (
    <div className="layout">
      <div className="stack">
        <div className="card">
          <h2>Who gets asked next</h2>
          <p className="muted small">
            Fewest refills in the last {FAIRNESS_WINDOW_DAYS} days among people in that office today; tie → longest since last
            purchase. Volunteers change "where am I today" in their own tab.
          </p>
          <table>
            <thead>
              <tr><th>Name</th><th>Home office</th><th>Today</th><th className="num-col">Refills (30 d)</th></tr>
            </thead>
            <tbody>
              {VOLUNTEERS.map((v) => (
                <tr key={v.employeeId}>
                  <td>
                    <span className="person">
                      <span className="avatar">{v.name[0]}</span>
                      {v.name}
                      {nextIds.includes(v.employeeId) && <span className="tag">next up</span>}
                    </span>
                  </td>
                  <td>{officeById(v.homeOffice).name}</td>
                  <td>{presenceText(presence.get(v))}</td>
                  <td className="num-col">{recentCount(v.employeeId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>All refills</h2>
          {refills.length === 0 ? (
            <p className="empty">No refills yet.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Refill</th><th>Office</th><th>Status</th><th>Volunteer</th><th className="num-col">Amount</th></tr>
              </thead>
              <tbody>
                {[...refills].reverse().map((r) => (
                  <tr key={r.id}>
                    <td>
                      <details>
                        <summary>{r.id}</summary>
                        <ol className="history">
                          {r.history.map((h, i) => (
                            <li key={i}><span className="muted">{h.at.toLocaleString()}</span> <strong>{humanize(h.status)}</strong> — {h.note}</li>
                          ))}
                        </ol>
                      </details>
                    </td>
                    <td>{officeById(r.office).name}</td>
                    <td><Badge status={r.status} /></td>
                    <td>{nameOf(r.purchase?.buyerId ?? r.assigneeId)}</td>
                    <td className="num-col">{r.purchase ? format(r.purchase.amount) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Every chat message</h2>
        <ChatFeed messages={chat.messages} empty="Nothing sent yet." />
      </div>
    </div>
  );
}
