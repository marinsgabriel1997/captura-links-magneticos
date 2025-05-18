// Evento click no ícone da extensão
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"],
  });
});

// Listener para mensagens do content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getApiKey") {
    chrome.storage.local.get(["rdApiKey"], (result) => {
      if (result.rdApiKey) {
        // Descriptografa a chave (implementação simples)
        const decryptedKey = decryptApiKey(result.rdApiKey);
        sendResponse({ apiKey: decryptedKey });
      } else {
        sendResponse({ apiKey: null });
      }
    });
    return true; // Indica que a resposta será assíncrona
  } else if (request.action === "saveApiKey") {
    // Criptografa a chave (implementação simples)
    const encryptedKey = encryptApiKey(request.apiKey);
    chrome.storage.local.set({ rdApiKey: encryptedKey }, () => {
      sendResponse({ success: true });
    });
    return true; // Indica que a resposta será assíncrona
  } else if (request.action === "processDebrid") {
    processarTorrent(request.magnetUrl, request.apiKey)
      .then((resultado) => {
        sendResponse({ success: true, data: resultado });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indica que a resposta será assíncrona
  }
});

// Função simples para criptografar a API key (não segura, apenas para exemplo)
function encryptApiKey(apiKey) {
  // Uma criptografia básica (não use em produção)
  return btoa(apiKey.split("").reverse().join(""));
}

// Função simples para descriptografar a API key
function decryptApiKey(encryptedKey) {
  // Descriptografia básica (não use em produção)
  return atob(encryptedKey).split("").reverse().join("");
}

// Função para adicionar um torrent via URL
async function adicionarTorrentUrl(magnetUrl, apiKey) {
  const url = "https://api.real-debrid.com/rest/1.0/torrents/addMagnet";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `magnet=${encodeURIComponent(magnetUrl)}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("Torrent adicionado:", data);
    return data;
  } catch (error) {
    console.error("Erro ao adicionar torrent:", error);
    throw error;
  }
}

// Função para verificar status do torrent
async function verificarStatus(id, apiKey) {
  const url = `https://api.real-debrid.com/rest/1.0/torrents/info/${id}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log("Status do torrent:", data);
    return data;
  } catch (error) {
    console.error("Erro ao verificar status:", error);
    throw error;
  }
}

// Função para selecionar arquivos do torrent
async function selecionarArquivos(torrentId, fileIds, apiKey) {
  const url = `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `files=${fileIds.join(",")}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ${response.status}: ${errorText}`);
    }

    console.log("Arquivos selecionados com sucesso:", fileIds);
    return true;
  } catch (error) {
    console.error("Erro ao selecionar arquivos:", error);
    throw error;
  }
}

// Função principal para processar o torrent completamente
async function processarTorrent(magnetUrl, apiKey) {
  try {
    // Passo 1: Adicionar o torrent
    console.log("Adicionando torrent...");
    const torrentData = await adicionarTorrentUrl(magnetUrl, apiKey);

    if (!torrentData.id) {
      throw new Error("Falha ao adicionar torrent: ID não recebido");
    }

    const torrentId = torrentData.id;
    console.log(`Torrent adicionado com ID: ${torrentId}`);

    // Passo 2: Verificar status e obter lista de arquivos
    console.log("Verificando status do torrent...");
    const statusData = await verificarStatus(torrentId, apiKey);

    if (
      statusData.status !== "waiting_files_selection" &&
      statusData.status !== "magnet_conversion"
    ) {
      // Se não estiver aguardando seleção de arquivos e não estiver convertendo magnet
      if (statusData.links && statusData.links.length > 0) {
        // Se já tem links disponíveis, retorna eles
        return {
          torrentId: torrentId,
          status: statusData.status,
          progress: statusData.progress || 1,
          links: statusData.links,
        };
      }

      throw new Error(`Status inesperado: ${statusData.status}`);
    }

    // Se estiver convertendo o magnet, aguarda um pouco
    if (statusData.status === "magnet_conversion") {
      // Aguarda até 15 segundos para a conversão terminar
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 3000)); // Espera 3 segundos
        const checkStatus = await verificarStatus(torrentId, apiKey);
        if (checkStatus.status !== "magnet_conversion") {
          // Saiu da conversão, podemos prosseguir
          if (
            checkStatus.status === "waiting_files_selection" &&
            checkStatus.files &&
            checkStatus.files.length > 0
          ) {
            // Continua o processo
            return await selecionarEObterStatus(torrentId, checkStatus, apiKey);
          } else if (checkStatus.links && checkStatus.links.length > 0) {
            // Já tem links
            return {
              torrentId: torrentId,
              status: checkStatus.status,
              progress: checkStatus.progress || 1,
              links: checkStatus.links,
            };
          }
        }
      }

      // Se chegou aqui, ainda está convertendo
      return {
        torrentId: torrentId,
        status: "magnet_conversion",
        progress: 0,
        message: "Magnet em conversão, verifique mais tarde.",
      };
    }

    // Se tiver arquivos para selecionar, prossegue normalmente
    if (statusData.files && statusData.files.length > 0) {
      return await selecionarEObterStatus(torrentId, statusData, apiKey);
    } else {
      // Sem arquivos para selecionar
      throw new Error("Nenhum arquivo encontrado no torrent");
    }
  } catch (error) {
    console.error("Erro durante o processamento do torrent:", error);
    throw error;
  }
}

// Função auxiliar para selecionar arquivos e obter status final
async function selecionarEObterStatus(torrentId, statusData, apiKey) {
  // Identificar o maior arquivo
  let maiorArquivo = { id: null, bytes: 0 };

  statusData.files.forEach((file) => {
    if (file.bytes > maiorArquivo.bytes) {
      maiorArquivo = { id: file.id, bytes: file.bytes, path: file.path };
    }
  });

  if (!maiorArquivo.id) {
    throw new Error("Não foi possível identificar o maior arquivo");
  }

  console.log(
    `Maior arquivo identificado: ${maiorArquivo.path} (${(
      maiorArquivo.bytes /
      1024 /
      1024
    ).toFixed(2)} MB)`
  );

  // Selecionar o maior arquivo
  console.log(`Selecionando arquivo ID ${maiorArquivo.id}...`);
  await selecionarArquivos(torrentId, [maiorArquivo.id], apiKey);

  // Verificar status final
  console.log("Verificando status final...");
  const statusFinal = await verificarStatus(torrentId, apiKey);

  return {
    torrentId: torrentId,
    status: statusFinal.status,
    progress: statusFinal.progress || 0,
    links: statusFinal.links || [],
    fileName: maiorArquivo.path,
    fileSize: `${(maiorArquivo.bytes / 1024 / 1024).toFixed(2)} MB`,
  };
}
