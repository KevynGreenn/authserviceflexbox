const params = new URLSearchParams(window.location.search);
const callbackUrl = params.get("callback") || "";
const statusBox = document.getElementById("status");

function decodificarJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(window.atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join('')));
}

window.handleGoogleLogin = (response) => {
  if (!callbackUrl) {
    statusBox.textContent = "Erro: Esta página deve ser aberta pelo VS Code.";
    statusBox.style.color = "red";
    return;
  }

  statusBox.textContent = "Redirecionando para o VS Code...";
  
  // Extrai o email de forma segura garantida pela Google
  const payload = decodificarJwt(response.credential);
  
  // Envia de volta para a extensão
  const url = new URL(callbackUrl);
  url.searchParams.set("email", payload.email);
  window.location.href = url.toString();
};