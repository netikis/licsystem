/**
 * Dataset IBGE (municípios) — carregado só via require() para o
 * @vercel/nft incluir o JSON no bundle do lambda. Não use fs.
 */
module.exports = require("../data/municipios.json");
