/**
 * LICSYSTEM — internacionalização (i18n)
 * Idiomas: pt-BR (padrão), en, es
 * - data-i18n / data-i18n-placeholder / data-i18n-title / data-i18n-aria
 * - Tradução automática de frases estáticas (PHRASES) sem data-i18n
 */
(function () {
  var LANG_KEY = "licsystem_lang_v1";
  var SUPPORTED = ["pt-BR", "en", "es"];

  var DICT = {
    "pt-BR": {
      "lang.label": "Idioma",
      "lang.pt": "Português (Brasil)",
      "lang.en": "English",
      "lang.es": "Español",
      "top.subtitle": "LICSYSTEM — Inteligência em Licitações",
      "top.logout": "Sair",
      "top.alerts": "Alertas de editais",
      "top.alertsSub": "Monitoramento automático PNCP",
      "top.alertsUpdate": "Atualizar",
      "top.alertsMark": "Marcar lidos",
      "top.alertsEmpty": "Nenhum alerta ainda. Ative um monitoramento em Pesquisas de Editais.",
      "nav.dashboard": "Dashboard",
      "nav.pesquisas": "Pesquisas de Editais",
      "nav.perguntarEditais": "Perguntar editais",
      "nav.editaisProximos": "Editais próximos",
      "nav.radarPncp": "Radar PNCP",
      "nav.analiseIa": "Análise IA",
      "nav.leiloesParticipo": "Leilão que Participo",
      "nav.docsChecklist": "Docs do Edital",
      "nav.importarEdital": "Importar Edital (PDF)",
      "nav.orcamento": "Orçamento",
      "nav.cruzamento": "Cruzamento ML",
      "nav.entregas": "Entrega",
      "nav.histEntregas": "Histórico de Entregas",
      "nav.cofre": "Cofre de Documentos",
      "nav.concorrencia": "Concorrência",
      "nav.catalogo": "Catálogo",
      "nav.arp": "Atas de Registro",
      "nav.disputa": "Robô de Disputa",
      "nav.ferramentas": "Configurações",
      "nav.chat": "Pergunte ao Chat",
      "nav.suporte": "Suporte LICSYSTEM",
      "nav.chatIa": "Chat IA",
      "view.dashboard": "Dashboard",
      "view.pesquisas": "Pesquisas de Editais",
      "view.perguntarEditais": "Perguntar editais",
      "view.editaisProximos": "Editais próximos",
      "view.radarPncp": "Radar PNCP",
      "view.analiseIa": "Análise Inteligente de Editais",
      "view.leiloesParticipo": "Leilão que Participo",
      "view.leilaoWorkspace": "Painel do Edital",
      "view.importarEdital": "Importar Edital (PDF)",
      "view.orcamento": "Orçamento",
      "view.cruzamento": "Cruzamento Inteligente (ML)",
      "view.cofre": "Cofre de Documentos",
      "view.docsChecklist": "Docs do Edital",
      "view.entregas": "Entrega",
      "view.histEntregas": "Histórico de Entregas",
      "view.concorrencia": "Análise de Concorrência",
      "view.catalogo": "Catálogo Interno",
      "view.arp": "Atas de Registro (ARP)",
      "view.disputa": "Robô de Disputa",
      "view.ferramentas": "Configurações",
      "view.chat": "Pergunte ao Chat",
      "cfg.title": "Configurações",
      "cfg.saveProfile": "Salvar perfil",
      "cfg.name": "Nome",
      "cfg.cnpj": "CNPJ",
      "cfg.address": "Endereço",
      "cfg.phone": "Telefone",
      "cfg.cep": "CEP (frete / cruzamento)",
      "cfg.logo": "Logo (PNG/JPG)",
      "cfg.logoHint": "Máx. recomendado ~500 KB para PDFs leves.",
      "cfg.langTitle": "Idioma do sistema",
      "cfg.langDesc": "Escolha o idioma da interface. A preferência fica salva neste navegador.",
      "cfg.backup": "Backup",
      "cfg.export": "Exportar backup",
      "cfg.import": "Importar backup",
      "common.save": "Salvar",
      "common.cancel": "Cancelar",
      "common.clear": "Limpar",
      "common.search": "Buscar",
      "common.back": "Voltar",
      "lw.backList": "← Lista",
      "lw.activeEdital": "Edital ativo",
      "lw.tab.hub": "Painel",
      "lw.tab.docs": "Docs",
      "lw.tab.analise": "Análise IA",
      "lw.tab.importar": "Importar",
      "lw.tab.orcamento": "Orçamento",
      "lw.tab.cruzamento": "Cruzamento ML",
      "cat.title": "Catálogo Interno",
      "cat.formTitle": "Cadastro de produto",
      "cat.nome": "Nome do Produto / Descrição",
      "cat.sku": "Código / SKU",
      "cat.preco": "Preço de Referência (R$)",
      "cat.marca": "Marca / Fabricante",
      "cat.save": "Salvar Produto",
      "disputa.title": "Robô de Disputa",
      "disputa.desc": "Informe o lance do concorrente: o robô cobre automaticamente até a margem que você definir.",
      "disputa.on": "▶ Ligar robô",
      "disputa.off": "■ Parar",
      "disputa.cover": "⚡ Cobrir agora",
      "disputa.clear": "Limpar sessão",
      "side.foot": "LICSYSTEM © Sistema Licitação"
    },
    "en": {
      "lang.label": "Language",
      "lang.pt": "Portuguese (Brazil)",
      "lang.en": "English",
      "lang.es": "Spanish",
      "top.subtitle": "LICSYSTEM — Bidding Intelligence",
      "top.logout": "Sign out",
      "top.alerts": "Bid alerts",
      "top.alertsSub": "Automatic PNCP monitoring",
      "top.alertsUpdate": "Refresh",
      "top.alertsMark": "Mark all read",
      "top.alertsEmpty": "No alerts yet. Enable monitoring in Bid Searches.",
      "nav.dashboard": "Dashboard",
      "nav.pesquisas": "Bid Searches",
      "nav.perguntarEditais": "Ask about notices",
      "nav.editaisProximos": "Nearby notices",
      "nav.radarPncp": "PNCP Radar",
      "nav.analiseIa": "AI Analysis",
      "nav.leiloesParticipo": "Auctions I Join",
      "nav.docsChecklist": "Bid Documents",
      "nav.importarEdital": "Import Notice (PDF)",
      "nav.orcamento": "Budget",
      "nav.cruzamento": "ML Matching",
      "nav.entregas": "Delivery",
      "nav.histEntregas": "Delivery History",
      "nav.cofre": "Document Vault",
      "nav.concorrencia": "Competition",
      "nav.catalogo": "Catalog",
      "nav.arp": "Price Registration",
      "nav.disputa": "Bidding Robot",
      "nav.ferramentas": "Settings",
      "nav.chat": "Ask Chat",
      "nav.suporte": "LICSYSTEM Support",
      "nav.chatIa": "AI Chat",
      "view.dashboard": "Dashboard",
      "view.pesquisas": "Bid Searches",
      "view.perguntarEditais": "Ask about notices",
      "view.editaisProximos": "Nearby notices",
      "view.radarPncp": "PNCP Radar",
      "view.analiseIa": "Smart Notice Analysis",
      "view.leiloesParticipo": "Auctions I Join",
      "view.leilaoWorkspace": "Notice Panel",
      "view.importarEdital": "Import Notice (PDF)",
      "view.orcamento": "Budget",
      "view.cruzamento": "Smart Matching (ML)",
      "view.cofre": "Document Vault",
      "view.docsChecklist": "Bid Documents",
      "view.entregas": "Delivery",
      "view.histEntregas": "Delivery History",
      "view.concorrencia": "Competition Analysis",
      "view.catalogo": "Internal Catalog",
      "view.arp": "Price Registration (ARP)",
      "view.disputa": "Bidding Robot",
      "view.ferramentas": "Settings",
      "view.chat": "Ask Chat",
      "cfg.title": "Settings",
      "cfg.saveProfile": "Save profile",
      "cfg.name": "Name",
      "cfg.cnpj": "Tax ID (CNPJ)",
      "cfg.address": "Address",
      "cfg.phone": "Phone",
      "cfg.cep": "ZIP (shipping / matching)",
      "cfg.logo": "Logo (PNG/JPG)",
      "cfg.logoHint": "Recommended max ~500 KB for lighter PDFs.",
      "cfg.langTitle": "System language",
      "cfg.langDesc": "Choose the interface language. Preference is saved in this browser.",
      "cfg.backup": "Backup",
      "cfg.export": "Export backup",
      "cfg.import": "Import backup",
      "common.save": "Save",
      "common.cancel": "Cancel",
      "common.clear": "Clear",
      "common.search": "Search",
      "common.back": "Back",
      "lw.backList": "← List",
      "lw.activeEdital": "Active notice",
      "lw.tab.hub": "Panel",
      "lw.tab.docs": "Docs",
      "lw.tab.analise": "AI Analysis",
      "lw.tab.importar": "Import",
      "lw.tab.orcamento": "Budget",
      "lw.tab.cruzamento": "ML Matching",
      "cat.title": "Internal Catalog",
      "cat.formTitle": "Product registration",
      "cat.nome": "Product name / Description",
      "cat.sku": "Code / SKU",
      "cat.preco": "Reference price",
      "cat.marca": "Brand / Manufacturer",
      "cat.save": "Save product",
      "disputa.title": "Bidding Robot",
      "disputa.desc": "Enter the competitor bid: the robot covers automatically up to your margin.",
      "disputa.on": "▶ Start robot",
      "disputa.off": "■ Stop",
      "disputa.cover": "⚡ Cover now",
      "disputa.clear": "Clear session",
      "side.foot": "LICSYSTEM © Bidding System"
    },
    "es": {
      "lang.label": "Idioma",
      "lang.pt": "Portugués (Brasil)",
      "lang.en": "Inglés",
      "lang.es": "Español",
      "top.subtitle": "LICSYSTEM — Inteligencia en Licitaciones",
      "top.logout": "Salir",
      "top.alerts": "Alertas de edictos",
      "top.alertsSub": "Monitoreo automático PNCP",
      "top.alertsUpdate": "Actualizar",
      "top.alertsMark": "Marcar leídos",
      "top.alertsEmpty": "Aún no hay alertas. Active un monitoreo en Búsqueda de Edictos.",
      "nav.dashboard": "Panel",
      "nav.pesquisas": "Búsqueda de Edictos",
      "nav.perguntarEditais": "Preguntar edictos",
      "nav.editaisProximos": "Edictos cercanos",
      "nav.radarPncp": "Radar PNCP",
      "nav.analiseIa": "Análisis IA",
      "nav.leiloesParticipo": "Subastas en las que participo",
      "nav.docsChecklist": "Docs del Edicto",
      "nav.importarEdital": "Importar Edicto (PDF)",
      "nav.orcamento": "Presupuesto",
      "nav.cruzamento": "Cruce ML",
      "nav.entregas": "Entrega",
      "nav.histEntregas": "Historial de Entregas",
      "nav.cofre": "Caja de Documentos",
      "nav.concorrencia": "Competencia",
      "nav.catalogo": "Catálogo",
      "nav.arp": "Actas de Registro",
      "nav.disputa": "Robot de Disputa",
      "nav.ferramentas": "Configuración",
      "nav.chat": "Pregunte al Chat",
      "nav.suporte": "Soporte LICSYSTEM",
      "nav.chatIa": "Chat IA",
      "view.dashboard": "Panel",
      "view.pesquisas": "Búsqueda de Edictos",
      "view.perguntarEditais": "Preguntar edictos",
      "view.editaisProximos": "Edictos cercanos",
      "view.radarPncp": "Radar PNCP",
      "view.analiseIa": "Análisis Inteligente de Edictos",
      "view.leiloesParticipo": "Subastas en las que participo",
      "view.leilaoWorkspace": "Panel del Edicto",
      "view.importarEdital": "Importar Edicto (PDF)",
      "view.orcamento": "Presupuesto",
      "view.cruzamento": "Cruce Inteligente (ML)",
      "view.cofre": "Caja de Documentos",
      "view.docsChecklist": "Docs del Edicto",
      "view.entregas": "Entrega",
      "view.histEntregas": "Historial de Entregas",
      "view.concorrencia": "Análisis de Competencia",
      "view.catalogo": "Catálogo Interno",
      "view.arp": "Actas de Registro (ARP)",
      "view.disputa": "Robot de Disputa",
      "view.ferramentas": "Configuración",
      "view.chat": "Pregunte al Chat",
      "cfg.title": "Configuración",
      "cfg.saveProfile": "Guardar perfil",
      "cfg.name": "Nombre",
      "cfg.cnpj": "CNPJ / RUC",
      "cfg.address": "Dirección",
      "cfg.phone": "Teléfono",
      "cfg.cep": "CP (flete / cruce)",
      "cfg.logo": "Logo (PNG/JPG)",
      "cfg.logoHint": "Máx. recomendado ~500 KB para PDFs ligeros.",
      "cfg.langTitle": "Idioma del sistema",
      "cfg.langDesc": "Elija el idioma de la interfaz. La preferencia se guarda en este navegador.",
      "cfg.backup": "Respaldo",
      "cfg.export": "Exportar respaldo",
      "cfg.import": "Importar respaldo",
      "common.save": "Guardar",
      "common.cancel": "Cancelar",
      "common.clear": "Limpiar",
      "common.search": "Buscar",
      "common.back": "Volver",
      "lw.backList": "← Lista",
      "lw.activeEdital": "Edicto activo",
      "lw.tab.hub": "Panel",
      "lw.tab.docs": "Docs",
      "lw.tab.analise": "Análisis IA",
      "lw.tab.importar": "Importar",
      "lw.tab.orcamento": "Presupuesto",
      "lw.tab.cruzamento": "Cruce ML",
      "cat.title": "Catálogo Interno",
      "cat.formTitle": "Registro de producto",
      "cat.nome": "Nombre del producto / Descripción",
      "cat.sku": "Código / SKU",
      "cat.preco": "Precio de referencia",
      "cat.marca": "Marca / Fabricante",
      "cat.save": "Guardar producto",
      "disputa.title": "Robot de Disputa",
      "disputa.desc": "Ingrese la oferta del competidor: el robot cubre automáticamente hasta su margen.",
      "disputa.on": "▶ Encender robot",
      "disputa.off": "■ Detener",
      "disputa.cover": "⚡ Cubrir ahora",
      "disputa.clear": "Limpiar sesión",
      "side.foot": "LICSYSTEM © Sistema de Licitación"
    }
  };

  var PHRASES = {
    "en": {
      "Entrar": "Sign in",
      "Aguarde um momento.": "Please wait a moment.",
      "Informe e-mail e senha para acessar o sistema.": "Enter your email and password to access the system.",
      "E-mail": "Email",
      "Senha": "Password",
      "Acesso restrito": "Restricted access",
      "Restaurando sessão…": "Restoring session…",
      "Licitação": "Bidding",
      "Setor de Licitações": "Bidding department",
      "Desempenho de Pregões": "Auction performance",
      "Distribuição de resultados no período.": "Result distribution for the period.",
      "Volume Mensal Disputado": "Monthly volume disputed",
      "Últimos 6 meses (R$ mil).": "Last 6 months (R$ thousand).",
      "Radar de Oportunidades": "Opportunity radar",
      "Alertas de novas contratações capturados no Radar PNCP (Pesquisas de Editais).": "New contracting alerts captured in PNCP Radar (Bid Searches).",
      "Nenhuma oportunidade capturada ainda. Use o Radar PNCP em <b>Pesquisas de Editais</b>.": "No opportunities captured yet. Use PNCP Radar in <b>Bid Searches</b>.",
      "🔔 Meus alertas": "🔔 My alerts",
      "automático": "automatic",
      "Verificar agora": "Check now",
      "Salve um monitoramento — o mais importante é <b>Editais próximos</b> (cidade + raio / vizinhos). Também dá no Radar (UF + palavras) e em Perguntar editais. Enquanto o sistema estiver aberto, o PNCP é consultado e o sino avisa só o que for <b>novo</b>.": "Save a monitor — the most important is <b>Nearby notices</b> (city + radius / neighbors). Also works in Radar (state + keywords) and Ask about notices. While the system is open, PNCP is queried and the bell only notifies what is <b>new</b>.",
      "Nenhum alerta ativo. Use “Ativar alerta” em Editais próximos (recomendado), Radar ou Perguntar editais.": "No active alerts. Use “Enable alert” in Nearby notices (recommended), Radar or Ask about notices.",
      "💬 Perguntar editais": "💬 Ask about notices",
      "PNCP · chat": "PNCP · chat",
      "▸ Expandir": "▸ Expand",
      "Pergunta": "Question",
      "Categoria (opcional)": "Category (optional)",
      "Janela": "Window",
      "Todas": "All",
      "Reformas / obras": "Renovations / works",
      "Aquisições de comida": "Food purchases",
      "Cestas básicas": "Basic food baskets",
      "Café / lanche": "Coffee / snacks",
      "Natal": "Christmas",
      "Eletrodomésticos": "Appliances",
      "Ano (~365 dias)": "Year (~365 days)",
      "45 dias": "45 days",
      "🔍 Buscar editais": "🔍 Search notices",
      "🔔 Ativar alerta": "🔔 Enable alert",
      "Atalhos:": "Shortcuts:",
      "Norte Pioneiro (todos)": "Norte Pioneiro (all)",
      "Norte Pioneiro · comida/cestas": "Norte Pioneiro · food/baskets",
      "Norte Pioneiro · reformas": "Norte Pioneiro · renovations",
      "Norte Pioneiro · Natal": "Norte Pioneiro · Christmas",
      "Norte Pioneiro · eletro": "Norte Pioneiro · appliances",
      "Ampliar modalidades": "Expand modalities",
      "Incluir leilões": "Include auctions",
      "← Anterior": "← Previous",
      "Próxima →": "Next →",
      "📍 Editais próximos": "📍 Nearby notices",
      "PNCP · raio": "PNCP · radius",
      "Município de origem": "Origin municipality",
      "Cobertura": "Coverage",
      "Raio livre": "Free radius",
      "Paraná + divisas SP": "Paraná + SP borders",
      "Raio (km)": "Radius (km)",
      "Palavras-chave (opcional)": "Keywords (optional)",
      "🔍 Buscar no raio": "🔍 Search in radius",
      "Atalhos de raio:": "Radius shortcuts:",
      "Ampliar modalidades (concorrência / pregão presencial)": "Expand modalities (competition / in-person auction)",
      "Incluir órgãos federais no raio": "Include federal agencies in radius",
      "Nenhum município salvo ainda.": "No municipality saved yet.",
      "📡 Radar PNCP": "📡 PNCP Radar",
      "API Pública": "Public API",
      "Palavras-chave de interesse (separadas por vírgula)": "Keywords of interest (comma-separated)",
      "UF": "State",
      "🔍 Buscar no PNCP": "🔍 Search PNCP",
      "Incluir leilões (eletrônico e presencial)": "Include auctions (electronic and in-person)",
      "🤖 Análise Inteligente de Editais": "🤖 Smart Notice Analysis",
      "Gemini": "Gemini",
      "Análise do Edital": "Notice analysis",
      "Arraste o PDF do edital aqui": "Drop the notice PDF here",
      "ou clique para selecionar · apenas texto é enviado à IA": "or click to select · only text is sent to the AI",
      "✨ Analisar com IA": "✨ Analyze with AI",
      "Limpar": "Clear",
      "Folha de Relatório": "Report sheet",
      "📑 Documentos necessários": "📑 Required documents",
      "🏆 Vamos participar?": "🏆 Shall we join?",
      "📋 Copiar Relatório": "📋 Copy report",
      "🖨 Imprimir": "🖨 Print",
      "O relatório da análise aparecerá aqui após processar o edital.": "The analysis report will appear here after processing the notice.",
      "🏆 Leilão que Participo": "🏆 Auctions I Join",
      "Pós Análise IA": "After AI analysis",
      "Clique em um edital para abrir o painel dele (Docs, Análise IA, Importar, Orçamento e Cruzamento ML) — cada um fica independente.": "Click a notice to open its panel (Docs, AI Analysis, Import, Budget and ML Matching) — each stays independent.",
      "Nenhum leilão marcado ainda. Analise um edital e confirme em <b>Vamos participar?</b>": "No auction marked yet. Analyze a notice and confirm in <b>Shall we join?</b>",
      "📋 Painel do Edital": "📋 Notice Panel",
      "Workspace": "Workspace",
      "Ferramentas deste edital. Tudo que você fizer aqui fica só nele.": "Tools for this notice. Everything you do here stays with it.",
      "Docs do Edital": "Bid Documents",
      "Checklist de documentos exigidos deste edital": "Checklist of documents required for this notice",
      "Análise IA": "AI Analysis",
      "Relatório da análise que gerou esta participação": "Report from the analysis that created this participation",
      "Importar Edital": "Import Notice",
      "Extrair itens do PDF só deste edital": "Extract items from the PDF for this notice only",
      "Orçamento": "Budget",
      "Planilha de preços exclusiva deste edital": "Price spreadsheet exclusive to this notice",
      "Cruzamento ML": "ML Matching",
      "Buscar preços no Mercado Livre para este orçamento": "Search Mercado Livre prices for this budget",
      "← Voltar à lista": "← Back to list",
      "📥 Importar Edital (PDF)": "📥 Import Notice (PDF)",
      "Arquivo PDF do edital": "Notice PDF file",
      "Palavras-chave (filtro, separadas por vírgula)": "Keywords (filter, comma-separated)",
      "📄 Extrair texto e filtrar": "📄 Extract text and filter",
      "Mostrar todas as linhas": "Show all lines",
      "🔎 Pesquisar selecionados no Google": "🔎 Search selected on Google",
      "⬇️ Exportar selecionados (PDF)": "⬇️ Export selected (PDF)",
      "➡️ Enviar p/ Orçamento": "➡️ Send to Budget",
      "Item / Descrição": "Item / Description",
      "Ações": "Actions",
      "Nenhum item extraído. Selecione um PDF e clique em \"Extrair texto e filtrar\".": "No items extracted. Select a PDF and click \"Extract text and filter\".",
      "🧮 Planilha de Orçamento": "🧮 Budget spreadsheet",
      "+ Linha": "+ Row",
      "⬇️ Excel": "⬇️ Excel",
      "⬇️ PDF": "⬇️ PDF",
      "💾 Salvar no Catálogo": "💾 Save to Catalog",
      "📑 Proposta PDF": "📑 Proposal PDF",
      "📊 Proposta Excel": "📊 Proposal Excel",
      "Espelho do edital: à esquerda os dados importados; à direita seus preços na mesma linha do lote. <b>Meu total</b> = Qtd × V. Unit × (1 + %/100).": "Notice mirror: imported data on the left; your prices on the right on the same lot row. <b>My total</b> = Qty × Unit × (1 + %/100).",
      "Arraste Excel/CSV do edital aqui": "Drop the notice Excel/CSV here",
      "Mapeia Lote/Item, Quantidade, Descrição, Valor Unitário e Valor Final (também Valor Máximo)": "Maps Lot/Item, Quantity, Description, Unit Value and Final Value (also Maximum Value)",
      "EDITAL": "NOTICE",
      "MEUS PREÇOS": "MY PRICES",
      "Lote": "Lot",
      "Qtd": "Qty",
      "Descrição": "Description",
      "V. Unitário": "Unit value",
      "V. Final": "Final value",
      "Link de Acesso": "Access link",
      "TOTAL EDITAL": "NOTICE TOTAL",
      "TOTAL MEUS PREÇOS": "MY PRICES TOTAL",
      "🔀 Cruzamento Inteligente (Mercado Livre)": "🔀 Smart Matching (Mercado Livre)",
      "ML API": "ML API",
      "Selecione itens na planilha de <b>Orçamento</b> (checkboxes) e processe em lote. Busca via <b>/api/search-ml</b>. Se o anúncio tiver frete grátis, aparece <b>FRETE GRÁTIS</b>; senão o frete é calculado para o CEP da sua cidade (perfil / campo abaixo).": "Select items in the <b>Budget</b> sheet (checkboxes) and process in batch. Search via <b>/api/search-ml</b>. If the listing has free shipping, <b>FREE SHIPPING</b> appears; otherwise shipping is calculated for your city ZIP (profile / field below).",
      "Item avulso (opcional — se nenhum checkbox estiver marcado)": "Standalone item (optional — if no checkbox is selected)",
      "Embalagem": "Packaging",
      "Unidade": "Unit",
      "Kit": "Kit",
      "Jogo": "Set",
      "CEP destino (frete) — prioriza perfil": "Destination ZIP (shipping) — profile first",
      "Margem %": "Margin %",
      "Imposto %": "Tax %",
      "Custo Operacional %": "Operating cost %",
      "Desconto Fornecedor (R$)": "Supplier discount (R$)",
      "⚙️ Processar Lote (ML)": "⚙️ Process batch (ML)",
      "Aguardando processamento…": "Waiting for processing…",
      "Resultados": "Results",
      "📑 Gerar Proposta Comercial PDF": "📑 Generate commercial proposal PDF",
      "Nenhum cruzamento processado ainda.": "No matching processed yet.",
      "🔐 Cofre de Documentos": "🔐 Document Vault",
      "+ Adicionar": "+ Add",
      "✏️ Editar": "✏️ Edit",
      "🗑 Remover": "🗑 Remove",
      "📦 Exportar ZIP": "📦 Export ZIP",
      "💾 Salvar": "💾 Save",
      "Gerencie certidões e documentos habilitatórios: adicione, edite, remova vencidos e exporte em ZIP. <b>Verde:</b> válido · <b>Amarelo:</b> vence em ≤15 dias · <b>Vermelho:</b> vencido/sem data.": "Manage certificates and qualification documents: add, edit, remove expired ones and export as ZIP. <b>Green:</b> valid · <b>Yellow:</b> expires in ≤15 days · <b>Red:</b> expired/no date.",
      "Selecionar todos": "Select all",
      "Carregar padrões": "Load defaults",
      "✅ Documentos do Edital": "✅ Bid Documents",
      "+ Documento": "+ Document",
      "Limpar OKs": "Clear OKs",
      "Checklist dos documentos exigidos na análise do edital. Marque <b>OK</b> nos que você já possui. Quando possível, o sistema sugere correspondência com o <b>Cofre de Documentos</b>.": "Checklist of documents required in the notice analysis. Mark <b>OK</b> on those you already have. When possible, the system suggests a match with the <b>Document Vault</b>.",
      "Nenhum checklist ainda. Rode a <b>Análise IA</b> em um edital para gerar a lista.": "No checklist yet. Run <b>AI Analysis</b> on a notice to generate the list.",
      "🚚 Entrega": "🚚 Delivery",
      "+ Nova Entrega": "+ New delivery",
      "Registre empenho, nota fiscal, anexos e destinação logística.": "Register commitment, invoice, attachments and logistics destination.",
      "Nenhuma entrega registrada ainda.": "No delivery registered yet.",
      "Total Vendido (R$)": "Total sold (R$)",
      "Σ Qtd entregue × venda un.": "Σ Qty delivered × unit sale",
      "Custo Total (R$)": "Total cost (R$)",
      "Σ Qtd entregue × custo un.": "Σ Qty delivered × unit cost",
      "Lucro Bruto (R$)": "Gross profit (R$)",
      "Vendido − Custo": "Sold − Cost",
      "Entregas Pendentes": "Pending deliveries",
      "Unidades ainda a entregar": "Units still to deliver",
      "📦 Histórico e Controle de Entregas": "📦 Delivery history & control",
      "↺ Exemplos": "↺ Examples",
      "+ Novo item": "+ New item",
      "Baixa manual de quantidade entregue, saldo pendente e lucro em tempo real.": "Manual write-off of delivered quantity, pending balance and real-time profit.",
      "Buscar por Licitação ou Empenho": "Search by bid or commitment",
      "Filtrar por Status": "Filter by status",
      "Todos": "All",
      "Pendente": "Pending",
      "Parcialmente Entregue": "Partially delivered",
      "Concluído": "Completed",
      "Empenho / Licitação": "Commitment / Bid",
      "Produto": "Product",
      "Qtd Solicitada": "Qty requested",
      "Qtd Entregue": "Qty delivered",
      "Falta Entregar": "Remaining",
      "Custo Un. (R$)": "Unit cost (R$)",
      "Venda Un. (R$)": "Unit sale (R$)",
      "Status / Ação": "Status / Action",
      "🔎 Análise de Concorrência": "🔎 Competition analysis",
      "BrasilAPI": "BrasilAPI",
      "Consulte dados cadastrais de um CNPJ concorrente.": "Look up registration data for a competitor tax ID (CNPJ).",
      "CNPJ": "Tax ID (CNPJ)",
      "Buscar": "Search",
      "Produtos": "Products",
      "Cadastre produtos com preço de referência <b>ou</b> salve orçamentos completos (nome + número da licitação) pela aba Orçamento. Em orçamentos salvos, clique em <b>✎ Editar</b> para reabrir e continuar.": "Register products with a reference price <b>or</b> save full budgets (name + bid number) from the Budget tab. On saved budgets, click <b>✎ Edit</b> to reopen and continue.",
      "Editando produto — altere os campos e clique em Salvar.": "Editing product — change the fields and click Save.",
      "Cancelar edição": "Cancel edit",
      "Código / Nº": "Code / No.",
      "Descrição / Licitação": "Description / Bid",
      "Tipo / Marca": "Type / Brand",
      "Preço / Total": "Price / Total",
      "Nenhum produto cadastrado.": "No products registered.",
      "📄 Atas de Registro (ARP)": "📄 Price registration (ARP)",
      "Saldos": "Balances",
      "Cadastre a ata, itens homologados e acompanhe o <b>saldo disponível</b> (Total − Consumido). Preparado para persistência no banco.": "Register the minutes, approved items and track <b>available balance</b> (Total − Consumed). Ready for database persistence.",
      "1 · Dados gerais da ata": "1 · General minutes data",
      "Órgão Gerenciador": "Managing agency",
      "Número do Pregão / ARP": "Auction / ARP number",
      "Data de Vencimento / Validade": "Expiration / validity date",
      "Aceita Carona (Adesão)?": "Accept piggyback (adhesion)?",
      "2 · Adicionar item à ata": "2 · Add item to minutes",
      "Qtd. Total Homologada": "Total approved qty",
      "Qtd. Já Consumida / Empenhada": "Qty already consumed / committed",
      "+ Adicionar Item à Ata": "+ Add item to minutes",
      "3 · Acompanhamento de saldo": "3 · Balance tracking",
      "💾 Salvar Ata": "💾 Save minutes",
      "Qtd. Total": "Total qty",
      "Qtd. Consumida": "Qty consumed",
      "Saldo Disponível": "Available balance",
      "Nenhum item adicionado a esta ata.": "No items added to these minutes.",
      "Atas salvas": "Saved minutes",
      "+ Nova Ata": "+ New minutes",
      "Nenhuma ARP salva ainda.": "No ARP saved yet.",
      "Desligado": "Off",
      "Robô desligado": "Robot off",
      "Configure custo, margem e degrau, depois ligue o robô.": "Set cost, margin and step, then start the robot.",
      "Estratégia do robô": "Robot strategy",
      "Meu custo (R$)": "My cost (R$)",
      "Margem mínima": "Minimum margin",
      "Degrau / intervalo (R$)": "Step / interval (R$)",
      "Piso absoluto (R$)": "Absolute floor (R$)",
      "Delay entre lances (ms)": "Delay between bids (ms)",
      "Preço de referência (opcional)": "Reference price (optional)",
      "Lance ao vivo": "Live bid",
      "Lance atual do concorrente (R$)": "Current competitor bid (R$)",
      "Próximo lance": "Next bid",
      "Concorrente − degrau": "Competitor − step",
      "Margem no próximo": "Margin on next",
      "Lance − meu custo": "Bid − my cost",
      "Desconto vs referência": "Discount vs reference",
      "Opcional": "Optional",
      "Decisão": "Decision",
      "Aguardando dados": "Waiting for data",
      "Histórico do robô": "Robot history",
      "0 registro(s)": "0 record(s)",
      "Nenhum lance ainda. Ligue o robô e informe o lance do concorrente.": "No bids yet. Start the robot and enter the competitor bid.",
      "PNCP": "PNCP",
      "Nova Entrega": "New delivery",
      "Preencha identificação, nota fiscal e destinação logística.": "Fill in identification, invoice and logistics destination.",
      "1 · Identificação": "1 · Identification",
      "Nome da Licitação": "Bid name",
      "Número do Empenho": "Commitment number",
      "2 · Faturamento, origem e anexos": "2 · Billing, origin and attachments",
      "Status da Nota": "Invoice status",
      "NÃO FEITO": "NOT DONE",
      "FEITO": "DONE",
      "Anexar Nota Fiscal": "Attach invoice",
      "PDF ou imagem": "PDF or image",
      "Clique para selecionar o arquivo": "Click to select the file",
      "Observações / Balão da Nota": "Notes / invoice balloon",
      "Material Adquirido / Fornecedor de Origem": "Purchased material / origin supplier",
      "3 · Logística de destinação": "3 · Destination logistics",
      "DESTINO FINAL": "FINAL DESTINATION",
      "Entrega direta no órgão / local do cliente": "Direct delivery to agency / client site",
      "MINHA LOJA": "MY STORE",
      "Estoque interno — envio futuro": "Internal stock — future shipment",
      "Endereço do destino": "Destination address",
      "Nome do Local / Responsável": "Site name / contact",
      "CEP": "ZIP",
      "Endereço": "Address",
      "Número": "Number",
      "Complemento": "Complement",
      "Bairro": "Neighborhood",
      "Cidade": "City",
      "Digite o CEP (8 dígitos) para preencher via ViaCEP.": "Enter the ZIP (8 digits) to autofill via ViaCEP.",
      "Envio futuro": "Future shipment",
      "Transporte para envio futuro": "Transport for future shipment",
      "Selecione…": "Select…",
      "Correios": "Postal service",
      "Transportadora": "Carrier",
      "Veículo Próprio": "Own vehicle",
      "Cancelar": "Cancel",
      "💾 Salvar Entrega": "💾 Save delivery",
      "Salvar no Catálogo Interno": "Save to Internal Catalog",
      "Informe o nome e o número da licitação. Depois você reabre pelo Catálogo → Editar.": "Enter the bid name and number. Then reopen from Catalog → Edit.",
      "Número da Licitação / Pregão": "Bid / auction number",
      "A IA identificou os documentos abaixo no edital. Confira e marque o que você já tem.": "The AI identified the documents below in the notice. Review and mark what you already have.",
      "Fechar": "Close",
      "Ver o que tenho / Marcar OK": "See what I have / Mark OK",
      "Deseja marcar este edital em <b>Leilão que Participo</b> para acompanhar a disputa?": "Do you want to mark this notice in <b>Auctions I Join</b> to track the dispute?",
      "NÃO": "NO",
      "SIM": "YES",
      "Adicionar documento": "Add document",
      "Informe os dados do documento. Arquivo (PDF/imagem) ou link externo.": "Enter the document details. File (PDF/image) or external link.",
      "Nome do documento": "Document name",
      "Tipo / categoria": "Type / category",
      "Habilitação": "Qualification",
      "Certidão": "Certificate",
      "Contrato / Ato societário": "Contract / corporate act",
      "Técnica": "Technical",
      "Outro": "Other",
      "Validade (opcional)": "Validity (optional)",
      "Link (opcional)": "Link (optional)",
      "Arquivo PDF ou imagem (opcional, máx. 1,5 MB)": "PDF or image file (optional, max 1.5 MB)",
      "Observações": "Notes",
      "💾 Salvar documento": "💾 Save document",
      "Digite e escolha na lista (ex.: Ibaiti)": "Type and choose from the list (e.g. Ibaiti)",
      "ex.: material elétrico, ferramenta": "e.g. electrical material, tool",
      "ex.: leilao veiculo, sucata, cesta basica": "e.g. vehicle auction, scrap, food basket",
      "ex.: parafuso, tinta, cabo": "e.g. screw, paint, cable",
      "ex.: Furadeira de impacto 650W com maleta e brocas": "e.g. 650W impact drill with case and bits",
      "Do perfil da empresa ou digite aqui": "From company profile or type here",
      "Filtrar por nome, código ou marca…": "Filter by name, code or brand…",
      "ex.: Pref. Ibaiti, 2026/001…": "e.g. Pref. Ibaiti, 2026/001…",
      "ex.: Abraçadeira Borboleta 12–20mm (kit 10)": "e.g. Butterfly clamp 12–20mm (kit of 10)",
      "ex.: ABR-BOR-1220": "e.g. ABR-BOR-1220",
      "ex.: Vonder": "e.g. Vonder",
      "ex.: Prefeitura de Ibaiti": "e.g. Ibaiti City Hall",
      "ex.: PE 013/2026 — ARP 05/2026": "e.g. PE 013/2026 — ARP 05/2026",
      "Descrição do item homologado": "Approved item description",
      "Digite ou cole o lance do portal": "Type or paste the portal bid",
      "Para % de desconto": "For discount %",
      "Razão social / nome fantasia": "Legal / trade name",
      "Rua, número, bairro, cidade/UF": "Street, number, neighborhood, city/state",
      "ex.: PREFEITURA IBAITI": "e.g. IBAITI CITY HALL",
      "ex.: 2026NE001234": "e.g. 2026NE001234",
      "Detalhes da NF, pendências, contato…": "Invoice details, pending items, contact…",
      "ex.: Ferragens XYZ — abraçadeiras e furadeiras": "e.g. XYZ Hardware — clamps and drills",
      "ex.: Almoxarifado Pref. Ibaiti — João": "e.g. Pref. Ibaiti warehouse — John",
      "Rua / Avenida (ViaCEP)": "Street / Avenue (ViaCEP)",
      "Sala, bloco, referência…": "Room, block, reference…",
      "ex.: Pref. Ibaiti — Material de construção": "e.g. Pref. Ibaiti — Construction materials",
      "ex.: PE 013/2026": "e.g. PE 013/2026",
      "ex.: CND Federal": "e.g. Federal tax clearance",
      "ex.: renovar no site da Receita": "e.g. renew on the tax authority website",
      "Ex.: Santa Cruz do Rio Pardo  ou  Quais licitações terão em Ibaiti": "E.g.: Santa Cruz do Rio Pardo  or  Which bids will there be in Ibaiti",
      "seu@email.com": "you@email.com",
      "Expandir painel": "Expand panel",
      "Abrir menu": "Open menu",
      "Fechar menu": "Close menu",
      "Menu principal": "Main menu",
      "Alertas de editais": "Bid alerts",
      "Sair": "Sign out",
      "Voltar à lista": "Back to list",
      "Ferramentas do edital": "Notice tools",
      "Idioma": "Language",
      "Salvar cidade/pergunta como alerta automático": "Save city/question as automatic alert",
      "Monitorar municípios vizinhos no raio e avisar no sino": "Monitor nearby municipalities in the radius and notify on the bell",
      "Salvar palavras-chave + UF como alerta automático": "Save keywords + state as automatic alert",
      "Enviar PDF do edital": "Send notice PDF",
      "Lote ou Item do edital": "Lot or item from the notice",
      "Quantidade": "Quantity",
      "Quantidade em estoque / posso entregar": "Stock quantity / I can deliver",
      "Recarregar exemplos de demonstração": "Reload demo examples",
      "Resumo financeiro das entregas": "Delivery financial summary",
      "Pesquisar no catálogo": "Search catalog",
      "Não lança abaixo deste valor": "Will not bid below this value",
      "Tipo de margem": "Margin type",
      "Sincronização na nuvem": "Cloud sync",
      "Atalhos Norte Pioneiro": "Norte Pioneiro shortcuts",
      "Atalhos de raio": "Radius shortcuts",
      "Horizonte de encerramento da proposta no PNCP": "Proposal closing horizon on PNCP",
      "Pesquisas de Editais": "Bid Searches",
      "Leilão que Participo": "Auctions I Join",
      "Entrega": "Delivery",
      "Pergunte ao Chat": "Ask Chat",
      "Prévia do logo": "Logo preview",
      "Nome": "Name",
      "Telefone": "Phone",
      "CEP (frete / cruzamento)": "ZIP (shipping / matching)",
      "Logo (PNG/JPG)": "Logo (PNG/JPG)",
      "Nome do Produto / Descrição": "Product name / Description",
      "Código / SKU": "Code / SKU",
      "Preço de Referência (R$)": "Reference price (R$)",
      "Marca / Fabricante": "Brand / Manufacturer"
    },
    "es": {
      "Entrar": "Entrar",
      "Aguarde um momento.": "Espere un momento.",
      "Informe e-mail e senha para acessar o sistema.": "Ingrese correo y contraseña para acceder al sistema.",
      "E-mail": "Correo",
      "Senha": "Contraseña",
      "Acesso restrito": "Acceso restringido",
      "Restaurando sessão…": "Restaurando sesión…",
      "Licitação": "Licitación",
      "Setor de Licitações": "Sector de licitaciones",
      "Desempenho de Pregões": "Desempeño de subastas",
      "Distribuição de resultados no período.": "Distribución de resultados en el período.",
      "Volume Mensal Disputado": "Volumen mensual disputado",
      "Últimos 6 meses (R$ mil).": "Últimos 6 meses (R$ mil).",
      "Radar de Oportunidades": "Radar de oportunidades",
      "Alertas de novas contratações capturados no Radar PNCP (Pesquisas de Editais).": "Alertas de nuevas contrataciones capturados en el Radar PNCP (Búsqueda de Edictos).",
      "Nenhuma oportunidade capturada ainda. Use o Radar PNCP em <b>Pesquisas de Editais</b>.": "Aún no hay oportunidades capturadas. Use el Radar PNCP en <b>Búsqueda de Edictos</b>.",
      "🔔 Meus alertas": "🔔 Mis alertas",
      "automático": "automático",
      "Verificar agora": "Verificar ahora",
      "Salve um monitoramento — o mais importante é <b>Editais próximos</b> (cidade + raio / vizinhos). Também dá no Radar (UF + palavras) e em Perguntar editais. Enquanto o sistema estiver aberto, o PNCP é consultado e o sino avisa só o que for <b>novo</b>.": "Guarde un monitoreo — lo más importante es <b>Edictos cercanos</b> (ciudad + radio / vecinos). También en Radar (UF + palabras) y Preguntar edictos. Mientras el sistema esté abierto, se consulta el PNCP y la campana avisa solo lo <b>nuevo</b>.",
      "Nenhum alerta ativo. Use “Ativar alerta” em Editais próximos (recomendado), Radar ou Perguntar editais.": "Ninguna alerta activa. Use “Activar alerta” en Edictos cercanos (recomendado), Radar o Preguntar edictos.",
      "💬 Perguntar editais": "💬 Preguntar edictos",
      "PNCP · chat": "PNCP · chat",
      "▸ Expandir": "▸ Expandir",
      "Pergunta": "Pregunta",
      "Categoria (opcional)": "Categoría (opcional)",
      "Janela": "Ventana",
      "Todas": "Todas",
      "Reformas / obras": "Reformas / obras",
      "Aquisições de comida": "Adquisiciones de comida",
      "Cestas básicas": "Canastas básicas",
      "Café / lanche": "Café / refrigerio",
      "Natal": "Navidad",
      "Eletrodomésticos": "Electrodomésticos",
      "Ano (~365 dias)": "Año (~365 días)",
      "45 dias": "45 días",
      "🔍 Buscar editais": "🔍 Buscar edictos",
      "🔔 Ativar alerta": "🔔 Activar alerta",
      "Atalhos:": "Atajos:",
      "Norte Pioneiro (todos)": "Norte Pioneiro (todos)",
      "Norte Pioneiro · comida/cestas": "Norte Pioneiro · comida/cestas",
      "Norte Pioneiro · reformas": "Norte Pioneiro · reformas",
      "Norte Pioneiro · Natal": "Norte Pioneiro · Navidad",
      "Norte Pioneiro · eletro": "Norte Pioneiro · electro",
      "Ampliar modalidades": "Ampliar modalidades",
      "Incluir leilões": "Incluir subastas",
      "← Anterior": "← Anterior",
      "Próxima →": "Siguiente →",
      "📍 Editais próximos": "📍 Edictos cercanos",
      "PNCP · raio": "PNCP · radio",
      "Município de origem": "Municipio de origen",
      "Cobertura": "Cobertura",
      "Raio livre": "Radio libre",
      "Paraná + divisas SP": "Paraná + fronteras SP",
      "Raio (km)": "Radio (km)",
      "Palavras-chave (opcional)": "Palabras clave (opcional)",
      "🔍 Buscar no raio": "🔍 Buscar en el radio",
      "Atalhos de raio:": "Atajos de radio:",
      "Ampliar modalidades (concorrência / pregão presencial)": "Ampliar modalidades (concurrencia / subasta presencial)",
      "Incluir órgãos federais no raio": "Incluir órganos federales en el radio",
      "Nenhum município salvo ainda.": "Ningún municipio guardado aún.",
      "📡 Radar PNCP": "📡 Radar PNCP",
      "API Pública": "API Pública",
      "Palavras-chave de interesse (separadas por vírgula)": "Palabras clave de interés (separadas por coma)",
      "UF": "UF",
      "🔍 Buscar no PNCP": "🔍 Buscar en PNCP",
      "Incluir leilões (eletrônico e presencial)": "Incluir subastas (electrónica y presencial)",
      "🤖 Análise Inteligente de Editais": "🤖 Análisis Inteligente de Edictos",
      "Gemini": "Gemini",
      "Análise do Edital": "Análisis del edicto",
      "Arraste o PDF do edital aqui": "Arrastre el PDF del edicto aquí",
      "ou clique para selecionar · apenas texto é enviado à IA": "o haga clic para seleccionar · solo se envía texto a la IA",
      "✨ Analisar com IA": "✨ Analizar con IA",
      "Limpar": "Limpiar",
      "Folha de Relatório": "Hoja de informe",
      "📑 Documentos necessários": "📑 Documentos necesarios",
      "🏆 Vamos participar?": "🏆 ¿Participamos?",
      "📋 Copiar Relatório": "📋 Copiar informe",
      "🖨 Imprimir": "🖨 Imprimir",
      "O relatório da análise aparecerá aqui após processar o edital.": "El informe del análisis aparecerá aquí tras procesar el edicto.",
      "🏆 Leilão que Participo": "🏆 Subastas en las que participo",
      "Pós Análise IA": "Tras análisis IA",
      "Clique em um edital para abrir o painel dele (Docs, Análise IA, Importar, Orçamento e Cruzamento ML) — cada um fica independente.": "Haga clic en un edicto para abrir su panel (Docs, Análisis IA, Importar, Presupuesto y Cruce ML) — cada uno queda independiente.",
      "Nenhum leilão marcado ainda. Analise um edital e confirme em <b>Vamos participar?</b>": "Ninguna subasta marcada aún. Analice un edicto y confirme en <b>¿Participamos?</b>",
      "📋 Painel do Edital": "📋 Panel del Edicto",
      "Workspace": "Workspace",
      "Ferramentas deste edital. Tudo que você fizer aqui fica só nele.": "Herramientas de este edicto. Todo lo que haga aquí queda solo en él.",
      "Docs do Edital": "Docs del Edicto",
      "Checklist de documentos exigidos deste edital": "Checklist de documentos exigidos de este edicto",
      "Análise IA": "Análisis IA",
      "Relatório da análise que gerou esta participação": "Informe del análisis que generó esta participación",
      "Importar Edital": "Importar Edicto",
      "Extrair itens do PDF só deste edital": "Extraer ítems del PDF solo de este edicto",
      "Orçamento": "Presupuesto",
      "Planilha de preços exclusiva deste edital": "Hoja de precios exclusiva de este edicto",
      "Cruzamento ML": "Cruce ML",
      "Buscar preços no Mercado Livre para este orçamento": "Buscar precios en Mercado Libre para este presupuesto",
      "← Voltar à lista": "← Volver a la lista",
      "📥 Importar Edital (PDF)": "📥 Importar Edicto (PDF)",
      "Arquivo PDF do edital": "Archivo PDF del edicto",
      "Palavras-chave (filtro, separadas por vírgula)": "Palabras clave (filtro, separadas por coma)",
      "📄 Extrair texto e filtrar": "📄 Extraer texto y filtrar",
      "Mostrar todas as linhas": "Mostrar todas las líneas",
      "🔎 Pesquisar selecionados no Google": "🔎 Buscar seleccionados en Google",
      "⬇️ Exportar selecionados (PDF)": "⬇️ Exportar seleccionados (PDF)",
      "➡️ Enviar p/ Orçamento": "➡️ Enviar a Presupuesto",
      "Item / Descrição": "Ítem / Descripción",
      "Ações": "Acciones",
      "Nenhum item extraído. Selecione um PDF e clique em \"Extrair texto e filtrar\".": "Ningún ítem extraído. Seleccione un PDF y haga clic en \"Extraer texto y filtrar\".",
      "🧮 Planilha de Orçamento": "🧮 Planilla de Presupuesto",
      "+ Linha": "+ Fila",
      "⬇️ Excel": "⬇️ Excel",
      "⬇️ PDF": "⬇️ PDF",
      "💾 Salvar no Catálogo": "💾 Guardar en Catálogo",
      "📑 Proposta PDF": "📑 Propuesta PDF",
      "📊 Proposta Excel": "📊 Propuesta Excel",
      "Espelho do edital: à esquerda os dados importados; à direita seus preços na mesma linha do lote. <b>Meu total</b> = Qtd × V. Unit × (1 + %/100).": "Espejo del edicto: a la izquierda los datos importados; a la derecha sus precios en la misma fila del lote. <b>Mi total</b> = Cant × V. Unit × (1 + %/100).",
      "Arraste Excel/CSV do edital aqui": "Arrastre el Excel/CSV del edicto aquí",
      "Mapeia Lote/Item, Quantidade, Descrição, Valor Unitário e Valor Final (também Valor Máximo)": "Mapea Lote/Ítem, Cantidad, Descripción, Valor Unitario y Valor Final (también Valor Máximo)",
      "EDITAL": "EDICTO",
      "MEUS PREÇOS": "MIS PRECIOS",
      "Lote": "Lote",
      "Qtd": "Cant",
      "Descrição": "Descripción",
      "V. Unitário": "V. Unitario",
      "V. Final": "V. Final",
      "Link de Acesso": "Enlace de acceso",
      "TOTAL EDITAL": "TOTAL EDICTO",
      "TOTAL MEUS PREÇOS": "TOTAL MIS PRECIOS",
      "🔀 Cruzamento Inteligente (Mercado Livre)": "🔀 Cruce Inteligente (Mercado Libre)",
      "ML API": "ML API",
      "Selecione itens na planilha de <b>Orçamento</b> (checkboxes) e processe em lote. Busca via <b>/api/search-ml</b>. Se o anúncio tiver frete grátis, aparece <b>FRETE GRÁTIS</b>; senão o frete é calculado para o CEP da sua cidade (perfil / campo abaixo).": "Seleccione ítems en la planilla de <b>Presupuesto</b> (casillas) y procese en lote. Búsqueda vía <b>/api/search-ml</b>. Si el anuncio tiene envío gratis, aparece <b>ENVÍO GRATIS</b>; si no, el flete se calcula para el CP de su ciudad (perfil / campo abajo).",
      "Item avulso (opcional — se nenhum checkbox estiver marcado)": "Ítem suelto (opcional — si ninguna casilla está marcada)",
      "Embalagem": "Embalaje",
      "Unidade": "Unidad",
      "Kit": "Kit",
      "Jogo": "Juego",
      "CEP destino (frete) — prioriza perfil": "CP destino (flete) — prioriza perfil",
      "Margem %": "Margen %",
      "Imposto %": "Impuesto %",
      "Custo Operacional %": "Costo operativo %",
      "Desconto Fornecedor (R$)": "Descuento proveedor (R$)",
      "⚙️ Processar Lote (ML)": "⚙️ Procesar lote (ML)",
      "Aguardando processamento…": "Esperando procesamiento…",
      "Resultados": "Resultados",
      "📑 Gerar Proposta Comercial PDF": "📑 Generar propuesta comercial PDF",
      "Nenhum cruzamento processado ainda.": "Ningún cruce procesado aún.",
      "🔐 Cofre de Documentos": "🔐 Caja de Documentos",
      "+ Adicionar": "+ Agregar",
      "✏️ Editar": "✏️ Editar",
      "🗑 Remover": "🗑 Eliminar",
      "📦 Exportar ZIP": "📦 Exportar ZIP",
      "💾 Salvar": "💾 Guardar",
      "Gerencie certidões e documentos habilitatórios: adicione, edite, remova vencidos e exporte em ZIP. <b>Verde:</b> válido · <b>Amarelo:</b> vence em ≤15 dias · <b>Vermelho:</b> vencido/sem data.": "Gestione certificados y documentos habilitatorios: agregue, edite, elimine vencidos y exporte en ZIP. <b>Verde:</b> válido · <b>Amarillo:</b> vence en ≤15 días · <b>Rojo:</b> vencido/sin fecha.",
      "Selecionar todos": "Seleccionar todos",
      "Carregar padrões": "Cargar predeterminados",
      "✅ Documentos do Edital": "✅ Documentos del Edicto",
      "+ Documento": "+ Documento",
      "Limpar OKs": "Limpiar OKs",
      "Checklist dos documentos exigidos na análise do edital. Marque <b>OK</b> nos que você já possui. Quando possível, o sistema sugere correspondência com o <b>Cofre de Documentos</b>.": "Checklist de documentos exigidos en el análisis del edicto. Marque <b>OK</b> en los que ya posee. Cuando sea posible, el sistema sugiere coincidencia con la <b>Caja de Documentos</b>.",
      "Nenhum checklist ainda. Rode a <b>Análise IA</b> em um edital para gerar a lista.": "Ningún checklist aún. Ejecute el <b>Análisis IA</b> en un edicto para generar la lista.",
      "🚚 Entrega": "🚚 Entrega",
      "+ Nova Entrega": "+ Nueva entrega",
      "Registre empenho, nota fiscal, anexos e destinação logística.": "Registre compromiso, factura, anexos y destino logístico.",
      "Nenhuma entrega registrada ainda.": "Ninguna entrega registrada aún.",
      "Total Vendido (R$)": "Total vendido (R$)",
      "Σ Qtd entregue × venda un.": "Σ Cant entregada × venta un.",
      "Custo Total (R$)": "Costo total (R$)",
      "Σ Qtd entregue × custo un.": "Σ Cant entregada × costo un.",
      "Lucro Bruto (R$)": "Ganancia bruta (R$)",
      "Vendido − Custo": "Vendido − Costo",
      "Entregas Pendentes": "Entregas pendientes",
      "Unidades ainda a entregar": "Unidades aún por entregar",
      "📦 Histórico e Controle de Entregas": "📦 Historial y control de entregas",
      "↺ Exemplos": "↺ Ejemplos",
      "+ Novo item": "+ Nuevo ítem",
      "Baixa manual de quantidade entregue, saldo pendente e lucro em tempo real.": "Baja manual de cantidad entregada, saldo pendiente y ganancia en tiempo real.",
      "Buscar por Licitação ou Empenho": "Buscar por licitación o compromiso",
      "Filtrar por Status": "Filtrar por estado",
      "Todos": "Todos",
      "Pendente": "Pendiente",
      "Parcialmente Entregue": "Parcialmente entregado",
      "Concluído": "Concluido",
      "Empenho / Licitação": "Compromiso / Licitación",
      "Produto": "Producto",
      "Qtd Solicitada": "Cant. solicitada",
      "Qtd Entregue": "Cant. entregada",
      "Falta Entregar": "Falta entregar",
      "Custo Un. (R$)": "Costo un. (R$)",
      "Venda Un. (R$)": "Venta un. (R$)",
      "Status / Ação": "Estado / Acción",
      "🔎 Análise de Concorrência": "🔎 Análisis de competencia",
      "BrasilAPI": "BrasilAPI",
      "Consulte dados cadastrais de um CNPJ concorrente.": "Consulte datos registrales de un CNPJ competidor.",
      "CNPJ": "CNPJ",
      "Buscar": "Buscar",
      "Produtos": "Productos",
      "Cadastre produtos com preço de referência <b>ou</b> salve orçamentos completos (nome + número da licitação) pela aba Orçamento. Em orçamentos salvos, clique em <b>✎ Editar</b> para reabrir e continuar.": "Registre productos con precio de referencia <b>o</b> guarde presupuestos completos (nombre + número de licitación) desde la pestaña Presupuesto. En presupuestos guardados, haga clic en <b>✎ Editar</b> para reabrir y continuar.",
      "Editando produto — altere os campos e clique em Salvar.": "Editando producto — cambie los campos y haga clic en Guardar.",
      "Cancelar edição": "Cancelar edición",
      "Código / Nº": "Código / N.º",
      "Descrição / Licitação": "Descripción / Licitación",
      "Tipo / Marca": "Tipo / Marca",
      "Preço / Total": "Precio / Total",
      "Nenhum produto cadastrado.": "Ningún producto registrado.",
      "📄 Atas de Registro (ARP)": "📄 Actas de Registro (ARP)",
      "Saldos": "Saldos",
      "Cadastre a ata, itens homologados e acompanhe o <b>saldo disponível</b> (Total − Consumido). Preparado para persistência no banco.": "Registre el acta, ítems homologados y siga el <b>saldo disponible</b> (Total − Consumido). Preparado para persistencia en base de datos.",
      "1 · Dados gerais da ata": "1 · Datos generales del acta",
      "Órgão Gerenciador": "Órgano gestor",
      "Número do Pregão / ARP": "Número de subasta / ARP",
      "Data de Vencimento / Validade": "Fecha de vencimiento / validez",
      "Aceita Carona (Adesão)?": "¿Acepta carona (adhesión)?",
      "2 · Adicionar item à ata": "2 · Agregar ítem al acta",
      "Qtd. Total Homologada": "Cant. total homologada",
      "Qtd. Já Consumida / Empenhada": "Cant. ya consumida / comprometida",
      "+ Adicionar Item à Ata": "+ Agregar ítem al acta",
      "3 · Acompanhamento de saldo": "3 · Seguimiento de saldo",
      "💾 Salvar Ata": "💾 Guardar acta",
      "Qtd. Total": "Cant. total",
      "Qtd. Consumida": "Cant. consumida",
      "Saldo Disponível": "Saldo disponible",
      "Nenhum item adicionado a esta ata.": "Ningún ítem agregado a este acta.",
      "Atas salvas": "Actas guardadas",
      "+ Nova Ata": "+ Nueva acta",
      "Nenhuma ARP salva ainda.": "Ninguna ARP guardada aún.",
      "Desligado": "Apagado",
      "Robô desligado": "Robot apagado",
      "Configure custo, margem e degrau, depois ligue o robô.": "Configure costo, margen y escalón, luego encienda el robot.",
      "Estratégia do robô": "Estrategia del robot",
      "Meu custo (R$)": "Mi costo (R$)",
      "Margem mínima": "Margen mínimo",
      "Degrau / intervalo (R$)": "Escalón / intervalo (R$)",
      "Piso absoluto (R$)": "Piso absoluto (R$)",
      "Delay entre lances (ms)": "Retraso entre ofertas (ms)",
      "Preço de referência (opcional)": "Precio de referencia (opcional)",
      "Lance ao vivo": "Oferta en vivo",
      "Lance atual do concorrente (R$)": "Oferta actual del competidor (R$)",
      "Próximo lance": "Próxima oferta",
      "Concorrente − degrau": "Competidor − escalón",
      "Margem no próximo": "Margen en el próximo",
      "Lance − meu custo": "Oferta − mi costo",
      "Desconto vs referência": "Descuento vs referencia",
      "Opcional": "Opcional",
      "Decisão": "Decisión",
      "Aguardando dados": "Esperando datos",
      "Histórico do robô": "Historial del robot",
      "0 registro(s)": "0 registro(s)",
      "Nenhum lance ainda. Ligue o robô e informe o lance do concorrente.": "Ninguna oferta aún. Encienda el robot e informe la oferta del competidor.",
      "PNCP": "PNCP",
      "Nova Entrega": "Nueva entrega",
      "Preencha identificação, nota fiscal e destinação logística.": "Complete identificación, factura y destino logístico.",
      "1 · Identificação": "1 · Identificación",
      "Nome da Licitação": "Nombre de la licitación",
      "Número do Empenho": "Número de compromiso",
      "2 · Faturamento, origem e anexos": "2 · Facturación, origen y anexos",
      "Status da Nota": "Estado de la factura",
      "NÃO FEITO": "NO HECHO",
      "FEITO": "HECHO",
      "Anexar Nota Fiscal": "Adjuntar factura",
      "PDF ou imagem": "PDF o imagen",
      "Clique para selecionar o arquivo": "Haga clic para seleccionar el archivo",
      "Observações / Balão da Nota": "Observaciones / globo de la factura",
      "Material Adquirido / Fornecedor de Origem": "Material adquirido / proveedor de origen",
      "3 · Logística de destinação": "3 · Logística de destino",
      "DESTINO FINAL": "DESTINO FINAL",
      "Entrega direta no órgão / local do cliente": "Entrega directa en el órgano / local del cliente",
      "MINHA LOJA": "MI TIENDA",
      "Estoque interno — envio futuro": "Stock interno — envío futuro",
      "Endereço do destino": "Dirección de destino",
      "Nome do Local / Responsável": "Nombre del local / responsable",
      "CEP": "CP",
      "Endereço": "Dirección",
      "Número": "Número",
      "Complemento": "Complemento",
      "Bairro": "Barrio",
      "Cidade": "Ciudad",
      "Digite o CEP (8 dígitos) para preencher via ViaCEP.": "Ingrese el CP (8 dígitos) para completar vía ViaCEP.",
      "Envio futuro": "Envío futuro",
      "Transporte para envio futuro": "Transporte para envío futuro",
      "Selecione…": "Seleccione…",
      "Correios": "Correos",
      "Transportadora": "Transportista",
      "Veículo Próprio": "Vehículo propio",
      "Cancelar": "Cancelar",
      "💾 Salvar Entrega": "💾 Guardar entrega",
      "Salvar no Catálogo Interno": "Guardar en Catálogo Interno",
      "Informe o nome e o número da licitação. Depois você reabre pelo Catálogo → Editar.": "Ingrese el nombre y el número de la licitación. Luego reabra desde Catálogo → Editar.",
      "Número da Licitação / Pregão": "Número de licitación / subasta",
      "A IA identificou os documentos abaixo no edital. Confira e marque o que você já tem.": "La IA identificó los documentos abajo en el edicto. Revise y marque lo que ya tiene.",
      "Fechar": "Cerrar",
      "Ver o que tenho / Marcar OK": "Ver lo que tengo / Marcar OK",
      "Deseja marcar este edital em <b>Leilão que Participo</b> para acompanhar a disputa?": "¿Desea marcar este edicto en <b>Subastas en las que participo</b> para seguir la disputa?",
      "NÃO": "NO",
      "SIM": "SÍ",
      "Adicionar documento": "Agregar documento",
      "Informe os dados do documento. Arquivo (PDF/imagem) ou link externo.": "Ingrese los datos del documento. Archivo (PDF/imagen) o enlace externo.",
      "Nome do documento": "Nombre del documento",
      "Tipo / categoria": "Tipo / categoría",
      "Habilitação": "Habilitación",
      "Certidão": "Certificado",
      "Contrato / Ato societário": "Contrato / acto societario",
      "Técnica": "Técnica",
      "Outro": "Otro",
      "Validade (opcional)": "Validez (opcional)",
      "Link (opcional)": "Enlace (opcional)",
      "Arquivo PDF ou imagem (opcional, máx. 1,5 MB)": "Archivo PDF o imagen (opcional, máx. 1,5 MB)",
      "Observações": "Observaciones",
      "💾 Salvar documento": "💾 Guardar documento",
      "Digite e escolha na lista (ex.: Ibaiti)": "Escriba y elija en la lista (ej.: Ibaiti)",
      "ex.: material elétrico, ferramenta": "ej.: material eléctrico, herramienta",
      "ex.: leilao veiculo, sucata, cesta basica": "ej.: subasta vehiculo, chatarra, canasta basica",
      "ex.: parafuso, tinta, cabo": "ej.: tornillo, pintura, cable",
      "ex.: Furadeira de impacto 650W com maleta e brocas": "ej.: Taladro de impacto 650W con maletín y brocas",
      "Do perfil da empresa ou digite aqui": "Del perfil de la empresa o escriba aquí",
      "Filtrar por nome, código ou marca…": "Filtrar por nombre, código o marca…",
      "ex.: Pref. Ibaiti, 2026/001…": "ej.: Pref. Ibaiti, 2026/001…",
      "ex.: Abraçadeira Borboleta 12–20mm (kit 10)": "ej.: Abrazadera mariposa 12–20mm (kit 10)",
      "ex.: ABR-BOR-1220": "ej.: ABR-BOR-1220",
      "ex.: Vonder": "ej.: Vonder",
      "ex.: Prefeitura de Ibaiti": "ej.: Pref. de Ibaiti",
      "ex.: PE 013/2026 — ARP 05/2026": "ej.: PE 013/2026 — ARP 05/2026",
      "Descrição do item homologado": "Descripción del ítem homologado",
      "Digite ou cole o lance do portal": "Escriba o pegue la oferta del portal",
      "Para % de desconto": "Para % de descuento",
      "Razão social / nome fantasia": "Razón social / nombre comercial",
      "Rua, número, bairro, cidade/UF": "Calle, número, barrio, ciudad/UF",
      "ex.: PREFEITURA IBAITI": "ej.: PREFECTURA IBAITI",
      "ex.: 2026NE001234": "ej.: 2026NE001234",
      "Detalhes da NF, pendências, contato…": "Detalles de la factura, pendientes, contacto…",
      "ex.: Ferragens XYZ — abraçadeiras e furadeiras": "ej.: Ferretería XYZ — abrazaderas y taladros",
      "ex.: Almoxarifado Pref. Ibaiti — João": "ej.: Almacén Pref. Ibaiti — Juan",
      "Rua / Avenida (ViaCEP)": "Calle / Avenida (ViaCEP)",
      "Sala, bloco, referência…": "Sala, bloque, referencia…",
      "ex.: Pref. Ibaiti — Material de construção": "ej.: Pref. Ibaiti — Material de construcción",
      "ex.: PE 013/2026": "ej.: PE 013/2026",
      "ex.: CND Federal": "ej.: CND Federal",
      "ex.: renovar no site da Receita": "ej.: renovar en el sitio de la autoridad tributaria",
      "Ex.: Santa Cruz do Rio Pardo  ou  Quais licitações terão em Ibaiti": "Ej.: Santa Cruz do Rio Pardo  o  Qué licitaciones habrá en Ibaiti",
      "seu@email.com": "su@email.com",
      "Expandir painel": "Expandir panel",
      "Abrir menu": "Abrir menú",
      "Fechar menu": "Cerrar menú",
      "Menu principal": "Menú principal",
      "Alertas de editais": "Alertas de edictos",
      "Sair": "Salir",
      "Voltar à lista": "Volver a la lista",
      "Ferramentas do edital": "Herramientas del edicto",
      "Idioma": "Idioma",
      "Salvar cidade/pergunta como alerta automático": "Guardar ciudad/pregunta como alerta automática",
      "Monitorar municípios vizinhos no raio e avisar no sino": "Monitorear municipios vecinos en el radio y avisar en la campana",
      "Salvar palavras-chave + UF como alerta automático": "Guardar palabras clave + UF como alerta automática",
      "Enviar PDF do edital": "Enviar PDF del edicto",
      "Lote ou Item do edital": "Lote o ítem del edicto",
      "Quantidade": "Cantidad",
      "Quantidade em estoque / posso entregar": "Cantidad en stock / puedo entregar",
      "Recarregar exemplos de demonstração": "Recargar ejemplos de demostración",
      "Resumo financeiro das entregas": "Resumen financiero de las entregas",
      "Pesquisar no catálogo": "Buscar en el catálogo",
      "Não lança abaixo deste valor": "No oferta por debajo de este valor",
      "Tipo de margem": "Tipo de margen",
      "Sincronização na nuvem": "Sincronización en la nube",
      "Atalhos Norte Pioneiro": "Atajos Norte Pioneiro",
      "Atalhos de raio": "Atajos de radio",
      "Horizonte de encerramento da proposta no PNCP": "Horizonte de cierre de la propuesta en PNCP",
      "Pesquisas de Editais": "Búsqueda de Edictos",
      "Leilão que Participo": "Subastas en las que participo",
      "Entrega": "Entrega",
      "Pergunte ao Chat": "Pregunte al Chat",
      "Prévia do logo": "Vista previa del logo",
      "Nome": "Nombre",
      "Telefone": "Teléfono",
      "CEP (frete / cruzamento)": "CP (flete / cruce)",
      "Logo (PNG/JPG)": "Logo (PNG/JPG)",
      "Nome do Produto / Descrição": "Nombre del producto / Descripción",
      "Código / SKU": "Código / SKU",
      "Preço de Referência (R$)": "Precio de referencia (R$)",
      "Marca / Fabricante": "Marca / Fabricante"
    }
  };

  var AUTO_SEL = [
    "h2", "h3", "h4",
    "label.fld",
    ".desc",
    "button.btn", ".btn",
    "th",
    ".cat-form-title",
    ".disputa-sec-title",
    ".dc-label", ".dc-sub",
    ".lw-tab", ".lw-context-label",
    ".card-collapse-btn",
    ".auth-lead",
    "#authTitle", "#authSubmit",
    ".pill-group label span",
    ".chat-opt", ".prox-opt",
    ".robo-status-text b", ".robo-status-text span",
    ".tag",
    "option",
    ".hk-label", ".hk-sub",
    ".oc-label",
    ".lw-hub-card b", ".lw-hub-card > span:not(.lw-hub-ico)",
    ".ia-drop b", ".ia-drop > span",
    ".dropzone b", ".dropzone .small",
    "td.muted",
    ".muted.small",
    ".badge-edit-mode",
    ".chat-prompt-label", ".prox-raio-label",
    ".chat-prompt-chip",
    "label.cofre-check-all",
    ".toggle-row > label",
    "#progressLabel",
    "#iaReportSheet.ia-empty",
    ".rc-title", ".rc-sub",
    ".ub-txt b", ".ub-txt > span",
    ".status-nf",
    ".oc-head p",
    ".orc-save-card > p",
    ".docs-modal-card > p",
    ".foot-edital-label", ".foot-meus-label",
    ".brand .txt > span",
    ".auth-brand span",
    "label.small",
    ".lh-empty",
    "#entregaCepHint",
    "#proxOrigemHint",
    "#dashPncpList",
    ".orc-title-edital", ".orc-title-meus"
  ].join(",");

  var ROOT_SEL = "#app, #authGate, #entregaOverlay, #orcSaveOverlay, #docsOverlay, #participarOverlay, #cofreOverlay";

  function normalizeLang(code) {
    code = String(code || "").trim();
    if (SUPPORTED.indexOf(code) !== -1) return code;
    if (/^pt/i.test(code)) return "pt-BR";
    if (/^en/i.test(code)) return "en";
    if (/^es/i.test(code)) return "es";
    return "pt-BR";
  }

  function loadLang() {
    try {
      var saved = localStorage.getItem(LANG_KEY);
      if (saved) return normalizeLang(saved);
    } catch (e) {}
    try {
      if (navigator.language) return normalizeLang(navigator.language);
    } catch (e2) {}
    return "pt-BR";
  }

  var current = loadLang();

  function t(key, fallback) {
    var pack = DICT[current] || DICT["pt-BR"];
    var val = pack[key];
    if (val == null && current !== "pt-BR") val = DICT["pt-BR"][key];
    if (val == null) val = fallback != null ? fallback : key;
    return val;
  }

  function normKey(s) {
    return String(s || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\u200b-\u200d\ufeff]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stripDecor(s) {
    // Remove emojis / símbolos no início para fallback de busca
    return normKey(String(s || "").replace(/^[^A-Za-zÀ-ÿ0-9]+/g, ""));
  }

  function phraseLookup(lang, src) {
    if (!src) return null;
    var pack = PHRASES[lang];
    if (!pack) return null;
    var k = normKey(src);
    if (pack[k] != null) return pack[k];
    if (pack[src] != null) return pack[src];
    var bare = stripDecor(k);
    if (bare && pack[bare] != null) return pack[bare];
    // Procura chave cuja parte textual (sem decoração) coincida
    if (bare) {
      for (var key in pack) {
        if (!Object.prototype.hasOwnProperty.call(pack, key)) continue;
        if (stripDecor(key) === bare) return pack[key];
      }
    }
    return null;
  }

  function isSkippable(el) {
    if (!el || el.nodeType !== 1) return true;
    var tag = el.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return true;
    if (el.hasAttribute("data-i18n")) return true;
    // Never overwrite parents that wrap data-i18n children (e.g. h2 + span[data-i18n])
    if (el.querySelector && el.querySelector("[data-i18n]")) return true;
    if (el.closest) {
      var anc = el.closest("[data-i18n]");
      if (anc && anc !== el) return true;
    }
    return false;
  }

  function hasInteractiveNest(el) {
    return !!(el.querySelector && el.querySelector("input, select, textarea, table, button, a[href]"));
  }

  function isForceTranslateTag(el) {
    if (!el) return false;
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "th" || tag === "option") {
      return true;
    }
    if (tag === "label" && el.classList && el.classList.contains("fld")) return true;
    if (el.classList && el.classList.contains("desc")) return true;
    if (el.classList && el.classList.contains("cat-form-title")) return true;
    if (el.classList && el.classList.contains("disputa-sec-title")) return true;
    if (el.classList && (el.classList.contains("dc-label") || el.classList.contains("dc-sub"))) return true;
    if (tag === "button" || (el.classList && el.classList.contains("btn"))) return true;
    return false;
  }

  function isMostlyLeaf(el) {
    if (!el) return false;
    if (isForceTranslateTag(el)) {
      // botões/labels com input interno ainda podem ser traduzidos
      if ((el.tagName || "").toLowerCase() === "label" && el.querySelector("input")) return true;
      if (!hasInteractiveNest(el)) return true;
      if ((el.tagName || "").toLowerCase() === "button" || (el.classList && el.classList.contains("btn"))) {
        return true;
      }
    }
    var tag = (el.tagName || "").toLowerCase();
    if (
      tag === "label" &&
      (el.classList.contains("chat-opt") ||
        el.classList.contains("prox-opt") ||
        el.classList.contains("status-nf") ||
        el.classList.contains("cofre-check-all") ||
        el.classList.contains("radio-card") ||
        el.classList.contains("small"))
    ) {
      return true;
    }
    if (tag === "option") return true;
    if (!hasInteractiveNest(el)) return true;
    if (tag === "button" || el.classList.contains("btn")) {
      var kids = el.children;
      for (var i = 0; i < kids.length; i++) {
        var c = kids[i];
        var ct = (c.tagName || "").toLowerCase();
        if (ct === "script" || ct === "style") continue;
        if (c.classList && c.classList.contains("ico")) continue;
        if (ct === "span" && !c.querySelector("input,select,textarea,button")) continue;
        if (ct === "b" || ct === "strong" || ct === "i" || ct === "em" || ct === "br") continue;
        return false;
      }
      return true;
    }
    return false;
  }

  function applyLabelText(el, text) {
    var keep = [];
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 1) keep.push(n);
    }
    while (el.firstChild) el.removeChild(el.firstChild);
    for (var j = 0; j < keep.length; j++) el.appendChild(keep[j]);
    el.appendChild(document.createTextNode(" " + String(text).replace(/^\s+/, "")));
  }

  function setTextPreservingIco(el, text) {
    var ico = null;
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 1 && n.classList && n.classList.contains("ico")) {
        ico = n;
        break;
      }
    }
    if (!ico) {
      if ((el.tagName || "").toLowerCase() === "label" && el.querySelector("input")) {
        applyLabelText(el, text);
        return;
      }
      el.textContent = text;
      return;
    }
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(ico);
    el.appendChild(document.createTextNode(" " + String(text).replace(/^\s+/, "")));
  }

  function getLabelSourceText(el) {
    var clone = el.cloneNode(true);
    var remove = clone.querySelectorAll(
      "input, select, textarea, .ico, .rc-ico, .ub-ico, .sb-ico, .nav-chevron, .burger"
    );
    for (var i = 0; i < remove.length; i++) {
      if (remove[i].parentNode) remove[i].parentNode.removeChild(remove[i]);
    }
    return normKey(clone.textContent);
  }

  function usesHtml(el) {
    if (!el) return false;
    var html = el.innerHTML || "";
    if (!/<(b|strong|i|em|br)\b/i.test(html)) return false;
    if (el.classList && el.classList.contains("desc")) return true;
    var tag = (el.tagName || "").toLowerCase();
    return tag === "div" || tag === "p" || tag === "li";
  }

  function applyPhrases(root) {
    var scopes = [];
    if (root && root.querySelectorAll) {
      if (root === document || root === document.documentElement || root === document.body) {
        var nodes = document.querySelectorAll(ROOT_SEL);
        for (var r = 0; r < nodes.length; r++) scopes.push(nodes[r]);
      } else if (root.matches && root.matches(ROOT_SEL.replace(/,\s*/g, ", "))) {
        scopes.push(root);
      } else {
        scopes.push(root);
      }
    } else {
      var all = document.querySelectorAll(ROOT_SEL);
      for (var a = 0; a < all.length; a++) scopes.push(all[a]);
    }

    var lang = current;
    var isPt = lang === "pt-BR";

    for (var s = 0; s < scopes.length; s++) {
      var scope = scopes[s];
      if (!scope || !scope.querySelectorAll) continue;
      var els = scope.querySelectorAll(AUTO_SEL);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (isSkippable(el)) continue;
        if (!isMostlyLeaf(el)) continue;

        if (usesHtml(el)) {
          if (!el.hasAttribute("data-ls-pt-html")) {
            el.setAttribute("data-ls-pt-html", normKey(el.innerHTML));
          }
          var srcH = el.getAttribute("data-ls-pt-html");
          if (isPt) {
            if (normKey(el.innerHTML) !== srcH) el.innerHTML = srcH;
          } else {
            var trH = phraseLookup(lang, srcH);
            if (trH != null) el.innerHTML = trH;
          }
          continue;
        }

        var tag = (el.tagName || "").toLowerCase();
        var src;
        if (tag === "label" && el.querySelector("input")) {
          if (!el.hasAttribute("data-ls-pt")) {
            el.setAttribute("data-ls-pt", getLabelSourceText(el));
          }
          src = el.getAttribute("data-ls-pt");
          if (isPt) applyLabelText(el, src);
          else {
            var trL = phraseLookup(lang, src);
            if (trL != null) applyLabelText(el, trL);
          }
          continue;
        }

        if (!el.hasAttribute("data-ls-pt")) {
          el.setAttribute("data-ls-pt", normKey(el.textContent));
        }
        src = el.getAttribute("data-ls-pt");
        if (!src) continue;

        if (isPt) {
          if (el.querySelector && el.querySelector(".ico")) setTextPreservingIco(el, src);
          else if (normKey(el.textContent) !== src) {
            if (el.children && el.children.length === 1 && (el.children[0].tagName || "").toLowerCase() === "span") {
              el.children[0].textContent = src;
            } else {
              el.textContent = src;
            }
          }
        } else {
          var tr = phraseLookup(lang, src);
          if (tr != null) {
            if (el.querySelector && el.querySelector(".ico")) setTextPreservingIco(el, tr);
            else if (el.children && el.children.length === 1 && (el.children[0].tagName || "").toLowerCase() === "span") {
              el.children[0].textContent = tr;
            } else {
              el.textContent = tr;
            }
          }
        }
      }

      var withPh = scope.querySelectorAll("[placeholder]");
      for (var p = 0; p < withPh.length; p++) {
        var inp = withPh[p];
        if (inp.hasAttribute("data-i18n-placeholder")) continue;
        var ph = inp.getAttribute("placeholder");
        if (!ph) continue;
        if (!inp.hasAttribute("data-ls-pt-placeholder")) {
          inp.setAttribute("data-ls-pt-placeholder", ph);
        }
        var srcPh = inp.getAttribute("data-ls-pt-placeholder");
        if (isPt) inp.setAttribute("placeholder", srcPh);
        else {
          var trPh = phraseLookup(lang, srcPh);
          if (trPh != null) inp.setAttribute("placeholder", trPh);
        }
      }

      var withTitle = scope.querySelectorAll("[title]");
      for (var ti = 0; ti < withTitle.length; ti++) {
        var tel = withTitle[ti];
        if (tel.hasAttribute("data-i18n-title")) continue;
        var tv = tel.getAttribute("title");
        if (!tv || !tv.trim()) continue;
        if (!tel.hasAttribute("data-ls-pt-title")) {
          tel.setAttribute("data-ls-pt-title", tv);
        }
        var srcT = tel.getAttribute("data-ls-pt-title");
        if (isPt) tel.setAttribute("title", srcT);
        else {
          var trT = phraseLookup(lang, srcT);
          if (trT != null) tel.setAttribute("title", trT);
        }
      }

      var withAria = scope.querySelectorAll("[aria-label]");
      for (var ar = 0; ar < withAria.length; ar++) {
        var ael = withAria[ar];
        if (ael.hasAttribute("data-i18n-aria")) continue;
        var av = ael.getAttribute("aria-label");
        if (!av || !av.trim()) continue;
        if (!ael.hasAttribute("data-ls-pt-aria")) {
          ael.setAttribute("data-ls-pt-aria", av);
        }
        var srcA = ael.getAttribute("data-ls-pt-aria");
        if (isPt) ael.setAttribute("aria-label", srcA);
        else {
          var trA = phraseLookup(lang, srcA);
          if (trA != null) ael.setAttribute("aria-label", trA);
        }
      }
    }
  }

  function apply(root) {
    root = root || document;
    var nodes = root.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute("data-i18n");
      if (!key) continue;
      var mode = el.getAttribute("data-i18n-mode") || "text";
      if (mode === "html") el.innerHTML = t(key, el.innerHTML);
      else el.textContent = t(key, el.textContent);
    }
    var ph = root.querySelectorAll("[data-i18n-placeholder]");
    for (var j = 0; j < ph.length; j++) {
      var p = ph[j];
      p.setAttribute(
        "placeholder",
        t(p.getAttribute("data-i18n-placeholder"), p.getAttribute("placeholder") || "")
      );
    }
    var titles = root.querySelectorAll("[data-i18n-title]");
    for (var k = 0; k < titles.length; k++) {
      var ti = titles[k];
      ti.setAttribute("title", t(ti.getAttribute("data-i18n-title"), ti.getAttribute("title") || ""));
    }
    var aria = root.querySelectorAll("[data-i18n-aria]");
    for (var a = 0; a < aria.length; a++) {
      var ar = aria[a];
      ar.setAttribute(
        "aria-label",
        t(ar.getAttribute("data-i18n-aria"), ar.getAttribute("aria-label") || "")
      );
    }

    applyPhrases(root);

    try {
      document.documentElement.setAttribute("lang", current === "pt-BR" ? "pt-BR" : current);
    } catch (e) {}
    var selTop = document.getElementById("langSelect");
    if (selTop && selTop.value !== current) selTop.value = current;
    var selCfg = document.getElementById("langSelectCfg");
    if (selCfg && selCfg.value !== current) selCfg.value = current;
  }

  function viewTitles() {
    return {
      dashboard: t("view.dashboard"),
      pesquisas: t("view.pesquisas"),
      perguntarEditais: t("view.perguntarEditais"),
      editaisProximos: t("view.editaisProximos"),
      radarPncp: t("view.radarPncp"),
      captacao: t("view.pesquisas"),
      analiseIa: t("view.analiseIa"),
      leiloesParticipo: t("view.leiloesParticipo"),
      leilaoWorkspace: t("view.leilaoWorkspace"),
      importarEdital: t("view.importarEdital"),
      orcamento: t("view.orcamento"),
      cruzamento: t("view.cruzamento"),
      cofre: t("view.cofre"),
      docsChecklist: t("view.docsChecklist"),
      entregas: t("view.entregas"),
      histEntregas: t("view.histEntregas"),
      concorrencia: t("view.concorrencia"),
      catalogo: t("view.catalogo"),
      arp: t("view.arp"),
      disputa: t("view.disputa"),
      ferramentas: t("view.ferramentas"),
      chat: t("view.chat"),
      suporte: t("nav.suporte"),
      "chat-ia": t("nav.chatIa")
    };
  }

  function setLang(code, opts) {
    opts = opts || {};
    current = normalizeLang(code);
    try {
      localStorage.setItem(LANG_KEY, current);
    } catch (e) {}
    apply(document);
    try {
      if (window.LICSYSTEM) {
        LICSYSTEM.VIEW_TITLES = viewTitles();
      }
    } catch (e2) {}
    try {
      var titleEl = document.getElementById("topTitle");
      var map = viewTitles();
      var cv = (window.LICSYSTEM && LICSYSTEM.state && LICSYSTEM.state.currentView) || "dashboard";
      if (titleEl) titleEl.textContent = map[cv] || "LICSYSTEM";
    } catch (e3) {}
    if (!opts.silent) {
      try {
        document.dispatchEvent(new CustomEvent("licsystem:langchange", { detail: { lang: current } }));
      } catch (e4) {}
    }
    return current;
  }

  function wireSelects() {
    function onChange(ev) {
      var v = ev.target && ev.target.value;
      if (v) setLang(v);
    }
    var a = document.getElementById("langSelect");
    var b = document.getElementById("langSelectCfg");
    if (a && !a._i18nBound) {
      a._i18nBound = true;
      a.addEventListener("change", onChange);
    }
    if (b && !b._i18nBound) {
      b._i18nBound = true;
      b.addEventListener("change", onChange);
    }
  }

  function init() {
    wireSelects();
    setLang(current, { silent: true });
  }

  window.LICSYSTEM = window.LICSYSTEM || {};
  LICSYSTEM.i18n = {
    t: t,
    apply: apply,
    setLang: setLang,
    getLang: function () {
      return current;
    },
    viewTitles: viewTitles,
    supported: SUPPORTED.slice(),
    init: init,
    wire: wireSelects
  };
  window.__lsT = t;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
