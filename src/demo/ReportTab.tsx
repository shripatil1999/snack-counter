// What management sees: one monthly total across both offices.

import { monthKey, monthlyReport } from '../core/budget';
import { format } from '../core/money';
import { BudgetBar } from './components';
import { OFFICES, REPORT_RATES } from './demoSetup';
import { officeById, type TabProps } from './helpers';

export function ReportTab({ demo }: TabProps) {
  const now = demo.clock.now();
  const month = monthKey(now, 'Europe/Oslo');
  const report = monthlyReport(OFFICES, [...demo.service.all()], month, 'NOK', REPORT_RATES);

  return (
    <div className="stack">
      <div className="grid two">
        {OFFICES.map((o) => (
          <div key={o.id} className="card"><BudgetBar office={o} demo={demo} /></div>
        ))}
      </div>
      <div className="card">
        <div className="card-head">
          <h2>Monthly report <span className="tag">{month}</span></h2>
          <span className="muted small">1 INR = {REPORT_RATES.INR} NOK (fixed monthly rate from finance)</span>
        </div>
        <table>
          <thead>
            <tr><th>Office</th><th className="num-col">Refills</th><th className="num-col">Spent</th><th className="num-col">Budget</th><th className="num-col">In NOK</th></tr>
          </thead>
          <tbody>
            {report.offices.map((l) => (
              <tr key={l.office}>
                <td>{officeById(l.office).name}</td>
                <td className="num-col">{l.refillCount}</td>
                <td className="num-col">{format(l.spentLocal)}</td>
                <td className="num-col">{format(l.budgetLocal)}</td>
                <td className="num-col">{format(l.spentInReportCurrency)}</td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={4}>Total spend, both offices</td>
              <td className="num-col">{format(report.total)}</td>
            </tr>
          </tbody>
        </table>
        <p className="muted small">Rejected claims are not counted as spend.</p>
      </div>
    </div>
  );
}
