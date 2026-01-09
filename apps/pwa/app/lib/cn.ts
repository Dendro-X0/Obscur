type ClassValue = string | false | null | undefined;

type CnParams = ReadonlyArray<ClassValue>;

export const cn = (...values: CnParams): string => {
  return values.filter((value: ClassValue): value is string => typeof value === "string" && value.trim().length > 0).join(" ");
};
