// Demo screen for the snack counter. All rules live in src/core; the demo only
// calls RefillService and shows what it did.
//
// Each tab is ONE role, as it would be for different people on their own laptops:
//   Volunteer  – an employee in the chat tool (report empty, accept, upload receipt)
//   Manager    – approves over-budget purchases, gets HR reminders
//   HR system  – the external HR product that approves claims
//   Management – the monthly report
//   Behind the scenes – what the app knows (not a real person's screen)
// The clock is fake, so "+1 hour" / "+1 day" lets you watch timeouts happen.

import { useState } from 'react';
import type { OfficeId } from './core/types';
import { createDemo, OFFICES, VOLUNTEERS } from './demo/demoSetup';
import { humanize, officeTime, type Notice, type RunFn, type TabProps } from './demo/helpers';
import { HrTab } from './demo/HrTab';
import { ManagerTab } from './demo/ManagerTab';
import { ReportTab } from './demo/ReportTab';
import { SystemTab } from './demo/SystemTab';
import { tasksFor, VolunteerTab } from './demo/VolunteerTab';
import './App.css';

type TabId = 'volunteer' | 'manager' | 'hr' | 'report' | 'system';

export default function App() {
  // The core objects mutate in place, so we keep them in state once and bump a
  // counter after every action to make React re-render.
  const [demo, setDemo] = useState(createDemo);
  const [, setVersion] = useState(0);
  const [notice, setNotice] = useState<Notice>({ text: 'Start in the Volunteer tab: report the snack box empty.', tone: 'info' });
  const [tab, setTab] = useState<TabId>('volunteer');
  const [meId, setMeId] = useState(VOLUNTEERS[0].employeeId);
  const [managerOffice, setManagerOffice] = useState<OfficeId>('OSLO');
  const refresh = () => setVersion((v) => v + 1);
  const info = (text: string) => setNotice({ text, tone: 'info' });

  const { service, clock, hr } = demo;
  const now = clock.now();
  const refills = service.all();

  /** Runs a core command and shows whether it worked. */
  const run: RunFn = (label, action) => {
    const result = action();
    setNotice(
      result.ok
        ? { text: `${label}: ${result.value.id} is now ${humanize(result.value.status)}.`, tone: 'ok' }
        : { text: `${label}: refused — ${humanize(result.reason)}.`, tone: 'error' },
    );
    refresh();
  };

  /** Moves the fake clock forward and runs the scheduler, like a 15-minute cron would. */
  function advance(hours: number) {
    clock.advanceHours(hours);
    service.tick();
    info(`Moved time forward ${hours >= 24 ? `${hours / 24} day(s)` : `${hours} hour(s)`} and ran tick().`);
    refresh();
  }

  function reset() {
    setDemo(createDemo());
    info('Demo reset.');
  }

  // Number shown on each tab = things waiting for that role.
  const counts: Record<TabId, number> = {
    volunteer: VOLUNTEERS.reduce((n, v) => n + tasksFor(refills, v.employeeId).length, 0),
    manager: refills.filter((r) => r.status === 'NEEDS_APPROVAL').length,
    hr: [...hr.claims.values()].filter((c) => c.status === 'PENDING').length,
    report: 0,
    system: 0,
  };
  const tabs: { id: TabId; label: string; who: string }[] = [
    { id: 'volunteer', label: '🙋 Volunteer', who: 'An employee in the company chat tool. Pick who you are below.' },
    { id: 'manager', label: '👔 Office manager', who: 'Approves over-budget purchases and hears about HR problems.' },
    { id: 'hr', label: '🏢 HR system', who: 'The external HR product. Claims arrive here automatically.' },
    { id: 'report', label: '📊 Management', who: 'One monthly spend report across both offices.' },
    { id: 'system', label: '⚙️ Behind the scenes', who: 'What the app itself knows. Not a real user screen.' },
  ];
  const props: TabProps = { demo, run, notify: setNotice, refresh };

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>🍪 Snack Counter</h1>
          <p className="muted">Refill flow demo — each tab is a different person. Chat tool and HR system are simulated.</p>
        </div>
        <div className="timebar">
          <div className="clocks">
            {OFFICES.map((o) => (
              <div key={o.id} className="clock">
                <span className="muted small">{o.name}</span>
                <strong>{officeTime(now, o.timeZone)}</strong>
              </div>
            ))}
          </div>
          <div className="row">
            <span className="muted small">Simulate time:</span>
            <div className="segmented">
              <button onClick={() => advance(1)}>+1 h</button>
              <button onClick={() => advance(24)}>+1 day</button>
              <button onClick={() => advance(24 * 7)}>+7 days</button>
            </div>
            <button className="ghost" onClick={() => { service.tick(); info('Ran tick().'); refresh(); }}>Run tick</button>
            <button className="ghost" onClick={reset}>Reset</button>
          </div>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {counts[t.id] > 0 && <span className="count">{counts[t.id]}</span>}
          </button>
        ))}
      </nav>

      <div className={`notice ${notice.tone}`} role="status">{notice.text}</div>
      <p className="muted small role-hint">{tabs.find((t) => t.id === tab)!.who}</p>

      {tab === 'volunteer' && <VolunteerTab {...props} meId={meId} setMeId={setMeId} />}
      {tab === 'manager' && <ManagerTab {...props} officeId={managerOffice} setOfficeId={setManagerOffice} />}
      {tab === 'hr' && <HrTab {...props} />}
      {tab === 'report' && <ReportTab {...props} />}
      {tab === 'system' && <SystemTab {...props} />}
    </div>
  );
}
