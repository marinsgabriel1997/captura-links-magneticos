(() => {
  const existingContainer = document.getElementById("extension-container");
  if (existingContainer) {
    existingContainer.remove();
    return;
  }

  let shadowRoot = null;
  const linksMagneticos = extrairLinksMagneticos();

  function extrairLinksMagneticos() {
    const isRealDebridTorrentsPage = window.location.href.includes(
      "https://real-debrid.com/torrents"
    );

    if (isRealDebridTorrentsPage) {
      return [...document.querySelectorAll("textarea[name='links']")]
        .filter((el) => el.value?.trim())
        .map((el) => ({
          url: el.value.trim(),
          titulo: `Link RD: ${(el.id || "").replace("links_", "")}`,
          status: null,
        }));
    }

    // Verificar se existem elementos com o novo seletor
    const checkboxInputs = document.querySelectorAll(
      "input.CheckInput-checkbox-WEQ3S"
    );

    if (checkboxInputs.length > 0) {
      const sizeElements = document.querySelectorAll(
        ".SearchIndexRow-size-V9kGS"
      );

      return [...checkboxInputs]
        .filter((el) => el.getAttribute("name")?.startsWith("magnet:"))
        .map((el, index) => {
          const href = el.getAttribute("name");
          let titulo = "";
          const dnMatch = href.match(/dn=([^&]+)/);

          const tamanho =
            index < sizeElements.length
              ? sizeElements[index].textContent.trim()
              : "Desconhecido";

          if (dnMatch?.[1]) {
            titulo = decodeURIComponent(dnMatch[1]).replace(/\+/g, " ");
          } else {
            const parentElement = el.closest("div");
            const possibleTitle = parentElement?.querySelector(
              "h1, h2, h3, h4, h5, .title, .name"
            );
            if (possibleTitle) titulo = possibleTitle.textContent.trim();
          }

          return {
            url: href,
            titulo: titulo || "Link sem título",
            tamanho: tamanho,
            status: null,
          };
        });
    }

    // Caso não encontre pelo novo seletor, usa o método original
    return [...document.querySelectorAll("a[href]")]
      .filter((el) => el.getAttribute("href")?.startsWith("magnet:"))
      .map((el) => {
        const href = el.getAttribute("href");
        let titulo = "";
        const dnMatch = href.match(/dn=([^&]+)/);

        if (dnMatch?.[1]) {
          titulo = decodeURIComponent(dnMatch[1]).replace(/\+/g, " ");
        } else {
          titulo = el.textContent.trim();

          if (titulo.length < 5) {
            const heading = el
              .closest("div")
              ?.querySelector("h1, h2, h3, h4, h5");
            if (heading) titulo = heading.textContent.trim();
          }
        }

        return {
          url: href,
          titulo: titulo || "Link sem título",
          status: null,
        };
      });
  }

  const getElement = (id) => shadowRoot.getElementById(id);

  async function inicializarExtensao() {
    const container = document.createElement("div");
    container.id = "extension-container";
    Object.assign(container.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      zIndex: "2147483647",
      pointerEvents: "none",
    });

    shadowRoot = container.attachShadow({ mode: "closed" });

    try {
      const [html, css] = await Promise.all([
        fetch(chrome.runtime.getURL("overlay.html")).then((r) => r.text()),
        fetch(chrome.runtime.getURL("overlay.css")).then((r) => r.text()),
      ]);

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
      if (overlayElement) overlayElement.style.pointerEvents = "auto";

      const header = getElement("header");
      if (header)
        header.textContent = `${linksMagneticos.length} links magnéticos encontrados`;

      function toggleTab(tabId) {
        // Use querySelector com # para selecionar por ID em vez de getElementById
        const tabContents = shadowRoot.querySelectorAll(".tab-content");
        tabContents.forEach(function (tab) {
          tab.style.display = "none";
        });

        const tabButtons = shadowRoot.querySelectorAll(".tab-btn");
        tabButtons.forEach(function (btn) {
          btn.classList.remove("active");
        });

        // Use querySelector com # para selecionar o elemento por ID
        const activeTab = shadowRoot.querySelector(`#${tabId}-tab`);
        if (activeTab) activeTab.style.display = "flex";

        const activeButton = shadowRoot.querySelector(
          `.tab-btn[data-tab="${tabId}"]`
        );
        if (activeButton) activeButton.classList.add("active");
      }

      // Configurar eventos das abas
      const tabButtons = shadowRoot.querySelectorAll(".tab-btn");
      tabButtons.forEach(function (button) {
        button.addEventListener("click", function () {
          const tabId = this.getAttribute("data-tab");
          toggleTab(tabId);
        });
      });

      // Inicializar com a primeira aba ativa
      toggleTab("pesquisa");

      carregarApiKey();
      inicializarEventListeners();
      atualizarLista();
    } catch (error) {
      console.error("Erro ao carregar recursos:", error);
    }
  }

  function inicializarEventListeners() {
    const eventos = {
      "close-button": {
        evento: "click",
        handler: () => document.getElementById("extension-container")?.remove(),
      },
      "save-api-key-btn": { evento: "click", handler: salvarApiKey },
      "filter-input": { evento: "input", handler: atualizarLista },
      "select-all-btn": { evento: "click", handler: selecionarTodos },
      "deselect-all-btn": { evento: "click", handler: deselecionarTodos },
      "copy-selected-btn": { evento: "click", handler: copiarSelecionados },
      "debrid-selected-btn": {
        evento: "click",
        handler: processarSelecionados,
        condicao: () =>
          !window.location.href.includes("https://real-debrid.com/torrents"),
      },
      // Adicionar estes novos eventos
      "filtro-resolucao": { evento: "change", handler: atualizarLista },
      "filtro-codec": { evento: "change", handler: atualizarLista },
      "filtro-tipo": { evento: "change", handler: atualizarLista },
      "limpar-filtros": { evento: "click", handler: limparFiltros },
    };

    // O resto continua igual
    Object.entries(eventos).forEach(([id, { evento, handler, condicao }]) => {
      const elemento = getElement(id);
      if (!elemento) return;

      if (condicao !== undefined) {
        if (!condicao()) {
          elemento.style.display = "none";
          return;
        }
      }

      elemento.addEventListener(evento, handler);
    });
  }

  function processarSelecionados() {
    const apiKeyInput = getElement("rd-api-key");
    if (!apiKeyInput) return console.error("Campo de API Key não encontrado");

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey)
      return alert(
        "API Key não definida! Por favor, insira sua API Key do Real-Debrid."
      );

    const checkboxes = [
      ...shadowRoot.querySelectorAll(".link-item input[type=checkbox]:checked"),
    ];
    if (checkboxes.length === 0) return alert("Nenhum link selecionado!");

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
        processarRespostaDebrid(response, index);
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

  function processarRespostaDebrid(response, index) {
    if (response?.success) {
      const data = response.data;

      if (data.links?.length > 0) {
        const linksHtml = `<ul style='margin-top: 5px; padding-left: 20px;'>
          ${data.links
            .map(
              (link) =>
                `<li><a href="${link}" target="_blank" style="color: #2196F3; text-decoration: underline;">${link}</a></li>`
            )
            .join("")}
        </ul>`;

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
        response?.error || "Erro desconhecido na comunicação com o servidor";
      atualizarStatusItem(index, `Erro: ${errorMsg}`, "error");
    }
  }

  function salvarApiKey() {
    const saveBtn = getElement("save-api-key-btn");
    const apiKeyInput = getElement("rd-api-key");

    if (!saveBtn || !apiKeyInput) return;

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) return;

    chrome.runtime.sendMessage({ action: "saveApiKey", apiKey }, (response) => {
      if (response?.success) {
        saveBtn.textContent = "Salvo!";
        saveBtn.style.backgroundColor = "#4CAF50";
        setTimeout(() => {
          saveBtn.textContent = "Salvar";
          saveBtn.style.backgroundColor = "#2196F3";
        }, 1500);
      }
    });
  }

  function carregarApiKey() {
    const apiKeyInput = getElement("rd-api-key");
    if (!apiKeyInput) return;

    chrome.runtime.sendMessage({ action: "getApiKey" }, (response) => {
      if (response?.apiKey) apiKeyInput.value = response.apiKey;
    });
  }

  function selecionarTodos() {
    shadowRoot
      .querySelectorAll(".link-item input[type=checkbox]")
      .forEach((cb) => (cb.checked = true));
    pulsoBtn("select-all-btn");
  }

  function deselecionarTodos() {
    shadowRoot
      .querySelectorAll(".link-item input[type=checkbox]")
      .forEach((cb) => (cb.checked = false));
    pulsoBtn("deselect-all-btn");
  }

  function pulsoBtn(id) {
    const btn = getElement(id);
    if (!btn) return;

    btn.style.backgroundColor = "#ddd";
    setTimeout(() => (btn.style.backgroundColor = ""), 100);
  }

  function limparFiltros() {
    const filtroResolucao = getElement("filtro-resolucao");
    const filtroCodec = getElement("filtro-codec");
    const filtroTipo = getElement("filtro-tipo");

    if (filtroResolucao) filtroResolucao.value = "";
    if (filtroCodec) filtroCodec.value = "";
    if (filtroTipo) filtroTipo.value = "";

    pulsoBtn("limpar-filtros");
    atualizarLista();
  }

  function copiarSelecionados() {
    const copyBtn = getElement("copy-selected-btn");
    if (!copyBtn) return;

    const selecionados = [
      ...shadowRoot.querySelectorAll(".link-item input[type=checkbox]:checked"),
    ].map((cb) => linksMagneticos[parseInt(cb.value)].url);

    if (selecionados.length > 0) {
      navigator.clipboard.writeText(selecionados.join("\n"));
      copyBtn.style.backgroundColor = "#3e8e41";
    } else {
      copyBtn.style.backgroundColor = "#ff6666";
    }

    setTimeout(() => (copyBtn.style.backgroundColor = "#4CAF50"), 100);
  }

  function alternarExibicao(index, toggleBtn, titulo) {
    const item = toggleBtn.closest(".link-item");
    const mostraLink = item.dataset.mostraLink === "true";

    titulo.textContent = mostraLink
      ? linksMagneticos[index].titulo
      : linksMagneticos[index].url;
    toggleBtn.textContent = mostraLink ? "Mostrar Link" : "Mostrar Título";
    item.dataset.mostraLink = mostraLink ? "false" : "true";

    toggleBtn.style.backgroundColor = "#ddd";
    setTimeout(() => (toggleBtn.style.backgroundColor = ""), 100);
  }

  function copiarLink(index, copyBtn) {
    navigator.clipboard.writeText(linksMagneticos[index].url);
    copyBtn.style.backgroundColor = "#ddd";
    setTimeout(() => (copyBtn.style.backgroundColor = ""), 100);
  }

  function processarLinkDebrid(index, debridBtn) {
    const apiKeyInput = getElement("rd-api-key");
    if (!apiKeyInput) return;

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
      (response) => processarRespostaDebrid(response, index)
    );

    if (debridBtn) {
      debridBtn.style.backgroundColor = "#e68a00";
      setTimeout(() => (debridBtn.style.backgroundColor = "#ff9800"), 100);
    }
  }

  function atualizarStatusItem(index, mensagem, tipo) {
    const item = shadowRoot.querySelector(`.link-item[data-index="${index}"]`);
    if (!item) return;

    let statusElement = item.querySelector(".item-status");
    if (!statusElement) {
      statusElement = document.createElement("div");
      statusElement.className = "item-status";
      Object.assign(statusElement.style, {
        marginTop: "5px",
        padding: "5px",
        borderRadius: "3px",
        fontSize: "14px",
        width: "100%",
      });
      item.appendChild(statusElement);
    }

    statusElement.innerHTML = mensagem;
    statusElement.style.display = "block";

    const estilos = {
      success: { bg: "#e8f5e9", border: "#4CAF50", color: "#2e7d32" },
      error: { bg: "#ffebee", border: "#f44336", color: "#c62828" },
      info: { bg: "#e3f2fd", border: "#2196F3", color: "#1565c0" },
      default: { bg: "#f0f0f0", border: "#ccc", color: "#333" },
    };

    const estilo = estilos[tipo] || estilos.default;
    Object.assign(statusElement.style, {
      backgroundColor: estilo.bg,
      borderColor: estilo.border,
      color: estilo.color,
    });

    linksMagneticos[index].status = { mensagem, tipo };
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
    const filtroResolucao = getElement("filtro-resolucao");
    const filtroCodec = getElement("filtro-codec");
    const filtroTipo = getElement("filtro-tipo");
    const isRealDebridTorrentsPage = window.location.href.includes(
      "https://real-debrid.com/torrents"
    );

    if (!filterInput || !listaLinks || !header) return;

    const filtroTexto = filterInput.value.toLowerCase();
    const filtrosPalavras = filtroTexto
      .split(/\s+/)
      .filter((palavra) => palavra.length > 0);
    listaLinks.innerHTML = "";
    let linksVisiveis = 0;

    // Valores dos filtros avançados
    const resolucao = filtroResolucao
      ? filtroResolucao.value.toLowerCase()
      : "";
    const codec = filtroCodec ? filtroCodec.value.toLowerCase() : "";
    const tipo = filtroTipo ? filtroTipo.value.toLowerCase() : "";

    linksMagneticos.forEach((link, index) => {
      const tituloLowerCase = link.titulo.toLowerCase();

      // Verifica se TODAS as palavras do filtro estão presentes no título
      const correspondeAoFiltro =
        filtrosPalavras.length === 0 ||
        filtrosPalavras.every((palavra) => tituloLowerCase.includes(palavra));

      // Verificar filtros avançados
      const correspondeResolucao =
        resolucao === "" || tituloLowerCase.includes(resolucao);
      const correspondeCodec = codec === "" || tituloLowerCase.includes(codec);
      const correspondeTipo = tipo === "" || tituloLowerCase.includes(tipo);

      // Só exibe se corresponder a TODOS os filtros
      if (
        !correspondeAoFiltro ||
        !correspondeResolucao ||
        !correspondeCodec ||
        !correspondeTipo
      )
        return;

      linksVisiveis++;

      const item = document.createElement("div");
      item.className = "link-item";
      item.dataset.index = index;
      item.dataset.mostraLink = "false";
      Object.assign(item.style, {
        padding: "10px",
        borderBottom: "1px solid #eee",
        display: "flex",
        flexDirection: "column",
      });

      const mainRow = document.createElement("div");
      Object.assign(mainRow.style, {
        display: "flex",
        alignItems: "center",
        width: "100%",
      });

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = index;
      checkbox.style.marginRight = "10px";

      const titulo = document.createElement("div");
      titulo.className = "link-titulo";

      if (link.tamanho) {
        titulo.textContent = `(${link.tamanho}) ${link.titulo}`;
      } else {
        titulo.textContent = link.titulo;
      }

      Object.assign(titulo.style, {
        flex: "1",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      });

      const criarBotao = (texto, onClick, estilo = {}) => {
        const btn = document.createElement("button");
        btn.textContent = texto;
        Object.assign(btn.style, {
          marginLeft: "10px",
          padding: "2px 5px",
          cursor: "pointer",
          ...estilo,
        });
        btn.addEventListener("click", onClick);
        return btn;
      };

      const toggleBtn = criarBotao("Mostrar Link", () =>
        alternarExibicao(index, toggleBtn, titulo)
      );
      const copyBtn = criarBotao("Copiar", () => copiarLink(index, copyBtn));

      mainRow.appendChild(checkbox);
      mainRow.appendChild(titulo);
      mainRow.appendChild(toggleBtn);
      mainRow.appendChild(copyBtn);

      if (!isRealDebridTorrentsPage) {
        const debridBtn = criarBotao(
          "Debrid",
          () => processarLinkDebrid(index, debridBtn),
          {
            backgroundColor: "#ff9800",
            color: "white",
            border: "none",
            borderRadius: "3px",
          }
        );
        mainRow.appendChild(debridBtn);
      }

      item.appendChild(mainRow);

      if (link.status) {
        const statusElement = document.createElement("div");
        statusElement.className = "item-status";
        Object.assign(statusElement.style, {
          marginTop: "5px",
          padding: "5px",
          borderRadius: "3px",
          fontSize: "14px",
          width: "100%",
          display: "block",
        });
        statusElement.innerHTML = link.status.mensagem;

        const estilos = {
          success: { bg: "#e8f5e9", border: "#4CAF50", color: "#2e7d32" },
          error: { bg: "#ffebee", border: "#f44336", color: "#c62828" },
          info: { bg: "#e3f2fd", border: "#2196F3", color: "#1565c0" },
          default: { bg: "#f0f0f0", border: "#ccc", color: "#333" },
        };

        const estilo = estilos[link.status.tipo] || estilos.default;
        Object.assign(statusElement.style, {
          backgroundColor: estilo.bg,
          borderColor: estilo.border,
          color: estilo.color,
        });

        item.appendChild(statusElement);
      }

      listaLinks.appendChild(item);
    });

    header.textContent = `${linksVisiveis} de ${linksMagneticos.length} links ${
      isRealDebridTorrentsPage ? "RD" : "magnéticos"
    } exibidos`;
  }

  inicializarExtensao();
})();
