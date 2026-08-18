# Suporte LICSYSTEM → editais PNCP

## O que o chat faz agora (no app)

O item de menu **Ferramentas → Suporte LICSYSTEM** (`src/voiceflow.js`) abre um painel **no LICSYSTEM** (sem balão flutuante). **Chat IA** no mesmo grupo abre o Voiceflow.

- Perguntas sobre **licitações / editais / município / Norte Pioneiro** → o app chama `POST /api/editais-chat` e responde com dados reais do PNCP (`respostaTexto`).
- Outros assuntos → pode abrir o widget Voiceflow (“Assistente geral”).

Não depende de Custom Action no Voiceflow cloud para listar editais.

### Como perguntar

Exemplos:

- `Quais licitações terão em Ibaiti`
- `Licitações no Norte Pioneiro`
- `Editais em Jacarezinho com cestas`
- Atalhos no painel: Ibaiti, Norte Pioneiro, Norte · cestas, Jacarezinho

Se não houver proposta aberta: a resposta diz honestamente que **não há proposta aberta no PNCP neste momento** (não “não consigo puxar”).

Também funciona em **Captação → Perguntar editais** (mesma API).

---

## Endpoint (API)

```
https://licsystem.vercel.app/api/editais-chat
```

- Métodos: `GET` ou `POST`
- CORS: liberado (`*`)
- Fonte: PNCP oficial (propostas em aberto)
- Dados de municípios / Norte Pioneiro: módulos `require()` em `api/_lib/` (helpers; não contam como Serverless Function)

### Exemplos

**Norte Pioneiro:**

```
GET https://licsystem.vercel.app/api/editais-chat?regiao=norte-pioneiro
```

**Município:**

```
GET https://licsystem.vercel.app/api/editais-chat?municipio=Ibaiti
```

**Texto livre:**

```
POST https://licsystem.vercel.app/api/editais-chat
Content-Type: application/json

{
  "mensagem": "Quais licitações terão em Jacarezinho"
}
```

### Resposta útil

| Campo | Uso |
|--------|-----|
| `respostaTexto` | Mensagem pronta em português |
| `editais[]` | Lista (objeto, valor, data, link, município…) |

---

## Opcional: Custom Action no Voiceflow

Se quiser que o agente Voiceflow (cloud) também consulte o PNCP:

1. No canvas **Suporte LICSYSTEM**, após capturar a pergunta, bloco **API** / **Custom Action**.
2. Method: `POST`, URL: `https://licsystem.vercel.app/api/editais-chat`
3. Body: `{ "mensagem": "{last_utterance}" }`
4. Exiba `{respostaTexto}` no Speak/Text.
5. Publique o agente.

Isso é **opcional** — o painel do app já consulta a API sozinho.

## Chat de editais (produção)

```
POST https://licsystem.vercel.app/api/editais-chat
{ "mensagem": "Quais licitações terão em Ibaiti" }
```

Endpoint único (Hobby Vercel). Parser local de mensagem; não use mais `/api/chat-editais` (removido).
