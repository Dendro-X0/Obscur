import Image from "next/image";

type ObscurLogoProps = Readonly<{
  size?: number;
  className?: string;
  priority?: boolean;
}>;

export function ObscurLogo({ size = 32, className, priority }: ObscurLogoProps) {
  return (
    <span className={["obscur-logo", className].filter(Boolean).join(" ")} aria-hidden="true">
      <Image
        src="/obscur-logo-light.svg"
        alt=""
        width={size}
        height={size}
        unoptimized
        className="obscur-logo-mark obscur-logo-mark-light"
        priority={priority}
      />
      <Image
        src="/obscur-logo-dark.svg"
        alt=""
        width={size}
        height={size}
        unoptimized
        className="obscur-logo-mark obscur-logo-mark-dark"
        priority={priority}
      />
    </span>
  );
}
