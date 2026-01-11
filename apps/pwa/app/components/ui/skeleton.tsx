import { cn } from "../../lib/cn";

type SkeletonProps = Readonly<{
  className?: string;
}>;

export const Skeleton = (props: SkeletonProps) => {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-zinc-200/70 dark:bg-zinc-800/70",
        props.className
      )}
    />
  );
};

type SkeletonTextProps = Readonly<{
  lines?: number;
  className?: string;
}>;

export const SkeletonText = (props: SkeletonTextProps) => {
  const lines = props.lines ?? 3;
  
  return (
    <div className={cn("space-y-2", props.className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn(
            "h-4",
            index === lines - 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
};

type SkeletonChatItemProps = Readonly<{
  className?: string;
}>;

export const SkeletonChatItem = (props: SkeletonChatItemProps) => {
  return (
    <div className={cn("flex items-center space-x-3 p-3", props.className)}>
      {/* Avatar */}
      <Skeleton className="h-10 w-10 rounded-full" />
      
      {/* Content */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
};

type SkeletonMessageProps = Readonly<{
  isOutgoing?: boolean;
  className?: string;
}>;

export const SkeletonMessage = (props: SkeletonMessageProps) => {
  return (
    <div className={cn(
      "flex",
      props.isOutgoing ? "justify-end" : "justify-start",
      props.className
    )}>
      <div className={cn(
        "max-w-xs space-y-2 rounded-2xl p-3",
        props.isOutgoing 
          ? "bg-zinc-100 dark:bg-zinc-800" 
          : "bg-zinc-50 dark:bg-zinc-900"
      )}>
        <SkeletonText lines={2} />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
};

type SkeletonChatListProps = Readonly<{
  count?: number;
  className?: string;
}>;

export const SkeletonChatList = (props: SkeletonChatListProps) => {
  const count = props.count ?? 5;
  
  return (
    <div className={cn("space-y-1", props.className)}>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonChatItem key={index} />
      ))}
    </div>
  );
};

type SkeletonMessageListProps = Readonly<{
  count?: number;
  className?: string;
}>;

export const SkeletonMessageList = (props: SkeletonMessageListProps) => {
  const count = props.count ?? 8;
  
  return (
    <div className={cn("space-y-4 p-4", props.className)}>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonMessage 
          key={index} 
          isOutgoing={index % 3 === 0}
        />
      ))}
    </div>
  );
};