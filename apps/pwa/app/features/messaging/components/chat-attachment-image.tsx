"use client";

import React from "react";
import { OptimizedImage } from "@/app/components/optimized-image";
import { useChatAttachmentDisplaySrc } from "../hooks/use-chat-attachment-display-src";

type ChatAttachmentImageProps = Readonly<{
  remoteUrl: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  fill?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
  onRequestOpenExternalLink?: (url: string) => void;
}>;

/**
 * Chat bubble image: resolves local/LES display src and native-fetch fallthrough on error.
 * Keeps `remoteUrl` as message identity for Open / lightbox.
 */
export function ChatAttachmentImage({
  remoteUrl,
  alt,
  className,
  containerClassName,
  fill = true,
  style,
  onClick,
  onRequestOpenExternalLink,
}: ChatAttachmentImageProps): React.JSX.Element {
  const { displaySrc, recoverFromLoadFailure } = useChatAttachmentDisplaySrc(remoteUrl);

  return (
    <OptimizedImage
      src={displaySrc}
      openUrl={remoteUrl}
      alt={alt}
      fill={fill}
      containerClassName={containerClassName}
      className={className}
      style={style}
      onClick={onClick}
      onRequestOpenExternalLink={onRequestOpenExternalLink}
      onRecoverFromLoadFailure={recoverFromLoadFailure}
    />
  );
}
