/* Bolha Venda — cadastro: escolha PF/PJ (T05), PF (T05a), PJ com verificação de CNPJ (T06). */
(function () {
  'use strict';
  const BV = window.BV, U = BV.util;
  const CA = (BV.cadastro = {});
  let root, F;
  const COMPANIES = {
    '12345678000195': { razao: 'Mercadão Distribuidora Ltda', cnae: '4649-4/99 · Comércio atacadista', situacao: 'Ativa', ok: true },
    '11222333000181': { razao: 'Antiga Comercial ME', cnae: '4789-0/99 · Comércio varejista', situacao: 'Baixada', ok: false }
  };
  function fresh() {
    return { kind: 'PJ', cnpj: '12.345.678/0001-95', cnpjSt: 'ok', co: COMPANIES['12345678000195'], coOk: true, nome: 'Carlos Silva', cpf: '123.456.789-09', email: 'carlos@mercadao.com.br', senha: 'bolha2026', show: false, terms: false, tried: false, busy: false, done: false };
  }
  const pw = () => [[F.senha.length >= 8, 'Pelo menos 8 caracteres'], [/[a-zA-Z]/.test(F.senha), 'Uma letra'], [/\d/.test(F.senha), 'Um número']];

  function errors() {
    const e = [];
    if (F.kind === 'PJ') {
      if (!U.validCNPJ(F.cnpj)) e.push({ id: 'ca-cnpj', msg: 'CNPJ: confira os 14 dígitos.' });
      else if (F.cnpjSt !== 'ok') e.push({ id: 'ca-cnpj', msg: F.cnpjSt === 'inactive' ? 'CNPJ: só empresas ativas na Receita podem se cadastrar.' : 'CNPJ: toque em Consultar para verificar a empresa.' });
      else if (!F.coOk) e.push({ id: 'ca-cook', msg: 'Empresa: confirme que estes são os dados da sua empresa.' });
    }
    if (F.nome.trim().split(/\s+/).length < 2) e.push({ id: 'ca-nome', msg: 'Nome completo: informe nome e sobrenome.' });
    if (!U.validCPF(F.cpf)) e.push({ id: 'ca-cpf', msg: 'CPF: número inválido. Confira os 11 dígitos.' });
    if (!U.validEmail(F.email)) e.push({ id: 'ca-email', msg: 'E-mail: use o formato nome@dominio.com.' });
    if (pw().some((r) => !r[0])) e.push({ id: 'ca-senha', msg: 'Senha: atenda aos 3 requisitos.' });
    if (!F.terms) e.push({ id: 'ca-terms', msg: 'Termos: aceite os Termos de uso e a Política de privacidade.' });
    return e;
  }
  const field = (errs, id) => { const x = errs.find((y) => y.id === id); return { attr: x ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : '', msg: x ? '<p class="field__error" id="' + id + '-err">' + U.icon('alert') + U.esc(x.msg.replace(/^[^:]+: /, '')) + '</p>' : '' }; };

  function pwList() {
    return pw().map((r) => '<li class="' + (r[0] ? 'ok' : '') + '">' + U.icon(r[0] ? 'check' : 'x') + r[1] + '<span class="sr-only">' + (r[0] ? ' (atendido)' : ' (pendente)') + '</span></li>').join('');
  }

  function companyBox(errs) {
    if (F.cnpjSt === 'loading') return '<div class="box" role="status">' + U.icon('loader', 'spinner') + ' Consultando a Receita Federal…</div>';
    if (F.cnpjSt === 'invalid') return '<p class="field__error" id="ca-cnpj-err" role="alert">' + U.icon('alert') + 'CNPJ inválido. Confira os 14 dígitos.</p>';
    if (F.cnpjSt === 'inactive') return '<div class="alert alert--danger" role="alert">' + U.icon('alert') + '<div><strong>' + U.esc(F.co.razao) + '</strong><br>Situação na Receita: ' + F.co.situacao + '. Só empresas ativas podem se cadastrar.</div></div>';
    if (F.cnpjSt === 'ok') {
      const f = field(errs, 'ca-cook');
      return '<div class="co-box" role="status"><dl class="kv kv--left"><dt>Razão social</dt><dd>' + U.esc(F.co.razao) + '</dd><dt>CNAE</dt><dd>' + U.esc(F.co.cnae) + '</dd><dt>Situação</dt><dd style="color:var(--ok)">' + U.icon('check') + ' ' + F.co.situacao + '</dd></dl>' +
        '<label class="check" style="margin-top:12px"><input type="checkbox" id="ca-cook" data-change="ca-cook"' + (F.coOk ? ' checked' : '') + f.attr + '><span>Confirmo que estes são os dados da minha empresa</span></label>' + f.msg + '</div>';
    }
    return '';
  }

  CA.render = () => {
    root = U.$('#view-page');
    if (!F) F = fresh();
    if (F.done) {
      U.rerender(root, '<div class="signup"><div class="signup__hero">' + hero() + '</div><div class="signup__main"><div class="signup__form" style="text-align:center">' +
        '<div class="map-empty__art" style="border-color:var(--ok);color:var(--ok)">' + U.icon('checkCircle') + '</div>' +
        '<h1 class="page-title" id="page-h" tabindex="-1" style="margin-top:16px">Confira seu e-mail</h1>' +
        '<p style="color:var(--text-2);margin:10px 0 24px">Se os dados forem válidos, enviaremos a confirmação por e-mail para <strong>' + U.esc(F.email) + '</strong>.' + (F.kind === 'PJ' ? ' A verificação do CNPJ leva até 1 dia útil.' : '') + '</p>' +
        '<button type="button" class="btn btn--primary btn--lg" data-action="ca-explore">Explorar bolhas</button></div></div></div>');
      return;
    }
    const errs = F.tried ? errors() : [];
    const fN = field(errs, 'ca-nome'), fC = field(errs, 'ca-cpf'), fE = field(errs, 'ca-email'), fS = field(errs, 'ca-senha'), fT = field(errs, 'ca-terms'), fJ = field(errs, 'ca-cnpj');
    U.rerender(root,
      '<div class="signup"><div class="signup__hero">' + hero() + '</div><div class="signup__main"><form class="signup__form" novalidate data-submit="ca-submit" aria-labelledby="page-h">' +
      '<h1 class="page-title" id="page-h" tabindex="-1">Criar conta</h1><p style="color:var(--text-2)">Já tem conta? <a href="#/" data-action="login-demo-home">Entrar</a></p>' +
      (errs.length ? '<div class="error-summary" role="alert" tabindex="-1" id="ca-sum"><strong>' + (errs.length === 1 ? 'Corrija 1 campo para continuar' : 'Corrija ' + errs.length + ' campos para continuar') + '</strong><ul>' +
        errs.map((x) => '<li><a href="#' + x.id + '" data-action="focus-field" data-target="' + x.id + '">' + U.esc(x.msg) + '</a></li>').join('') + '</ul></div>' : '') +
      '<fieldset class="fieldset"><legend class="field__label">Como você vai usar o Bolha Venda?</legend><div class="grid-2">' +
        '<label class="radio-card radio-card--tall"><input type="radio" name="ca-kind" value="PF" data-change="ca-kind"' + (F.kind === 'PF' ? ' checked' : '') + '>' + U.icon('user') +
          '<span><span class="radio-card__title">Pessoa física</span><br><span class="radio-card__sub">Entre com 1 cota por bolha e crie bolhas de compra.</span></span></label>' +
        '<label class="radio-card radio-card--tall"><input type="radio" name="ca-kind" value="PJ" data-change="ca-kind"' + (F.kind === 'PJ' ? ' checked' : '') + '>' + U.icon('building') +
          '<span><span class="radio-card__title">Empresa</span><br><span class="radio-card__sub">Compre várias cotas, venda em lote e dê lances.</span></span></label></div></fieldset>' +
      (F.kind === 'PJ' ? '<section class="card card--pad signup__sec" aria-labelledby="ca-emp-h"><h2 class="section-title" id="ca-emp-h">Empresa</h2>' +
        '<div class="field"><label class="field__label" for="ca-cnpj">CNPJ</label><div class="cnpj-row"><input class="input mono" id="ca-cnpj" inputmode="numeric" autocomplete="off" value="' + U.esc(F.cnpj) + '" data-input="ca-cnpj"' + fJ.attr + '>' +
        '<button type="button" class="btn btn--secondary" data-action="ca-consult"' + (F.cnpjSt === 'loading' ? ' disabled' : '') + '>Consultar</button></div>' + (F.cnpjSt === 'idle' ? fJ.msg : '') +
        '<div id="ca-co" aria-live="polite">' + companyBox(errs) + '</div></div></section>' : '') +
      '<section class="card card--pad signup__sec" aria-labelledby="ca-pes-h"><h2 class="section-title" id="ca-pes-h">' + (F.kind === 'PJ' ? 'Pessoa responsável' : 'Seus dados') + '</h2>' +
        '<div class="grid-2"><div class="field"><label class="field__label" for="ca-nome">Nome completo</label><input class="input" id="ca-nome" autocomplete="name" value="' + U.esc(F.nome) + '" data-input="ca" data-k="nome"' + fN.attr + '>' + fN.msg + '</div>' +
        '<div class="field"><label class="field__label" for="ca-cpf">CPF</label><input class="input mono" id="ca-cpf" inputmode="numeric" value="' + U.esc(F.cpf) + '" data-input="ca-cpf"' + fC.attr + '>' + fC.msg + '</div></div>' +
        '<div class="field"><label class="field__label" for="ca-email">E-mail</label><input class="input" id="ca-email" type="email" autocomplete="email" value="' + U.esc(F.email) + '" data-input="ca" data-k="email"' + fE.attr + '>' + fE.msg + '</div>' +
        '<div class="field"><label class="field__label" for="ca-senha">Senha</label><div class="input-affix"><input class="input" id="ca-senha" type="' + (F.show ? 'text' : 'password') + '" autocomplete="new-password" value="' + U.esc(F.senha) + '" data-input="ca-senha" aria-describedby="ca-pw-reqs' + (fS.attr ? ' ca-senha-err' : '') + '"' + (fS.attr ? ' aria-invalid="true"' : '') + '>' +
        '<button type="button" class="btn btn--ghost btn--sm input-affix__btn" data-action="ca-show" aria-pressed="' + F.show + '">' + (F.show ? 'Ocultar' : 'Mostrar') + '<span class="sr-only"> senha</span></button></div>' +
        '<ul class="pw-reqs" id="ca-pw-reqs">' + pwList() + '</ul>' + fS.msg + '</div></section>' +
      '<div class="field"><label class="check"><input type="checkbox" id="ca-terms" data-change="ca-terms"' + (F.terms ? ' checked' : '') + fT.attr + '><span>Li e aceito os <a href="#" data-action="ca-doc">Termos de uso</a> e a <a href="#" data-action="ca-doc">Política de privacidade</a>.</span></label>' + fT.msg + '</div>' +
      '<button type="submit" class="btn btn--primary btn--lg btn--block" id="ca-submit"' + (F.busy ? ' disabled' : '') + '>' + (F.busy ? U.icon('loader', 'spinner') + 'Criando conta…' : 'Criar conta') + '</button>' +
      '<p class="field__hint" style="text-align:center">Usamos seus dados só para operar sua conta e cumprir a lei (LGPD). Seu nome nunca aparece nas bolhas: você usa um apelido.</p>' +
      '</form></div></div>');
  };

  function hero() {
    const mini = (t, d, x, y) => '<span class="hero-bubble hero-bubble--' + t + '" style="width:' + d + 'px;height:' + d + 'px;left:' + x + 'px;top:' + y + 'px" aria-hidden="true"><span class="b-film"></span><span class="b-iris"></span><span class="b-shine"></span></span>';
    return '<a class="brand" href="#/">' + '<span class="brand__logo" aria-hidden="true"></span>Bolha Venda</a>' +
      '<p class="hero-title">Quanto mais gente entra, menor o preço para todos.</p>' +
      '<p class="hero-sub">Empresas vendem lotes com desconto progressivo, compram várias cotas e dão lances em bolhas de compra.</p>' +
      '<div class="hero-art">' + mini('sale', 170, 10, 0) + mini('buy', 130, 190, 90) + mini('near', 70, 130, 200) + '</div>';
  }

  BV.inputs.ca = (el) => { F[el.dataset.k] = el.value; };
  BV.inputs['ca-kind'] = (el) => { F.kind = el.value; CA.render(); };
  BV.inputs['ca-cnpj'] = (el) => {
    const pos = el.selectionStart, before = el.value.length;
    el.value = U.maskCNPJ(el.value);
    try { el.setSelectionRange(pos + (el.value.length - before), pos + (el.value.length - before)); } catch (e) { /* ok */ }
    if (F.cnpj !== el.value) { F.cnpj = el.value; if (F.cnpjSt !== 'idle') { F.cnpjSt = 'idle'; F.co = null; F.coOk = false; U.$('#ca-co').innerHTML = ''; } }
  };
  BV.inputs['ca-cpf'] = (el) => { el.value = U.maskCPF(el.value); F.cpf = el.value; };
  BV.inputs['ca-senha'] = (el) => { F.senha = el.value; U.$('#ca-pw-reqs').innerHTML = pwList(); };
  BV.inputs['ca-cook'] = (el) => { F.coOk = el.checked; if (F.tried) CA.render(); };
  BV.inputs['ca-terms'] = (el) => { F.terms = el.checked; if (F.tried) CA.render(); };
  BV.actions['ca-show'] = () => { F.show = !F.show; CA.render(); };
  BV.actions['ca-doc'] = (a, e) => { e.preventDefault(); U.toast('Os documentos completos ficam em /termos e /privacidade (fora do escopo deste protótipo).', 'info'); };
  BV.actions['ca-consult'] = () => {
    if (!U.validCNPJ(F.cnpj)) { F.cnpjSt = 'invalid'; CA.render(); U.$('#ca-cnpj').focus(); return; }
    F.cnpjSt = 'loading'; CA.render();
    setTimeout(() => {
      const co = COMPANIES[U.digits(F.cnpj)] || { razao: 'Empresa Exemplo Comércio Ltda', cnae: '4751-2/01 · Comércio de informática', situacao: 'Ativa', ok: true };
      F.co = co; F.cnpjSt = co.ok ? 'ok' : 'inactive'; F.coOk = false;
      CA.render();
      const c = U.$('#ca-cook'); if (c) c.focus();
    }, 900);
  };
  BV.actions['ca-explore'] = () => { const k = F.kind; F = null; BV.app.setPersona(k === 'PJ' ? 'pj' : 'pf'); location.hash = '#/'; };
  BV.actions['login-demo-home'] = (a, e) => { e.preventDefault(); BV.app.setPersona('pf'); location.hash = '#/'; };
  BV.submits = BV.submits || {};
  BV.submits['ca-submit'] = () => {
    const errs = errors();
    if (errs.length) { F.tried = true; CA.render(); U.$('#ca-sum').focus(); return; }
    F.busy = true; CA.render();
    setTimeout(() => { F.busy = false; F.done = true; CA.render(); U.$('#page-h').focus(); U.announce('Conta criada. Se os dados forem válidos, enviaremos a confirmação por e-mail.'); }, 1000);
  };
})();
