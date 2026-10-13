#!/usr/bin/env node
// Janela de deploy em produção (BV-106; pipeline-ci-cd.md §4):
//   - segunda a quinta, 10h–16h BRT (America/Sao_Paulo, UTC−3 — sem horário de verão desde 2019);
//   - nunca sexta, fim de semana, feriado nacional ou véspera de feriado;
//   - fora da janela só com `override_window: true` + justificativa (hotfix S1/S2).
// Os critérios de "incidente aberto" e "error budget esgotado" dependem da observabilidade
// (BV-108 / slo-observabilidade.md §3) e ainda não são verificados aqui.
//
// Uso (CI): node tools/deploy/check-window.mjs
//   Env: OVERRIDE_WINDOW=true|false, OVERRIDE_JUSTIFICATION="...", DEPLOY_NOW=<ISO> (só testes).
//   Sai com 1 quando o deploy está bloqueado.
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BRT_OFFSET_HOURS = -3;
const WINDOW_START_HOUR = 10;
const WINDOW_END_HOUR = 16;
const MIN_JUSTIFICATION_LENGTH = 15;

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), em UTC. */
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * Feriados nacionais (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023) e pontos facultativos
 * nacionais em que não se faz deploy (Carnaval, Corpus Christi). Datas `YYYY-MM-DD`.
 */
export function nationalHolidays(year) {
  const fixed = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];
  const easter = easterSunday(year);
  const movable = [
    addDays(easter, -48), // segunda de Carnaval
    addDays(easter, -47), // terça de Carnaval
    addDays(easter, -2), // Sexta-feira Santa
    addDays(easter, 60), // Corpus Christi
  ].map(isoDay);
  return new Set([...fixed.map((md) => `${year}-${md}`), ...movable]);
}

function isHoliday(day) {
  return nationalHolidays(Number(day.slice(0, 4))).has(day);
}

/**
 * Avalia a janela para o instante `now`. Retorna `{ allowed, reason, brt }`.
 * @param {Date} now
 */
export function checkDeployWindow(now) {
  // Data/hora "de parede" em BRT, representada num Date UTC deslocado.
  const brt = new Date(now.getTime() + BRT_OFFSET_HOURS * 3_600_000);
  const day = isoDay(brt);
  const weekday = brt.getUTCDay(); // 0 = domingo
  const minutes = brt.getUTCHours() * 60 + brt.getUTCMinutes();
  const label = `${day} ${brt.toISOString().slice(11, 16)} BRT`;

  if (weekday === 0 || weekday === 5 || weekday === 6) {
    return { allowed: false, reason: `${label}: deploy só de segunda a quinta.`, brt: label };
  }
  if (isHoliday(day)) {
    return { allowed: false, reason: `${label}: feriado nacional.`, brt: label };
  }
  if (isHoliday(isoDay(addDays(brt, 1)))) {
    return { allowed: false, reason: `${label}: véspera de feriado nacional.`, brt: label };
  }
  if (minutes < WINDOW_START_HOUR * 60 || minutes >= WINDOW_END_HOUR * 60) {
    return { allowed: false, reason: `${label}: fora do horário 10h–16h BRT.`, brt: label };
  }
  return { allowed: true, reason: `${label}: dentro da janela de deploy.`, brt: label };
}

/**
 * Aplica o override de hotfix: fora da janela, só passa com override + justificativa.
 * @param {{ allowed: boolean, reason: string }} window
 * @param {{ override: boolean, justification: string }} opts
 */
export function decide(window, { override, justification }) {
  if (window.allowed) return { allowed: true, overridden: false, message: window.reason };
  if (!override) {
    return {
      allowed: false,
      overridden: false,
      message: `${window.reason} Para hotfix S1/S2, rode com override_window=true e justificativa.`,
    };
  }
  if (justification.trim().length < MIN_JUSTIFICATION_LENGTH) {
    return {
      allowed: false,
      overridden: false,
      message: `${window.reason} Override exige justificativa com pelo menos ${MIN_JUSTIFICATION_LENGTH} caracteres.`,
    };
  }
  return {
    allowed: true,
    overridden: true,
    message: `${window.reason} Override autorizado: ${justification.trim()}`,
  };
}

function main() {
  const now = process.env.DEPLOY_NOW ? new Date(process.env.DEPLOY_NOW) : new Date();
  if (Number.isNaN(now.getTime())) {
    console.error(`DEPLOY_NOW inválido: ${process.env.DEPLOY_NOW}`);
    process.exit(2);
  }
  const result = decide(checkDeployWindow(now), {
    override: process.env.OVERRIDE_WINDOW === 'true',
    justification: process.env.OVERRIDE_JUSTIFICATION ?? '',
  });
  const gha = Boolean(process.env.GITHUB_ACTIONS);
  if (!result.allowed) {
    console.log(gha ? `::error title=Janela de deploy::${result.message}` : result.message);
  } else if (result.overridden) {
    console.log(
      gha ? `::warning title=Janela de deploy (override)::${result.message}` : result.message,
    );
  } else {
    console.log(result.message);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const icon = result.allowed ? (result.overridden ? 'override' : 'ok') : 'bloqueado';
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Janela de deploy: ${icon}\n\n${result.message}\n`,
    );
  }
  process.exit(result.allowed ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
