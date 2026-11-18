/** Injected so tests can move time forward instead of waiting hours. */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FakeClock implements Clock {
  private current: Date;

  constructor(start: Date) {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  advanceHours(hours: number): void {
    this.current = new Date(this.current.getTime() + hours * 3_600_000);
  }

  set(date: Date): void {
    this.current = new Date(date);
  }
}

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
