const GOOGLE_CLIENT_ID_PADRAO =
  "248632474679-8663hgsnun8q5ddq98cc2kf23u23844p.apps.googleusercontent.com";
const API_BASE_URL_PADRAO = "https://frontendteamscup.com.br/api";
const TEMPO_LIMITE_LOGIN_MS = 15_000;
// Marca oficial do Google, como nos botões de login do próprio Google.
const MARCA_GOOGLE =
  '<svg viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.87 2.69-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A8.65 8.65 0 0 0 9 0 9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/></svg>';

const parametros = new URLSearchParams(window.location.search);
const callbackUrl = sanitizarTexto(parametros.get("callback"));
const callbackState = sanitizarTexto(parametros.get("state"));
const googleClientId = GOOGLE_CLIENT_ID_PADRAO;
const apiBaseUrl = API_BASE_URL_PADRAO;
let erroConfiguracao = "";

try {
  const apiBaseUrlSolicitada = sanitizarTexto(parametros.get("apiBaseUrl"));
  const googleClientIdSolicitado = sanitizarTexto(
    parametros.get("googleClientId"),
  );

  if (
    apiBaseUrlSolicitada &&
    normalizarApiBaseUrl(apiBaseUrlSolicitada) !== API_BASE_URL_PADRAO
  ) {
    throw new Error("A URL da API informada não é autorizada por este site.");
  }

  if (
    googleClientIdSolicitado &&
    googleClientIdSolicitado !== GOOGLE_CLIENT_ID_PADRAO
  ) {
    throw new Error("O Client ID Google informado não é autorizado por este site.");
  }
} catch (erro) {
  erroConfiguracao = erroTexto(erro);
}
let modoAtual = parametros.get("mode") === "register" ? "register" : "login";
let autenticacaoEmAndamento = false;
let googleTokenClient;

const notice = document.getElementById("notice");
const statusBox = document.getElementById("status");
const googleButtonContainer = document.getElementById("googleButton");
const googleCard = document.getElementById("googleAuth");
const rememberInput = document.getElementById("remember");
const tabs = Array.from(document.querySelectorAll("[data-mode]"));

tabs.forEach((tab) => {
  tab.addEventListener("click", () => definirModo(tab.dataset.mode));
});

window.addEventListener("load", () => {
  definirModo(modoAtual);
  if (erroConfiguracao) {
    bloquearGoogle(erroConfiguracao);
    return;
  }
  inicializarBotaoGoogle();
});

let resizeTimer;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (!autenticacaoEmAndamento && window.google?.accounts?.oauth2) {
      renderizarBotaoGoogle();
    }
  }, 150);
});

function definirModo(modo) {
  modoAtual = modo === "register" ? "register" : "login";
  tabs.forEach((tab) => {
    const ativo = tab.dataset.mode === modoAtual;
    tab.classList.toggle("active", ativo);
    tab.setAttribute("aria-selected", String(ativo));
  });

  if (notice) {
    notice.textContent = modoAtual === "register"
      ? "Cadastre-se com a sua conta Google."
      : "Use a conta Google com o e-mail cadastrado no torneio.";
  }

  if (
    !autenticacaoEmAndamento &&
    window.google?.accounts?.oauth2 &&
    googleButtonContainer?.childNodes.length
  ) {
    renderizarBotaoGoogle();
  }
}

function inicializarBotaoGoogle(tentativa = 0) {
  if (!googleCard || !googleButtonContainer) {
    return;
  }

  if (!googleClientId) {
    bloquearGoogle(
      "Client ID do Google ausente. Configure flexboxTrainer.googleClientId.",
    );
    return;
  }

  if (!window.google?.accounts?.oauth2) {
    if (tentativa < 20) {
      window.setTimeout(() => inicializarBotaoGoogle(tentativa + 1), 250);
      return;
    }

    bloquearGoogle(
      "Não foi possível carregar o Google Identity Services. Verifique a conexão e bloqueadores do navegador.",
    );
    return;
  }

  try {
    googleTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: "openid email profile",
      include_granted_scopes: false,
      callback: receberTokenAcessoGoogle,
      error_callback: tratarErroOAuthGoogle,
    });

    googleCard.classList.remove("google-auth-disabled");
    renderizarBotaoGoogle();

    setStatus("");
  } catch (erro) {
    bloquearGoogle(erroTexto(erro));
  }
}

function renderizarBotaoGoogle() {
  googleButtonContainer.replaceChildren();
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "google-oauth-button";
  botao.setAttribute(
    "aria-label",
    modoAtual === "register" ? "Cadastrar com Google" : "Entrar com Google",
  );

  const marca = document.createElement("span");
  marca.className = "google-oauth-mark";
  marca.innerHTML = MARCA_GOOGLE;

  const texto = document.createElement("span");
  texto.textContent = modoAtual === "register"
    ? "Cadastrar com Google"
    : "Entrar com Google";

  botao.append(marca, texto);
  botao.addEventListener("click", solicitarTokenAcessoGoogle);
  googleButtonContainer.appendChild(botao);
}

function solicitarTokenAcessoGoogle() {
  if (autenticacaoEmAndamento) {
    return;
  }

  if (!googleTokenClient) {
    setStatus("O cliente OAuth do Google ainda não foi inicializado.", true);
    return;
  }

  autenticacaoEmAndamento = true;
  setBusy(true);
  setStatus("Escolha a conta na janela do Google…");
  googleTokenClient.requestAccessToken({ prompt: "select_account" });
}

async function receberTokenAcessoGoogle(respostaGoogle) {
  const tokenGoogle = sanitizarTexto(respostaGoogle?.access_token);
  if (respostaGoogle?.error || !tokenGoogle) {
    autenticacaoEmAndamento = false;
    setBusy(false);
    setStatus(
      respostaGoogle?.error_description ||
        respostaGoogle?.error ||
        "O Google não retornou um token de acesso.",
      true,
    );
    return;
  }

  if (!possuiEscoposGoogleNecessarios(respostaGoogle)) {
    autenticacaoEmAndamento = false;
    setBusy(false);
    setStatus(
      "Autorize o acesso ao e-mail e ao perfil para continuar.",
      true,
    );
    return;
  }

  setStatus("Validando a conta no servidor…");

  try {
    const sessao = await trocarTokenGooglePorTokenSistema(tokenGoogle);

    if (!callbackUrl) {
      setStatus(
        "Login validado. Para voltar ao VS Code, entre pela extensão.",
      );
      autenticacaoEmAndamento = false;
      setBusy(false);
      return;
    }

    setStatus("Login validado. Voltando ao VS Code…");
    redirecionarParaExtensao(sessao);
  } catch (erro) {
    autenticacaoEmAndamento = false;
    setBusy(false);
    setStatus(erroTexto(erro), true);
  }
}

function tratarErroOAuthGoogle(erro) {
  autenticacaoEmAndamento = false;
  setBusy(false);
  const tipo = sanitizarTexto(erro?.type);
  const mensagens = {
    popup_closed: "A janela do Google foi fechada antes do fim do login.",
    popup_failed_to_open: "O navegador bloqueou a janela de login do Google.",
    unknown: "O Google não conseguiu concluir a autenticação.",
  };
  setStatus(
    mensagens[tipo] || `Falha no login Google: ${tipo || "erro desconhecido"}.`,
    true,
  );
}

async function trocarTokenGooglePorTokenSistema(tokenGoogle) {
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(
    () => abortController.abort(),
    TEMPO_LIMITE_LOGIN_MS,
  );
  let resposta;

  try {
    resposta = await fetch(`${apiBaseUrl}/login`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: "gmail",
        token: tokenGoogle,
      }),
      signal: abortController.signal,
    });
  } catch (erro) {
    if (erro?.name === "AbortError") {
      throw new Error("O servidor demorou mais de 15 segundos para responder.");
    }

    const detalhe = erroTexto(erro);
    throw new Error(
      `Falha de rede ao acessar ${apiBaseUrl}/login: ${detalhe}. Verifique CORS, internet, firewall ou proxy.`,
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  const dados = await lerResposta(resposta);
  if (!resposta.ok) {
    throw new Error(
      `Login recusado pelo servidor (HTTP ${resposta.status}): ${extrairDetalhe(dados)}`,
    );
  }

  const serverToken = extrairTokenSistema(dados);
  if (!serverToken) {
    throw new Error("A API de login não retornou o token do sistema.");
  }

  return {
    serverToken,
    provider: "gmail",
    remember: Boolean(rememberInput?.checked),
    mode: modoAtual,
  };
}

function possuiEscoposGoogleNecessarios(respostaGoogle) {
  const escopos = new Set(
    sanitizarTexto(respostaGoogle?.scope).split(/\s+/).filter(Boolean),
  );

  return (
    escopos.has("openid") &&
    (escopos.has("email") ||
      escopos.has("https://www.googleapis.com/auth/userinfo.email")) &&
    (escopos.has("profile") ||
      escopos.has("https://www.googleapis.com/auth/userinfo.profile"))
  );
}

function redirecionarParaExtensao(sessao) {
  const callback = validarCallback(callbackUrl);
  const fragmento = new URLSearchParams({
    server_token: sessao.serverToken,
    provider: sessao.provider,
    remember: sessao.remember ? "1" : "0",
    mode: sessao.mode,
  });

  if (callbackState) {
    fragmento.set("state", callbackState);
  }

  callback.hash = fragmento.toString();
  window.location.replace(callback.toString());
}

function validarCallback(valor) {
  let callback;
  try {
    callback = new URL(valor);
  } catch {
    throw new Error("Callback da extensão inválido.");
  }

  if (["vscode:", "vscode-insiders:"].includes(callback.protocol)) {
    if (callback.hostname !== "josebruno10.flexbox-trainer") {
      throw new Error("Callback pertence a uma extensão não autorizada.");
    }
    return callback;
  }

  const hostPermitido =
    callback.hostname === "localhost" ||
    callback.hostname === "127.0.0.1" ||
    callback.hostname === "vscode.dev" ||
    callback.hostname === "insiders.vscode.dev";

  if (!["http:", "https:"].includes(callback.protocol) || !hostPermitido) {
    throw new Error("Destino de callback não autorizado.");
  }

  return callback;
}

function extrairTokenSistema(dados) {
  const candidatos = [
    dados?.access_token,
    dados?.accessToken,
    dados?.token,
    dados?.jwt,
    dados?.bearerToken,
    dados?.data?.access_token,
    dados?.data?.accessToken,
    dados?.data?.token,
    dados?.auth?.token,
    dados?.session?.token,
  ];

  return candidatos.find(
    (valor) => typeof valor === "string" && valor.trim().length > 0,
  )?.trim();
}

async function lerResposta(resposta) {
  const texto = await resposta.text();
  if (!texto.trim()) {
    return {};
  }

  try {
    return JSON.parse(texto);
  } catch {
    return { detail: texto.trim() };
  }
}

function extrairDetalhe(dados) {
  const detalhe = dados?.message || dados?.detail || dados?.error;
  if (typeof detalhe === "string" && detalhe.trim()) {
    return detalhe.trim();
  }
  if (Array.isArray(detalhe) && detalhe.length > 0) {
    return detalhe
      .map((item) => item?.msg || item?.message || JSON.stringify(item))
      .join("; ");
  }
  return "Resposta sem detalhes.";
}

function normalizarApiBaseUrl(valor) {
  let url;
  try {
    url = new URL(valor);
  } catch {
    throw new Error("A URL da API de autenticação é inválida.");
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("A API de autenticação deve usar HTTPS.");
  }
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/docs\/?$/, "").replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

function bloquearGoogle(mensagem) {
  googleCard?.classList.add("google-auth-disabled");
  if (googleButtonContainer) {
    googleButtonContainer.textContent = mensagem;
  }
  setStatus(mensagem, true);
}

function setBusy(busy) {
  googleCard?.classList.toggle("is-busy", busy);
  tabs.forEach((tab) => {
    tab.disabled = busy;
  });
  if (rememberInput) {
    rememberInput.disabled = busy;
  }
}

function setStatus(mensagem, erro = false) {
  if (!statusBox) {
    return;
  }
  // Sem mensagem, o quadro some: os botões já dizem o que fazer.
  statusBox.textContent = mensagem;
  statusBox.hidden = !mensagem;
  statusBox.classList.toggle("error", erro);
  statusBox.classList.toggle("success", !erro && /validado|retornando/i.test(mensagem));
}

function sanitizarTexto(valor) {
  return String(valor || "").trim();
}

function erroTexto(erro) {
  return erro instanceof Error ? erro.message : "Erro inesperado ao autenticar.";
}
