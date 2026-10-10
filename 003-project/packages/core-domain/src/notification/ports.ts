import type { AccountId, EventId } from '../shared/ids.js';

/** Canais (espelha `notifications.channel`). */
export type NotificationChannel = 'IN_APP' | 'EMAIL';

/** Valores aceitos no payload: só ids, títulos e valores — **sem PII** (modelo de dados §3.7). */
export type NotificationPayloadValue = string | number | boolean | null;

export interface Notification {
  readonly accountId: AccountId;
  readonly channel: NotificationChannel;
  /** Template (ex.: `bubble_exploded_success`); o texto em pt-BR é resolvido no adapter. */
  readonly template: string;
  readonly payload: Readonly<Record<string, NotificationPayloadValue>>;
  /**
   * Transacionais (cobrança, estorno, prazos) não podem ser desligados pelo usuário; os demais
   * e-mails respeitam a preferência (Spec F11).
   */
  readonly transactional: boolean;
  /** `{event_id}:{account_id}:{channel}` — entregas repetidas do mesmo evento não duplicam. */
  readonly dedupeKey: string;
}

/**
 * Porta `Notifier` (contexto notification, Spec F11): "avisar uma conta". Idempotente pela
 * `dedupeKey` (o relay do outbox entrega pelo menos uma vez). Adapters: persistência em
 * `notifications` + `notification.created` (in-app) e `EmailPort`/SMTP (e-mail), fora do domínio.
 * Fake: `RecordingNotifier` (`@bolha/core-domain/testing`).
 */
export interface Notifier {
  notify(notification: Notification): Promise<void>;
}

/** Chave de deduplicação canônica (`notifications.dedupe_key`). */
export const notificationDedupeKey = (
  eventId: EventId,
  accountId: AccountId,
  channel: NotificationChannel,
): string => `${eventId}:${accountId}:${channel}`;
