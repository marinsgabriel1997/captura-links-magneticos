# Mapa e Documentação do Projeto: Magnet Link Debrid Extension

## Visão Geral

Esta extensão de navegador permite extrair, filtrar e processar links magnéticos (magnet links) diretamente de páginas web, com integração ao serviço Real-Debrid para desbloqueio e download facilitado. O usuário interage com um overlay moderno, podendo filtrar, copiar, debridar e baixar arquivos de forma prática.

---

## Estrutura de Arquivos

- **manifest.json**
  - Manifesto da extensão (MV3). Define permissões, scripts, recursos acessíveis e background.
  - Permissões: `activeTab`, `scripting`, `storage`, `<all_urls>`.
  - Service worker: `background.js`.
  - Recursos web acessíveis: `overlay.html`, `overlay.css`.

- **background.js**
  - Service worker da extensão.
  - Funções principais:
    - Injeta o `content.js` ao clicar no ícone da extensão.
    - Gerencia armazenamento seguro da API Key do Real-Debrid (criptografia básica).
    - Processa requisições de debrid (magnet → torrent → seleção de arquivo → link direto).
    - Faz unrestrict de links via API do Real-Debrid.
    - Comunicação assíncrona com o content script.

- **content.js**
  - Script injetado nas páginas.
  - Extrai links magnéticos de diferentes layouts/sites.
  - Cria e gerencia o overlay (UI) via Shadow DOM.
  - Permite filtrar, selecionar, copiar, debridar e baixar links.
  - Interage com o background para processar torrents e links.
  - Gerencia eventos, filtros avançados (resolução, codec, tipo), status e feedback visual.

- **overlay.html**
  - Estrutura HTML do overlay exibido ao usuário.
  - Possui abas: Pesquisa (lista/filtros/ações) e Configuração (API Key).
  - Elementos: filtros, seleção, botões de ação, lista de links, status, campos de configuração.

- **overlay.css**
  - Estilização visual do overlay.
  - Layout responsivo, abas, botões, filtros, lista de links, status coloridos.
  - Foco em UX: fácil leitura, destaque de ações, feedback visual.

---

## Fluxo Principal

1. **Usuário clica no ícone da extensão** → `background.js` injeta `content.js` na aba ativa.
2. **content.js** extrai links magnéticos da página e monta o overlay (UI).
3. Usuário pode:
   - Filtrar e selecionar links.
   - Copiar links selecionados.
   - Processar (debridar) links via Real-Debrid (necessário API Key).
   - Baixar arquivos já desbloqueados.
   - Configurar a API Key na aba de configuração.
4. Toda comunicação sensível (API Key, requisições à API) é feita via background.

---

## Dicas para Desenvolvedores

- **Adição de novos filtros**: editar `content.js` (função `atualizarLista` e HTML em `overlay.html`).
- **Novos provedores de magnet**: adaptar a função `extrairLinksMagneticos` em `content.js`.
- **Ajuste visual**: modificar `overlay.css`.
- **Novas ações ou botões**: adicionar no HTML (`overlay.html`) e lógica/eventos em `content.js`.
- **API Key**: nunca é enviada para servidores externos além do Real-Debrid; é salva localmente e criptografada (simples).
- **Debug**: use o console do navegador para logs detalhados (há muitos `console.log`).

---

## Sugestão de Navegação

1. Comece pelo `manifest.json` para entender permissões e entrypoints.
2. Veja o fluxo de background em `background.js`.
3. Analise o overlay (UI) em `overlay.html` e `overlay.css`.
4. Explore a lógica de extração, UI e eventos em `content.js`.

---

## Observações

- O projeto não possui dependências externas (puro JS/CSS/HTML).
- O código é modular e fácil de estender.
- A criptografia da API Key é apenas ilustrativa, não use para dados sensíveis em produção.
- Para testes, use sites com muitos magnet links ou a página de torrents do Real-Debrid. 