import type { Notification, Notifier } from '../notification/index.js';
import type { AccountId } from '../shared/ids.js';

/**
 * `Notifier` fake que grava as notificações para asserção. Idempotente pela `dedupeKey`, como o
 * adapter real (`notifications_dedupe_uk`): reentrega do mesmo evento não duplica.
 * `failNext` simula falha do canal (o relay do outbox reentrega depois).
 */
export class RecordingNotifier implements Notifier {
  readonly sent: Notification[] = [];
  duplicatesIgnored = 0;
  private readonly failures: Error[] = [];

  failNext(error: Error = new Error('Falha simulada no envio da notificação')): void {
    this.failures.push(error);
  }

  notify(notification: Notification): Promise<void> {
    const failure = this.failures.shift();
    if (failure) return Promise.reject(failure);
    if (this.sent.some((n) => n.dedupeKey === notification.dedupeKey)) {
      this.duplicatesIgnored++;
      return Promise.resolve();
    }
    this.sent.push(notification);
    return Promise.resolve();
  }

  forAccount(accountId: AccountId): Notification[] {
    return this.sent.filter((n) => n.accountId === accountId);
  }

  withTemplate(template: string): Notification[] {
    return this.sent.filter((n) => n.template === template);
  }
}
