type AppEventLevel = "debug" | "info" | "warn" | "error";

type AppEvent = Readonly<{
  name: string;
  level: AppEventLevel;
  atUnixMs: number;
  scope?: Readonly<{ feature: string; action: string }>;
  context?: Readonly<Record<string, string | number | boolean | null>>;
}>;

type LogAppEventParams = Readonly<{
  name: string;
  level?: AppEventLevel;
  scope?: Readonly<{ feature: string; action: string }>;
  context?: Readonly<Record<string, string | number | boolean | null>>;
}>;

export const logAppEvent = (params: LogAppEventParams): void => {
  const event: AppEvent = {
    name: params.name,
    level: params.level ?? "info",
    atUnixMs: Date.now(),
    scope: params.scope,
    context: params.context
  };
  const payload: string = JSON.stringify(event);
  if (event.level === "error") {
    console.error(payload);
    return;
  }
  if (event.level === "warn") {
    console.warn(payload);
    return;
  }
  console.log(payload);
};
