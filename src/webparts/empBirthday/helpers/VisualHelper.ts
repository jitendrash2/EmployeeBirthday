export type BackgroundVariant =
  | "simple"
  | "celebration"
  | "sunrise"
  | "meadow"
  | "royal";

const validBackgroundVariants: BackgroundVariant[] = [
  "simple",
  "celebration",
  "sunrise",
  "meadow",
  "royal"
];

export function resolveBackgroundVariant(
  configuredVariant?: string,
  legacyBackgroundImage?: string
): BackgroundVariant {
  if (
    configuredVariant &&
    validBackgroundVariants.includes(configuredVariant as BackgroundVariant)
  ) {
    return configuredVariant as BackgroundVariant;
  }

  const legacyValue = legacyBackgroundImage?.toLowerCase() ?? "";

  if (legacyValue.includes("image-2")) {
    return "sunrise";
  }

  if (legacyValue.includes("image-3")) {
    return "meadow";
  }

  if (legacyValue.includes("image-4")) {
    return "royal";
  }

  return "simple";
}

export function getInitials(name?: string, fallback: string = "EA"): string {
  const parts = name
    ?.split(" ")
    .map((part) => part.trim())
    .filter(Boolean) ?? [];

  if (parts.length === 0) {
    return fallback;
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
