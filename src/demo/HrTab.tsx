// The external HR system (simulated). In real life this is a separate product;
// approving here stands in for HR's 1–10 day process.

import { format } from '../core/money';
import { Badge } from './components';
import { nameOf, type TabProps } from './helpers';

export function HrTab({ demo, notify, refresh }: TabProps) {
  const { hr, service } = demo;
  const claims = [...hr.claims.entries()].reverse();

  /** HR decides; the app only notices on its next tick, like a real poll. */
  function decide(id: string, approve: boolean) {
    if (approve) hr.approve(id);
    else hr.reject(id);
    service.tick();
    notify({ text: `HR ${approve ? 'approved' : 'rejected'} ${id}.`, tone: approve ? 'ok' : 'error' });
    refresh();
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Reimbursement claims <span className="tag">external system</span></h2>
          <p className="muted small">The app creates these claims automatically after a purchase. It never pays anyone itself.</p>
        </div>
        <label className="toggle small">
          <input type="checkbox" checked={hr.unavailable} onChange={(e) => { hr.unavailable = e.target.checked; refresh(); }} />
          Simulate HR system down
        </label>
      </div>
      {claims.length === 0 ? (
        <p className="empty">No claims yet. They appear here after a volunteer uploads a receipt.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Claim</th><th>Employee</th><th>Description</th><th className="num-col">Amount</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {claims.map(([id, c]) => (
              <tr key={id}>
                <td>{id}</td>
                <td>{nameOf(c.employeeId)}</td>
                <td className="muted">{c.description}</td>
                <td className="num-col">{format(c.amount)}</td>
                <td><Badge status={c.status} /></td>
                <td>
                  {c.status === 'PENDING' && (
                    <div className="row">
                      <button className="sm" onClick={() => decide(id, true)}>Approve</button>
                      <button className="sm ghost" onClick={() => decide(id, false)}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
