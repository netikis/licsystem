# Voiceflow → LICSYSTEM editais chat

O widget **Suporte LICSYSTEM** (`src/voiceflow.js`) só embute o projeto Voiceflow. Ele **não** consulta o PNCP sozinho. Para listar editais abertos, conecte um **Custom Action / API step** no fluxo Voiceflow ao endpoint abaixo.

## Endpoint

```
https://licsystem.vercel.app/api/editais-chat
```

- Métodos: `GET` ou `POST`
- CORS: liberado (`*`)
- Fonte: PNCP oficial (propostas em aberto)

## Exemplos

**Norte Pioneiro (26 municípios AMUNORPI):**

```
GET https://licsystem.vercel.app/api/editais-chat?regiao=norte-pioneiro
```

**Município:**

```
GET https://licsystem.vercel.app/api/editais-chat?municipio=Ibaiti
```

**Texto livre (parser local em PT):**

```
POST https://licsystem.vercel.app/api/editais-chat
Content-Type: application/json

{
  "mensagem": "Quais licitações terão em Jacarezinho"
}
```

**Categorias** (`reforma`, `comida`, `cestas`, `cafe`, `natal`, `eletro`):

```
GET .../api/editais-chat?regiao=norte-pioneiro&categoria=cestas,comida,natal
```

## Resposta (campos úteis no VF)

| Campo | Uso no chat |
|--------|-------------|
| `respostaTexto` | Mensagem pronta em português |
| `editais[]` | Lista estruturada |
| `editais[].valorEstimado` | Valor estimado |
| `editais[].dataAbertura` | Data de abertura |
| `editais[].link` | Link do edital no PNCP |
| `editais[].municipio` / `orgao` / `objeto` / `modalidade` | Detalhes |

## Passo a passo no Voiceflow

1. No canvas do projeto **Suporte LICSYSTEM**, após capturar a pergunta do usuário, adicione um bloco **API** / **Custom Action**.
2. Method: `POST`, URL: `https://licsystem.vercel.app/api/editais-chat`
3. Body JSON: `{ "mensagem": "{last_utterance}" }` (ou a variável do VF que guarda o texto).
4. Mapeie a resposta: exiba `{respostaTexto}` no Speak/Text; opcionalmente itere `editais` se o plano VF permitir.
5. Publique o agente Voiceflow (o embed do LICSYSTEM já usa o `projectID` em `src/voiceflow.js`).

## Alternativa sem editar o Voiceflow

No app, aba **Captação** → card **Perguntar editais**: atalhos e pergunta livre já chamam a mesma API.

## Metadados

```
GET https://licsystem.vercel.app/api/editais-chat?meta=1
```

## NL com Gemini (opcional)

```
POST https://licsystem.vercel.app/api/chat-editais
{ "mensagem": "..." }
```

Usa `GEMINI_API_KEY` na Vercel se existir; senão cai no parser local.
