(function () {
  // Verifica se o overlay já existe
  if (document.getElementById("overlay-extension")) {
    document.getElementById("overlay-extension").remove();
    return;
  }

  // Função para extrair links magnéticos e seus títulos
  function extrairLinksMagneticos() {
    const linksInfo = [];

    // Procura por todos os links na página
    const elementos = document.querySelectorAll("a[href]");

    // Filtra apenas os links magnéticos e extrai informações relevantes
    elementos.forEach((elemento) => {
      const href = elemento.getAttribute("href");
      if (href && href.startsWith("magnet:")) {
        // Tenta obter o título do torrent a partir da URL ou do texto do elemento
        let titulo = "";

        // Extrai o nome do parâmetro dn= da URL magnet
        const dnMatch = href.match(/dn=([^&]+)/);
        if (dnMatch && dnMatch[1]) {
          titulo = decodeURIComponent(dnMatch[1]).replace(/\+/g, " ");
        } else {
          // Se não encontrar no link, usa o texto do elemento ou um elemento próximo
          titulo = elemento.textContent.trim();

          // Se o texto do elemento for muito curto, procura por um heading próximo
          if (titulo.length < 5) {
            const heading = elemento
              .closest("div")
              .querySelector("h1, h2, h3, h4, h5");
            if (heading) {
              titulo = heading.textContent.trim();
            }
          }
        }

        // Adiciona à lista de links
        linksInfo.push({
          url: href,
          titulo: titulo || "Link sem título",
        });
      }
    });

    return linksInfo;
  }

  // Extrai os links magnéticos
  const linksMagneticos = extrairLinksMagneticos();

  // Cria o overlay
  const overlay = document.createElement("div");
  overlay.id = "overlay-extension";
  overlay.style.position = "fixed";
  overlay.style.top = "5%";
  overlay.style.left = "5%";
  overlay.style.width = "90%";
  overlay.style.height = "90%";
  overlay.style.backgroundColor = "white";
  overlay.style.zIndex = "9999";
  overlay.style.border = "1px solid black";
  overlay.style.padding = "20px";
  overlay.style.boxSizing = "border-box";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
  overlay.style.borderRadius = "5px";

  // Cria o botão para fechar
  const closeButton = document.createElement("button");
  closeButton.textContent = "X";
  closeButton.style.position = "absolute";
  closeButton.style.top = "10px";
  closeButton.style.right = "10px";
  closeButton.style.cursor = "pointer";
  closeButton.style.padding = "5px 10px";
  closeButton.style.backgroundColor = "#f44336";
  closeButton.style.color = "white";
  closeButton.style.border = "none";
  closeButton.style.borderRadius = "3px";
  closeButton.addEventListener("click", () => {
    overlay.remove();
  });

  // Cria o cabeçalho
  const header = document.createElement("div");
  header.textContent = `${linksMagneticos.length} links magnéticos encontrados`;
  header.style.fontSize = "18px";
  header.style.fontWeight = "bold";
  header.style.marginBottom = "15px";

  // Seção para API Key
  const apiKeySection = document.createElement("div");
  apiKeySection.style.marginBottom = "15px";
  apiKeySection.style.display = "flex";
  apiKeySection.style.alignItems = "center";

  const apiKeyLabel = document.createElement("label");
  apiKeyLabel.textContent = "Real-Debrid API Key: ";
  apiKeyLabel.style.marginRight = "10px";

  const apiKeyInput = document.createElement("input");
  apiKeyInput.type = "text";
  apiKeyInput.id = "rd-api-key";
  apiKeyInput.placeholder = "Cole sua API Key do Real-Debrid aqui";
  apiKeyInput.style.padding = "5px";
  apiKeyInput.style.flex = "1";
  apiKeyInput.style.border = "2px solid #ccc";

  const saveApiKeyBtn = document.createElement("button");
  saveApiKeyBtn.textContent = "Salvar";
  saveApiKeyBtn.style.marginLeft = "10px";
  saveApiKeyBtn.style.padding = "5px 10px";
  saveApiKeyBtn.style.cursor = "pointer";
  saveApiKeyBtn.style.backgroundColor = "#2196F3";
  saveApiKeyBtn.style.color = "white";
  saveApiKeyBtn.style.border = "none";
  saveApiKeyBtn.style.borderRadius = "3px";

  saveApiKeyBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.runtime.sendMessage(
        { action: "saveApiKey", apiKey: apiKey },
        (response) => {
          if (response.success) {
            // Efeito visual de sucesso
            saveApiKeyBtn.textContent = "Salvo!";
            saveApiKeyBtn.style.backgroundColor = "#4CAF50";
            setTimeout(() => {
              saveApiKeyBtn.textContent = "Salvar";
              saveApiKeyBtn.style.backgroundColor = "#2196F3";
            }, 1500);
          }
        }
      );
    }
  });

  // Carrega a API key se já existir
  chrome.runtime.sendMessage({ action: "getApiKey" }, (response) => {
    if (response.apiKey) {
      apiKeyInput.value = response.apiKey;
    }
  });

  // Cria o container de filtro
  const filterContainer = document.createElement("div");
  filterContainer.style.marginBottom = "15px";
  filterContainer.style.display = "flex";
  filterContainer.style.alignItems = "center";

  const filterLabel = document.createElement("label");
  filterLabel.textContent = "Filtrar: ";
  filterLabel.style.marginRight = "10px";

  const filterInput = document.createElement("input");
  filterInput.type = "text";
  filterInput.placeholder = "Digite para filtrar por título...";
  filterInput.style.padding = "5px";
  filterInput.style.flex = "1";
  filterInput.style.border = "2px solid #ccc";

  // Status container para mensagens de processamento
  const statusContainer = document.createElement("div");
  statusContainer.id = "status-container";
  statusContainer.style.display = "none";
  statusContainer.style.marginBottom = "15px";
  statusContainer.style.padding = "10px";
  statusContainer.style.backgroundColor = "#f0f0f0";
  statusContainer.style.border = "1px solid #ccc";
  statusContainer.style.borderRadius = "3px";

  // Função para mostrar status
  function mostrarStatus(mensagem, tipo) {
    statusContainer.innerHTML = mensagem;
    statusContainer.style.display = "block";

    if (tipo === "success") {
      statusContainer.style.backgroundColor = "#e8f5e9";
      statusContainer.style.borderColor = "#4CAF50";
    } else if (tipo === "error") {
      statusContainer.style.backgroundColor = "#ffebee";
      statusContainer.style.borderColor = "#f44336";
    } else if (tipo === "info") {
      statusContainer.style.backgroundColor = "#e3f2fd";
      statusContainer.style.borderColor = "#2196F3";
    } else {
      statusContainer.style.backgroundColor = "#f0f0f0";
      statusContainer.style.borderColor = "#ccc";
    }
  }

  // Função para limpar status
  function limparStatus() {
    statusContainer.style.display = "none";
    statusContainer.textContent = "";
  }

  // Função para processar um link com Real-Debrid
  function processarLinkDebrid(magnetUrl) {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      mostrarStatus("Erro: API Key não definida!", "error");
      return;
    }

    mostrarStatus("Processando link no Real-Debrid...", "info");

    chrome.runtime.sendMessage(
      { action: "processDebrid", magnetUrl, apiKey },
      (response) => {
        if (response.success) {
          const data = response.data;

          if (data.links && data.links.length > 0) {
            // Cria uma lista com os links
            let linksHtml =
              "<ul style='margin-top: 10px; padding-left: 20px;'>";
            data.links.forEach((link) => {
              linksHtml += `<li><a href="${link}" target="_blank">${link}</a></li>`;
            });
            linksHtml += "</ul>";

            mostrarStatus(
              `<strong>Sucesso!</strong> Arquivo: ${data.fileName} (${data.fileSize})<br>` +
                "Links disponíveis:" +
                linksHtml,
              "success"
            );

            // Permite que os links sejam clicáveis
            const links = statusContainer.querySelectorAll("a");
            links.forEach((link) => {
              link.style.color = "#2196F3";
              link.style.textDecoration = "underline";
            });
          } else if (data.status === "magnet_conversion") {
            mostrarStatus(
              `O magnet está sendo convertido. ID do torrent: ${data.torrentId}. Tente novamente em alguns minutos.`,
              "info"
            );
          } else {
            mostrarStatus(
              `Link enviado para o Real-Debrid. Status: ${
                data.status
              }, Progresso: ${Math.round(data.progress * 100)}%`,
              "info"
            );
          }
        } else {
          mostrarStatus(`Erro: ${response.error}`, "error");
        }
      }
    );
  }

  // Função para atualizar a lista baseada no filtro
  function atualizarLista() {
    const filtro = filterInput.value.toLowerCase();

    // Limpa a lista
    listaLinks.innerHTML = "";

    // Filtra e adiciona os items
    let linksVisíveis = 0;

    linksMagneticos.forEach((link, index) => {
      if (link.titulo.toLowerCase().includes(filtro)) {
        linksVisíveis++;

        const item = document.createElement("div");
        item.className = "link-item";
        item.style.padding = "10px";
        item.style.borderBottom = "1px solid #eee";
        item.style.display = "flex";
        item.style.alignItems = "center";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = index;
        checkbox.style.marginRight = "10px";

        const titulo = document.createElement("div");
        titulo.className = "link-titulo";
        titulo.textContent = link.titulo;
        titulo.style.flex = "1";
        titulo.style.overflow = "hidden";
        titulo.style.textOverflow = "ellipsis";
        titulo.style.whiteSpace = "nowrap";

        // Botão para alternar entre título e link
        const toggleBtn = document.createElement("button");
        toggleBtn.textContent = "Mostrar Link";
        toggleBtn.style.marginLeft = "10px";
        toggleBtn.style.padding = "2px 5px";
        toggleBtn.style.cursor = "pointer";

        // Para rastrear o estado de exibição (título ou link)
        item.dataset.mostraLink = "false";

        toggleBtn.addEventListener("click", () => {
          if (item.dataset.mostraLink === "false") {
            // Mostrar o link
            titulo.textContent = link.url;
            toggleBtn.textContent = "Mostrar Título";
            item.dataset.mostraLink = "true";
          } else {
            // Mostrar o título
            titulo.textContent = link.titulo;
            toggleBtn.textContent = "Mostrar Link";
            item.dataset.mostraLink = "false";
          }
          // Efeito visual simples ao clicar
          toggleBtn.style.backgroundColor = "#ddd";
          setTimeout(() => {
            toggleBtn.style.backgroundColor = "";
          }, 100);
        });

        const copyBtn = document.createElement("button");
        copyBtn.textContent = "Copiar";
        copyBtn.style.marginLeft = "10px";
        copyBtn.style.padding = "2px 5px";
        copyBtn.style.cursor = "pointer";
        copyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(link.url);
          // Apenas efeito visual de clique
          copyBtn.style.backgroundColor = "#ddd";
          setTimeout(() => {
            copyBtn.style.backgroundColor = "";
          }, 100);
        });

        // Novo botão Debrid
        const debridBtn = document.createElement("button");
        debridBtn.textContent = "Debrid";
        debridBtn.style.marginLeft = "10px";
        debridBtn.style.padding = "2px 5px";
        debridBtn.style.cursor = "pointer";
        debridBtn.style.backgroundColor = "#ff9800";
        debridBtn.style.color = "white";
        debridBtn.style.border = "none";
        debridBtn.style.borderRadius = "3px";

        debridBtn.addEventListener("click", () => {
          // Limpa status anterior
          limparStatus();

          // Processa o link
          processarLinkDebrid(link.url);

          // Efeito visual
          debridBtn.style.backgroundColor = "#e68a00";
          setTimeout(() => {
            debridBtn.style.backgroundColor = "#ff9800";
          }, 100);
        });

        item.appendChild(checkbox);
        item.appendChild(titulo);
        item.appendChild(toggleBtn);
        item.appendChild(copyBtn);
        item.appendChild(debridBtn);

        listaLinks.appendChild(item);
      }
    });

    // Atualiza o contador
    header.textContent = `${linksVisíveis} de ${linksMagneticos.length} links magnéticos exibidos`;
  }

  filterInput.addEventListener("input", atualizarLista);

  // Botões de seleção
  const selectionContainer = document.createElement("div");
  selectionContainer.style.display = "flex";
  selectionContainer.style.marginTop = "10px";
  selectionContainer.style.marginBottom = "10px";

  const selectAllBtn = document.createElement("button");
  selectAllBtn.textContent = "Selecionar Todos";
  selectAllBtn.style.marginRight = "10px";
  selectAllBtn.style.padding = "5px 10px";
  selectAllBtn.addEventListener("click", () => {
    document
      .querySelectorAll(".link-item input[type=checkbox]")
      .forEach((cb) => {
        cb.checked = true;
      });
    // Efeito visual
    selectAllBtn.style.backgroundColor = "#ddd";
    setTimeout(() => {
      selectAllBtn.style.backgroundColor = "";
    }, 100);
  });

  const deselectAllBtn = document.createElement("button");
  deselectAllBtn.textContent = "Deselecionar Todos";
  deselectAllBtn.style.padding = "5px 10px";
  deselectAllBtn.style.cursor = "pointer";
  deselectAllBtn.addEventListener("click", () => {
    document
      .querySelectorAll(".link-item input[type=checkbox]")
      .forEach((cb) => {
        cb.checked = false;
      });
    // Efeito visual
    deselectAllBtn.style.backgroundColor = "#ddd";
    setTimeout(() => {
      deselectAllBtn.style.backgroundColor = "";
    }, 100);
  });

  selectionContainer.appendChild(selectAllBtn);
  selectionContainer.appendChild(deselectAllBtn);

  // Container da lista
  const listaLinks = document.createElement("div");
  listaLinks.style.flex = "1";
  listaLinks.style.overflowY = "auto";
  listaLinks.style.border = "1px solid #ccc";
  listaLinks.style.marginBottom = "15px";
  listaLinks.style.backgroundColor = "#fafafa";

  // Botão de copiar selecionados
  const copySelectedBtn = document.createElement("button");
  copySelectedBtn.textContent = "Copiar Links Selecionados";
  copySelectedBtn.style.padding = "8px 15px";
  copySelectedBtn.style.backgroundColor = "#4CAF50";
  copySelectedBtn.style.color = "white";
  copySelectedBtn.style.border = "none";
  copySelectedBtn.style.borderRadius = "4px";
  copySelectedBtn.style.cursor = "pointer";

  copySelectedBtn.addEventListener("click", () => {
    const selecionados = [];
    document
      .querySelectorAll(".link-item input[type=checkbox]:checked")
      .forEach((cb) => {
        selecionados.push(linksMagneticos[parseInt(cb.value)].url);
      });

    if (selecionados.length > 0) {
      navigator.clipboard.writeText(selecionados.join("\n"));
      // Apenas efeito visual
      copySelectedBtn.style.backgroundColor = "#3e8e41";
      setTimeout(() => {
        copySelectedBtn.style.backgroundColor = "#4CAF50";
      }, 100);
    } else {
      // Apenas efeito visual
      copySelectedBtn.style.backgroundColor = "#ff6666";
      setTimeout(() => {
        copySelectedBtn.style.backgroundColor = "#4CAF50";
      }, 100);
    }
  });

  // Adiciona os elementos ao overlay
  apiKeySection.appendChild(apiKeyLabel);
  apiKeySection.appendChild(apiKeyInput);
  apiKeySection.appendChild(saveApiKeyBtn);

  filterContainer.appendChild(filterLabel);
  filterContainer.appendChild(filterInput);

  overlay.appendChild(closeButton);
  overlay.appendChild(header);
  overlay.appendChild(apiKeySection);
  overlay.appendChild(statusContainer);
  overlay.appendChild(filterContainer);
  overlay.appendChild(selectionContainer);
  overlay.appendChild(listaLinks);
  overlay.appendChild(copySelectedBtn);

  // Adiciona o overlay ao corpo da página
  document.body.appendChild(overlay);

  // Inicializa a lista
  atualizarLista();
})();
