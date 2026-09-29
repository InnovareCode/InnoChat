"use client";

import Link from "next/link";
import { cn } from "@/components/lib/cn";
import { formatRelativeTime } from "./notification-utils";
import { KIND_ICON, SEVERITY_TONE, SOURCE_VISUAL } from "./notification-visuals";
import type { AppNotification } from "./types";

/**
 * Uma linha da lista. Com `href` é um link de verdade (abre em nova aba, tem URL no hover);
 * sem `href` é só um botão que marca como lida. Não lida = ponto + fundo levemente tingido; o
 * estado também sai em texto para leitor de tela (`sr-only`), nunca só por cor.
 */
export function NotificationItem({
  notification,
  now,
  onActivate,
}: {
  notification: AppNotification;
  now: Date;
  onActivate: (notification: AppNotification) => void;
}) {
  const Icon = KIND_ICON[notification.kind];
  const source = SOURCE_VISUAL[notification.source];
  const SourceIcon = source.icon;

  const className = cn(
    "flex min-h-[44px] w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 motion-reduce:transition-none",
    "hover:bg-bg focus-visible:bg-bg focus-visible:outline-offset-[-2px]",
    !notification.read && "bg-primary/5",
  );

  const content = (
    <>
      <span
        className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", SEVERITY_TONE[notification.severity])}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cn("text-sm text-text", notification.read ? "font-medium" : "font-semibold")}>
            {!notification.read ? <span className="sr-only">Não lida: </span> : null}
            {notification.title}
          </span>
          {!notification.read ? (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          ) : null}
        </span>
        {notification.body ? (
          <span className="mt-0.5 line-clamp-2 block text-sm text-text-secondary">{notification.body}</span>
        ) : null}
        <span className="mt-1 flex items-center gap-2 text-xs text-text-secondary">
          <span className="tabular-nums">{formatRelativeTime(notification.createdAt, now)}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <SourceIcon className="h-3 w-3" aria-hidden="true" />
            {source.label}
          </span>
        </span>
      </span>
    </>
  );

  return (
    <li>
      {notification.href ? (
        <Link href={notification.href} className={className} onClick={() => onActivate(notification)}>
          {content}
        </Link>
      ) : (
        <button type="button" className={className} onClick={() => onActivate(notification)}>
          {content}
        </button>
      )}
    </li>
  );
}
