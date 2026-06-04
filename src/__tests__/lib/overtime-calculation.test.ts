import { computeOvertimeEarnings } from '@/lib/payroll-deductions';

describe('Overtime calculation', () => {
  it('computes OT pay correctly for 2 hours at hourly rate 100 and multiplier 1.25', () => {
    const ot = computeOvertimeEarnings(2, 100, 1.25);
    expect(ot).toBe(Math.round(2 * 100 * 1.25));
  });
});
