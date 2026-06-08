const params = new URLSearchParams(window.location.search);
const callbackUrl = params.get("callback") || "";
const apiBaseUrl = (params.get("apiBaseUrl") || "https://ifms.pro.br:6005").replace(/\/+$/, "");
const emailInicial = params.get("email") || "";

const notice = document.getElementById("notice");
const statusBox = document.getElementById("status");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const tabs = Array.from(document.querySelectorAll(".tab"));

const loginEmail = loginForm.querySelector('input[name="email"]');
const registerEmail = registerForm.querySelector('input[name="email"]');

if (loginEmail) loginEmail.value = emailInicial;
if (registerEmail) registerEmail.value = emailInicial;

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    tabs.forEach((item) => item.classList.toggle("active", item === tab));
    loginForm.classList.toggle("active", target === "login");
    registerForm.classList.toggle("active", target === "register");
    setStatus(target === "login"
      ? "Faça login com seu e-mail e senha."
      : "Crie sua conta usando os dados exigidos pela API do IFMS.");
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const dados = new FormData(loginForm);
  const email = sanitizarTexto(dados.get("email"));
  const senha = sanitizarTexto(dados.get("senha"));
  const remember = dados.get("remember") === "on";

  try {
    setBusy(loginForm, true);
    setStatus("Validando login no IFMS...");
    const usuario = await buscarUsuarioPorEmail(email);

    if (!usuario) {
      throw new Error("Conta não encontrada. Crie uma conta antes de fazer login.");
    }

    if (usuario.tokenGmail && usuario.tokenGmail !== senha) {
      throw new Error("Senha incorreta.");
    }

    redirecionarParaExtensao({
      nome: usuario.nome,
      email: usuario.email,
      tokenGmail: senha,
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
    token_gmail: sanitizarTexto(dados.get("senha")),
    turma: toNumber(dados.get("turma")),
    periodo: toNumber(dados.get("periodo")),
    url_image_perfil: sanitizarTexto(dados.get("url_image_perfil")),
  };
  const remember = dados.get("remember") === "on";

  try {
    setBusy(registerForm, true);
    setStatus("Criando conta no IFMS...");

    const existente = await buscarUsuarioPorEmail(payload.email);
    if (existente) {
      throw new Error("Este e-mail já possui uma conta. Use o login.");
    }

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

  // Não exigimos o token_gmail da API aqui para evitar que a API oculte a senha e quebre o fluxo
  if (!nome || !email) {
    return undefined;
  }

  return { nome, email, tokenGmail };
}

function redirecionarParaExtensao(dados) {
  if (!callbackUrl) {
    throw new Error("Abra o login diretamente na extensão do VS Code para funcionar.");
  }

  const url = new URL(callbackUrl);
  url.searchParams.set("email", dados.email);
  url.searchParams.set("nome", dados.nome);
  url.searchParams.set("token_gmail", dados.tokenGmail);
  url.searchParams.set("remember", dados.remember ? "1" : "0");
  url.searchParams.set("mode", dados.mode);

  setStatus("Redirecionando para o VS Code... Você já pode fechar esta página.", false);

  // Atraso de 2 segundos apenas no registro para o banco de dados da API ter tempo de salvar
  if (dados.mode === "register") {
    setTimeout(() => {
      window.location.href = url.toString();
    }, 2000);
  } else {
    window.location.href = url.toString();
  }
}

function setBusy(form, busy) {
  form.querySelectorAll("input, button, select").forEach((node) => {
    node.disabled = busy;
  });
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", Boolean(isError));
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