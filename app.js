// auth-site/app.js

const params = new URLSearchParams(window.location.search);
const callbackUrl = params.get("callback") || "";
const apiBaseUrl = (params.get("apiBaseUrl") || "https://frontendteamscup.com.br/api").replace(/\/+$/, "");
const emailInicial = params.get("email") || "";

const notice = document.getElementById("notice");
const statusBox = document.getElementById("status");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const tabs = Array.from(document.querySelectorAll(".tab"));

const loginEmail = loginForm.querySelector('input[name="email"]');
const registerEmail = registerForm.querySelector('input[name="email"]');

loginEmail.value = emailInicial;
registerEmail.value = emailInicial;

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    tabs.forEach((item) => item.classList.toggle("active", item === tab));
    loginForm.classList.toggle("active", target === "login");
    registerForm.classList.toggle("active", target === "register");
    setStatus(target === "login"
      ? "Faça login com seu e-mail e token do Gmail."
      : "Crie sua conta usando os dados exigidos pela API.");
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dados = new FormData(loginForm);
  const email = sanitizarTexto(dados.get("email"));
  const tokenGmail = sanitizarTexto(dados.get("token_gmail"));
  const remember = dados.get("remember") === "on";

  try {
    setBusy(loginForm, true);
    setStatus("Validando login...");
    const usuario = await buscarUsuarioPorEmail(email);

    if (!usuario) {
      throw new Error("Conta não encontrada. Crie uma conta antes de fazer login.");
    }

    if (usuario.tokenGmail !== tokenGmail) {
      throw new Error("Token Gmail inválido.");
    }

    redirecionarParaExtensao({
      nome: usuario.nome,
      email: usuario.email,
      tokenGmail: usuario.tokenGmail,
      remember,
      mode: "login",
    });
  } catch (error) {
    setStatus(erroTexto(error), true);
  } finally {
    setBusy(loginForm, false);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dados = new FormData(registerForm);
  const payload = {
    nome: sanitizarTexto(dados.get("nome")),
    email: sanitizarTexto(dados.get("email")),
    token_gmail: sanitizarTexto(dados.get("token_gmail")),
    turma: toNumber(dados.get("turma")),
    periodo: toNumber(dados.get("periodo")),
    url_image_perfil: sanitizarTexto(dados.get("url_image_perfil")),
  };
  const remember = dados.get("remember") === "on";

  try {
    setBusy(registerForm, true);
    setStatus("Criando conta...");

    const existente = await buscarUsuarioPorEmail(payload.email);
    if (existente) {
      throw new Error("Este e-mail já possui uma conta. Use o login.");
    }

    // Se o erro de CORS persistir após essa alteração, 
    // certifique-se de que o backend (FastAPI) possua o CORSMiddleware ativado.
    const resposta = await fetch(`${apiBaseUrl}/usuarios`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        nome: payload.nome,
        email: payload.email,
        token_gmail: payload.token_gmail,
        turma: payload.turma ? String(payload.turma) : "",
        periodo: payload.periodo ? String(payload.periodo) : "",
        url_image_perfil: payload.url_image_perfil,
      }).toString(),
    });

    if (!resposta.ok) {
      throw new Error(await extrairDetalheDeErro(resposta));
    }

    redirecionarParaExtensao({
      nome: payload.nome,
      email: payload.email,
      tokenGmail: payload.token_gmail,
      remember,
      mode: "register",
    });
  } catch (error) {
    setStatus(erroTexto(error), true);
  } finally {
    setBusy(registerForm, false);
  }
});

async function buscarUsuarioPorEmail(email) {
  const resposta = await fetch(`${apiBaseUrl}/usuarios/por-email?email=${encodeURIComponent(email)}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!resposta.ok) {
    if (resposta.status === 404) {
      return undefined;
    }
    throw new Error(await extrairDetalheDeErro(resposta));
  }

  const dados = await resposta.json();
  return normalizarUsuario(dados);
}

function normalizarUsuario(dados) {
  if (!dados) {
    return undefined;
  }

  const registro = Array.isArray(dados) ? dados[0] : dados;
  if (!registro) {
    return undefined;
  }

  const nome = sanitizarTexto(registro.nome || registro.name || registro.nome_completo);
  const email = sanitizarTexto(registro.email);
  const tokenGmail = sanitizarTexto(registro.token_gmail || registro.tokenGmail);

  if (!nome || !email || !tokenGmail) {
    return undefined;
  }

  return { nome, email, tokenGmail };
}

function redirecionarParaExtensao(dados) {
  if (!callbackUrl) {
    throw new Error("Callback da extensão não informado.");
  }

  const url = new URL(callbackUrl);
  url.searchParams.set("email", dados.email);
  url.searchParams.set("nome", dados.nome);
  url.searchParams.set("token_gmail", dados.tokenGmail);
  url.searchParams.set("remember", dados.remember ? "1" : "0");
  url.searchParams.set("mode", dados.mode);
  window.location.href = url.toString();
}

function setBusy(form, busy) {
  form.querySelectorAll("input, button").forEach((node) => {
    node.disabled = busy;
  });
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", Boolean(isError));
  if (notice) {
    notice.textContent = isError
      ? "Verifique os dados e tente novamente."
      : "Preencha seus dados para continuar. A validação é feita diretamente na API.";
  }
}

function sanitizarTexto(valor) {
  return String(valor || "").trim();
}

function toNumber(valor) {
  const texto = sanitizarTexto(valor);
  if (!texto) {
    return undefined;
  }
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : undefined;
}

async function extrairDetalheDeErro(resposta) {
  try {
    const dados = await resposta.json();
    return dados?.message || dados?.detail || `HTTP ${resposta.status}`;
  } catch {
    return `HTTP ${resposta.status}`;
  }
}

function erroTexto(error) {
  return error instanceof Error ? error.message : "Erro inesperado ao autenticar.";
}

setStatus("Pronto. Escolha entre login ou cadastro.");