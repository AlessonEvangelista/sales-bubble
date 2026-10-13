import type { AccountStatus } from '@bolha/contracts';

/**
 * Status do banco (CHECK `accounts_status_ck`, BV-107) → status do contrato (BV-111).
 * Divergência registrada no log da sessão: o banco ainda não distingue "e-mail não confirmado"
 * de "CNPJ pendente" (ambos `PENDING_VERIFICATION`) nem tem `INCOMPLETE` (OAuth). No R1 só a PF
 * chega a `PENDING_VERIFICATION` (cadastro aguardando confirmação de e-mail).
 */
const TO_API: Record<string, AccountStatus> = {
  PENDING_VERIFICATION: 'PENDING_EMAIL_CONFIRMATION',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
};

export function toApiAccountStatus(status: string): AccountStatus {
  const mapped = TO_API[status];
  if (!mapped) throw new Error(`status de conta sem representação na API: ${status}`);
  return mapped;
}
