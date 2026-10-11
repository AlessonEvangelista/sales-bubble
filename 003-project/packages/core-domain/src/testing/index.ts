/**
 * `@bolha/core-domain/testing` — implementações fake/in-memory e determinísticas das portas do
 * domínio (EN-032 / BV-112), para testes unitários do domínio, testes dos módulos Nest e para o
 * modo `PAYMENT_PROVIDER=fake` / `CNPJ_PROVIDER=fake` em dev. Exportado por subpath para não
 * entrar na API de produção do pacote.
 */
export * from './fake-cnpj-port.js';
export * from './fake-payment-port.js';
export * from './fixed-clock.js';
export * from './in-memory-unit-of-work.js';
export * from './recording-notifier.js';
export * from './sequential-id-generator.js';
