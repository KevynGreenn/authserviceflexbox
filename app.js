// auth-site/app.js

const params = new URLSearchParams(window.location.search);
const callbackUrl = params.get("callback") || "";
const apiBaseUrl = (params.get("apiBaseUrl") || "https://frontendteamscup.com.br/api").replace(/\/+$/, "");

const notice = document.getElementById("notice");
const statusBox = document.getElementById("status");

function decodificarJwt(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );
  return JSON.parse(jsonPayload);
}

window.handleGoogleLogin = async function (response) {
  try {
    setStatus("Processando conta Google...");

    const googlePayload = decodificarJwt(response.credential);
    const emailGoogle = sanitizarTexto(googlePayload.email);
    const nomeGoogle = sanitizarTexto(googlePayload.name);
    const fotoGoogle = sanitizarTexto(googlePayload.picture);

    let usuario = await buscarUsuarioPorEmail(emailGoogle);

    if (!usuario) {
      setStatus("Criando conta com os dados do Google...");

      const bodyParams = new URLSearchParams();
      bodyParams.set("nome", nomeGoogle);
      bodyParams.set("email", emailGoogle);
      bodyParams.set("token_gmail", "google");
      bodyParams.set("url_image_perfil", fotoGoogle);

      const resposta = await fetch(`${apiBaseUrl}/usuarios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: bodyParams.toString(),
      });

      if (!resposta.ok) {
        throw new Error(await extrairDetalheDeErro(resposta));
      }

      usuario = {
        nome: nomeGoogle,
        email: emailGoogle,
        tokenGmail: "google",
      };
    }

    setStatus("Redirecionando para o VS Code...");
    redirecionarParaExtensao({
      nome: usuario.nome,
      email: usuario.email,
      tokenGmail: usuario.tokenGmail || "google",
      remember: true,
      mode: "login",
    });
  } catch (error) {
    setStatus(erroTexto(error), true);
  }
};

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
    throw new Error("Callback da extensão não informado. Inicie o login a partir do VS Code.");
  }

  const url = new URL(callbackUrl);
  url.searchParams.set("email", dados.email);
  url.searchParams.set("nome", dados.nome);
  url.searchParams.set("token_gmail", dados.tokenGmail);
  url.searchParams.set("remember", dados.remember ? "1" : "0");
  url.searchParams.set("mode", dados.mode);
  window.location.assign(url.toString());
}

function setStatus(message, isError = false) {
  if (statusBox) {
    statusBox.textContent = message;
    statusBox.classList.toggle("error", Boolean(isError));
  }

  if (notice) {
    notice.textContent = isError
      ? "Verifique a conta Google e tente novamente."
      : "A autenticação é feita somente com Google.";
  }
}

function sanitizarTexto(valor) {
  return String(valor || "").trim();
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

function carregarGoogleIdentity() {
  if (location.protocol === "file:") {
    setStatus("Abra esta página em http(s) para usar o botão do Google.", true);
    return;
  }

  const googleScript = document.createElement("script");
  googleScript.src = "https://accounts.google.com/gsi/client";
  googleScript.async = true;
  googleScript.defer = true;
  document.head.appendChild(googleScript);
}

setStatus("Pronto. Faça login com Google.");
carregarGoogleIdentity();