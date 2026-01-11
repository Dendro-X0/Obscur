"use client";

import type React from "react";
import Image from "next/image";
import { User } from "lucide-react";
import { cn } from "../lib/cn";

type UserAvatarProps = Readonly<{
  username: string;
  avatarUrl: string;
  sizePx?: number;
  className?: string;
}>;

const UserAvatar = (props: UserAvatarProps): React.JSX.Element => {
  const sizePx: number = props.sizePx ?? 32;
  const initial: string = props.username.trim().slice(0, 1).toUpperCase();
  const showInitial: boolean = initial.length > 0;
  const showImage: boolean = props.avatarUrl.trim().length > 0;
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-full",
        props.className
      )}
      style={{ width: sizePx, height: sizePx }}
      aria-label={props.username ? `Avatar for ${props.username}` : "Avatar"}
    >
      {showImage ? (
        <Image src={props.avatarUrl} alt={props.username || "Avatar"} fill unoptimized className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
          {showInitial ? initial : <User className="h-4 w-4" />}
        </div>
      )}
    </div>
  );
};

export { UserAvatar };
