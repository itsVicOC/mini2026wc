declare module 'node-cron' {
  export type ScheduledTask = {
    start(): void;
    stop(): void;
    destroy(): void;
  };

  export function schedule(
    expression: string,
    task: () => void | Promise<void>,
    options?: Record<string, unknown>
  ): ScheduledTask;

  const cron: {
    schedule: typeof schedule;
  };

  export default cron;
}
