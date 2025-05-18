(function () {
  const existingContainer = document.getElementById("extension-container");
  if (existingContainer) {
    existingContainer.remove();
    return;
  }

  let shadowRoot = null;
  const linksMagneticos = extrairLinksMagneticos();

  function extrairLinksMagneticos() {
    const linksInfo = [];
    const elementos = document.querySelectorAll("a[href]");

    elementos.forEach((elemento) => {
      const href = elemento.getAttribute("href");
      if (href && href.startsWith("magnet:")) {
        let titulo = "";
        const dnMatch = href.match(/dn=([^&]+)/);

        if (dnMatch && dnMatch[1]) {
          titulo = decodeURIComponent(dnMatch[1]).replace(/\+/g, " ");
        } else {
          titulo = elemento.textContent.trim();

          if (titulo.length < 5) {
            const heading = elemento
              .closest("div")
              .querySelector("h1, h2, h3, h4, h5");
            if (heading) {
              titulo = heading.textContent.trim();
            }
          }
        }

        linksInfo.push({
          url: href,
          titulo: titulo || "Link sem título",
          status: null,
        });
      }
    });

    return linksInfo;
  }

  function getElement(id) {
    return shadowRoot.getElementById(id);
  }

  function inicializarExtensao() {
    const container = document.createElement("div");
    container.id = "extension-container";
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.zIndex = "2147483647";
    container.style.pointerEvents = "none";

    shadowRoot = container.attachShadow({ mode: "closed" });

    Promise.all([
      fetch(chrome.runtime.getURL("overlay.html")).then((r) => r.text()),
      fetch(chrome.runtime.getURL("overlay.css")).then((r) => r.text()),
    ])
      .then(([html, css]) => {
        const style = document.createElement("style");
        style.textContent = css;
        shadowRoot.appendChild(style);

        const overlayDiv = document.createElement("div");
        overlayDiv.innerHTML = html;

        while (overlayDiv.firstChild) {
          shadowRoot.appendChild(overlayDiv.firstChild);
        }

        document.body.appendChild(container);

        const overlayElement = getElement("overlay-extension");
        if (overlayElement) {
          overlayElement.style.pointerEvents = "auto";
        }

        const header = getElement("header");
        if (header) {
          header.textContent = `${linksMagneticos.length} links magnéticos encontrados`;
        }

        carregarApiKey();
        inicializarEventListeners();
        atualizarLista();
      })
      .catch((error) => {
        console.error("Erro ao carregar recursos:", error);
      });
  }

  function inicializarEventListeners() {
    const closeButton = getElement("close-button");
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        const container = document.getElementById("extension-container");
        if (container) {
          container.remove();
        }
      });
    }

    const saveApiButton = getElement("save-api-key-btn");
    if (saveApiButton) {
      saveApiButton.addEventListener("click", salvarApiKey);
    }

    const filterInput = getElement("filter-input");
    if (filterInput) {
      filterInput.addEventListener("input", atualizarLista);
    }

    const selectAllButton = getElement("select-all-btn");
    if (selectAllButton) {
      selectAllButton.addEventListener("click", selecionarTodos);
    }

    const deselectAllButton = getElement("deselect-all-btn");
    if (deselectAllButton) {
      deselectAllButton.addEventListener("click", deselecionarTodos);
    }

    const copySelectedButton = getElement("copy-selected-btn");
    if (copySelectedButton) {
      copySelectedButton.addEventListener("click", copiarSelecionados);
    }

    const debridSelectedButton = getElement("debrid-selected-btn");
    if (debridSelectedButton) {
      debridSelectedButton.addEventListener("click", processarSelecionados);
    }
  }

  function processarSelecionados() {
    const apiKeyInput = getElement("rd-api-key");
    if (!apiKeyInput) {
      console.error("Campo de API Key não encontrado");
      return;
    }

    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      alert(
        "API Key não definida! Por favor, insira sua API Key do Real-Debrid."
      );
      return;
    }

    const checkboxes = Array.from(
      shadowRoot.querySelectorAll(".link-item input[type=checkbox]:checked")
    );

    if (checkboxes.length === 0) {
      alert("Nenhum link selecionado!");
      return;
    }

    const debridSelectedBtn = getElement("debrid-selected-btn");
    if (debridSelectedBtn) {
      debridSelectedBtn.textContent = "Processando...";
      debridSelectedBtn.disabled = true;
      debridSelectedBtn.style.backgroundColor = "#e68a00";
    }

    processarFilaSequencial(checkboxes, 0, apiKey, debridSelectedBtn);
  }

  function processarFilaSequencial(
    checkboxes,
    indiceAtual,
    apiKey,
    debridSelectedBtn
  ) {
    if (indiceAtual >= checkboxes.length) {
      if (debridSelectedBtn) {
        debridSelectedBtn.textContent = "Debrid Selecionados";
        debridSelectedBtn.disabled = false;
        debridSelectedBtn.style.backgroundColor = "#ff9800";
      }
      return;
    }

    const index = parseInt(checkboxes[indiceAtual].value);

    atualizarStatusItem(
      index,
      `Em processamento (${indiceAtual + 1}/${checkboxes.length})...`,
      "info"
    );

    chrome.runtime.sendMessage(
      {
        action: "processDebrid",
        magnetUrl: linksMagneticos[index].url,
        apiKey,
      },
      (response) => {
        if (response && response.success) {
          const data = response.data;

          if (data.links && data.links.length > 0) {
            let linksHtml = "<ul style='margin-top: 5px; padding-left: 20px;'>";
            data.links.forEach((link) => {
              linksHtml += `<li><a href="${link}" target="_blank" style="color: #2196F3; text-decoration: underline;">${link}</a></li>`;
            });
            linksHtml += "</ul>";

            atualizarStatusItem(
              index,
              `<strong>Sucesso!</strong> Arquivo: ${data.fileName} (${data.fileSize})<br>Links disponíveis:${linksHtml}`,
              "success"
            );
          } else if (data.status === "magnet_conversion") {
            atualizarStatusItem(
              index,
              `O magnet está sendo convertido. ID do torrent: ${data.torrentId}. Tente novamente em alguns minutos.`,
              "info"
            );
          } else {
            atualizarStatusItem(
              index,
              `Link enviado para o Real-Debrid. Status: ${
                data.status
              }, Progresso: ${Math.round(data.progress * 100)}%`,
              "info"
            );
          }
        } else {
          const errorMsg =
            response && response.error
              ? response.error
              : "Erro desconhecido na comunicação com o servidor";
          atualizarStatusItem(index, `Erro: ${errorMsg}`, "error");
        }

        setTimeout(() => {
          processarFilaSequencial(
            checkboxes,
            indiceAtual + 1,
            apiKey,
            debridSelectedBtn
          );
        }, 1000);
      }
    );
  }

  function salvarApiKey() {
    const saveBtn = getElement("save-api-key-btn");
    const apiKeyInput = getElement("rd-api-key");

    if (!saveBtn || !apiKeyInput) {
      console.error(
        "Elementos necessários não encontrados para salvar API Key"
      );
      return;
    }

    const apiKey = apiKeyInput.value.trim();

    if (apiKey) {
      chrome.runtime.sendMessage(
        { action: "saveApiKey", apiKey },
        (response) => {
          if (response && response.success) {
            saveBtn.textContent = "Salvo!";
            saveBtn.style.backgroundColor = "#4CAF50";
            setTimeout(() => {
              saveBtn.textContent = "Salvar";
              saveBtn.style.backgroundColor = "#2196F3";
            }, 1500);
          }
        }
      );
    }
  }

  function carregarApiKey() {
    const apiKeyInput = getElement("rd-api-key");
    if (!apiKeyInput) return;

    chrome.runtime.sendMessage({ action: "getApiKey" }, (response) => {
      if (response && response.apiKey) {
        apiKeyInput.value = response.apiKey;
      }
    });
  }

  function selecionarTodos() {
    shadowRoot
      .querySelectorAll(".link-item input[type=checkbox]")
      .forEach((cb) => {
        cb.checked = true;
      });

    const selectAllBtn = getElement("select-all-btn");
    if (selectAllBtn) {
      selectAllBtn.style.backgroundColor = "#ddd";
      setTimeout(() => {
        selectAllBtn.style.backgroundColor = "";
      }, 100);
    }
  }

  function deselecionarTodos() {
    shadowRoot
      .querySelectorAll(".link-item input[type=checkbox]")
      .forEach((cb) => {
        cb.checked = false;
      });

    const deselectAllBtn = getElement("deselect-all-btn");
    if (deselectAllBtn) {
      deselectAllBtn.style.backgroundColor = "#ddd";
      setTimeout(() => {
        deselectAllBtn.style.backgroundColor = "";
      }, 100);
    }
  }

  function copiarSelecionados() {
    const copyBtn = getElement("copy-selected-btn");
    if (!copyBtn) {
      console.error("Botão 'Copiar Selecionados' não encontrado");
      return;
    }

    const selecionados = [];

    shadowRoot
      .querySelectorAll(".link-item input[type=checkbox]:checked")
      .forEach((cb) => {
        selecionados.push(linksMagneticos[parseInt(cb.value)].url);
      });

    if (selecionados.length > 0) {
      navigator.clipboard.writeText(selecionados.join("\n"));
      copyBtn.style.backgroundColor = "#3e8e41";
      setTimeout(() => {
        copyBtn.style.backgroundColor = "#4CAF50";
      }, 100);
    } else {
      copyBtn.style.backgroundColor = "#ff6666";
      setTimeout(() => {
        copyBtn.style.backgroundColor = "#4CAF50";
      }, 100);
    }
  }

  function alternarExibicao(index, toggleBtn, titulo) {
    const item = toggleBtn.closest(".link-item");

    if (item.dataset.mostraLink === "false") {
      titulo.textContent = linksMagneticos[index].url;
      toggleBtn.textContent = "Mostrar Título";
      item.dataset.mostraLink = "true";
    } else {
      titulo.textContent = linksMagneticos[index].titulo;
      toggleBtn.textContent = "Mostrar Link";
      item.dataset.mostraLink = "false";
    }

    toggleBtn.style.backgroundColor = "#ddd";
    setTimeout(() => {
      toggleBtn.style.backgroundColor = "";
    }, 100);
  }

  function copiarLink(index, copyBtn) {
    navigator.clipboard.writeText(linksMagneticos[index].url);
    copyBtn.style.backgroundColor = "#ddd";
    setTimeout(() => {
      copyBtn.style.backgroundColor = "";
    }, 100);
  }

  function processarLinkDebrid(index, debridBtn) {
    const apiKeyInput = getElement("rd-api-key");
    if (!apiKeyInput) {
      console.error("Campo de API Key não encontrado");
      return;
    }

    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      atualizarStatusItem(index, "Erro: API Key não definida!", "error");
      return;
    }

    limparStatusItem(index);
    atualizarStatusItem(index, "Processando link no Real-Debrid...", "info");

    chrome.runtime.sendMessage(
      {
        action: "processDebrid",
        magnetUrl: linksMagneticos[index].url,
        apiKey,
      },
      (response) => {
        if (response && response.success) {
          const data = response.data;

          if (data.links && data.links.length > 0) {
            let linksHtml = "<ul style='margin-top: 5px; padding-left: 20px;'>";
            data.links.forEach((link) => {
              linksHtml += `<li><a href="${link}" target="_blank" style="color: #2196F3; text-decoration: underline;">${link}</a></li>`;
            });
            linksHtml += "</ul>";

            atualizarStatusItem(
              index,
              `<strong>Sucesso!</strong> Arquivo: ${data.fileName} (${data.fileSize})<br>Links disponíveis:${linksHtml}`,
              "success"
            );
          } else if (data.status === "magnet_conversion") {
            atualizarStatusItem(
              index,
              `O magnet está sendo convertido. ID do torrent: ${data.torrentId}. Tente novamente em alguns minutos.`,
              "info"
            );
          } else {
            atualizarStatusItem(
              index,
              `Link enviado para o Real-Debrid. Status: ${
                data.status
              }, Progresso: ${Math.round(data.progress * 100)}%`,
              "info"
            );
          }
        } else {
          const errorMsg =
            response && response.error
              ? response.error
              : "Erro desconhecido na comunicação com o servidor";
          atualizarStatusItem(index, `Erro: ${errorMsg}`, "error");
        }
      }
    );

    if (debridBtn) {
      debridBtn.style.backgroundColor = "#e68a00";
      setTimeout(() => {
        debridBtn.style.backgroundColor = "#ff9800";
      }, 100);
    }
  }

  function atualizarStatusItem(index, mensagem, tipo) {
    const item = shadowRoot.querySelector(`.link-item[data-index="${index}"]`);
    if (!item) return;

    let statusElement = item.querySelector(".item-status");
    if (!statusElement) {
      statusElement = document.createElement("div");
      statusElement.className = "item-status";
      statusElement.style.marginTop = "5px";
      statusElement.style.padding = "5px";
      statusElement.style.borderRadius = "3px";
      statusElement.style.fontSize = "14px";
      statusElement.style.width = "100%";
      item.appendChild(statusElement);
    }

    statusElement.innerHTML = mensagem;
    statusElement.style.display = "block";
    if (tipo === "success") {
      statusElement.style.backgroundColor = "#e8f5e9";
      statusElement.style.borderColor = "#4CAF50";
      statusElement.style.color = "#2e7d32";
    } else if (tipo === "error") {
      statusElement.style.backgroundColor = "#ffebee";
      statusElement.style.borderColor = "#f44336";
      statusElement.style.color = "#c62828";
    } else if (tipo === "info") {
      statusElement.style.backgroundColor = "#e3f2fd";
      statusElement.style.borderColor = "#2196F3";
      statusElement.style.color = "#1565c0";
    } else {
      statusElement.style.backgroundColor = "#f0f0f0";
      statusElement.style.borderColor = "#ccc";
      statusElement.style.color = "#333";
    }

    linksMagneticos[index].status = {
      mensagem,
      tipo,
    };
  }

  function limparStatusItem(index) {
    const item = shadowRoot.querySelector(`.link-item[data-index="${index}"]`);
    if (!item) return;

    const statusElement = item.querySelector(".item-status");
    if (statusElement) {
      statusElement.style.display = "none";
      statusElement.textContent = "";
    }

    linksMagneticos[index].status = null;
  }

  function atualizarLista() {
    const filterInput = getElement("filter-input");
    const listaLinks = getElement("lista-links");
    const header = getElement("header");

    if (!filterInput || !listaLinks || !header) {
      console.error(
        "Elementos necessários não encontrados para atualizar a lista"
      );
      return;
    }

    const filtro = filterInput.value.toLowerCase();
    listaLinks.innerHTML = "";
    let linksVisíveis = 0;

    linksMagneticos.forEach((link, index) => {
      if (link.titulo.toLowerCase().includes(filtro)) {
        linksVisíveis++;

        const item = document.createElement("div");
        item.className = "link-item";
        item.dataset.index = index;
        item.dataset.mostraLink = "false";
        item.style.padding = "10px";
        item.style.borderBottom = "1px solid #eee";
        item.style.display = "flex";
        item.style.flexDirection = "column";

        const mainRow = document.createElement("div");
        mainRow.style.display = "flex";
        mainRow.style.alignItems = "center";
        mainRow.style.width = "100%";

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

        const toggleBtn = document.createElement("button");
        toggleBtn.textContent = "Mostrar Link";
        toggleBtn.style.marginLeft = "10px";
        toggleBtn.style.padding = "2px 5px";
        toggleBtn.style.cursor = "pointer";
        toggleBtn.addEventListener("click", () =>
          alternarExibicao(index, toggleBtn, titulo)
        );

        const copyBtn = document.createElement("button");
        copyBtn.textContent = "Copiar";
        copyBtn.style.marginLeft = "10px";
        copyBtn.style.padding = "2px 5px";
        copyBtn.style.cursor = "pointer";
        copyBtn.addEventListener("click", () => copiarLink(index, copyBtn));

        const debridBtn = document.createElement("button");
        debridBtn.textContent = "Debrid";
        debridBtn.style.marginLeft = "10px";
        debridBtn.style.padding = "2px 5px";
        debridBtn.style.cursor = "pointer";
        debridBtn.style.backgroundColor = "#ff9800";
        debridBtn.style.color = "white";
        debridBtn.style.border = "none";
        debridBtn.style.borderRadius = "3px";
        debridBtn.addEventListener("click", () =>
          processarLinkDebrid(index, debridBtn)
        );

        mainRow.appendChild(checkbox);
        mainRow.appendChild(titulo);
        mainRow.appendChild(toggleBtn);
        mainRow.appendChild(copyBtn);
        mainRow.appendChild(debridBtn);

        item.appendChild(mainRow);

        if (link.status) {
          const statusElement = document.createElement("div");
          statusElement.className = "item-status";
          statusElement.style.marginTop = "5px";
          statusElement.style.padding = "5px";
          statusElement.style.borderRadius = "3px";
          statusElement.style.fontSize = "14px";
          statusElement.style.width = "100%";
          statusElement.style.display = "block";
          statusElement.innerHTML = link.status.mensagem;

          if (link.status.tipo === "success") {
            statusElement.style.backgroundColor = "#e8f5e9";
            statusElement.style.borderColor = "#4CAF50";
            statusElement.style.color = "#2e7d32";
          } else if (link.status.tipo === "error") {
            statusElement.style.backgroundColor = "#ffebee";
            statusElement.style.borderColor = "#f44336";
            statusElement.style.color = "#c62828";
          } else if (link.status.tipo === "info") {
            statusElement.style.backgroundColor = "#e3f2fd";
            statusElement.style.borderColor = "#2196F3";
            statusElement.style.color = "#1565c0";
          } else {
            statusElement.style.backgroundColor = "#f0f0f0";
            statusElement.style.borderColor = "#ccc";
            statusElement.style.color = "#333";
          }

          item.appendChild(statusElement);
        }

        listaLinks.appendChild(item);
      }
    });

    header.textContent = `${linksVisíveis} de ${linksMagneticos.length} links magnéticos exibidos`;
  }

  inicializarExtensao();
})();
