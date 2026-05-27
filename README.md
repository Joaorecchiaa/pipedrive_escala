# Pipedrive Escala

Gerencia automaticamente os membros das equipes no Pipedrive baseado em uma escala do Google Sheets.

## Como funciona

- Roda a cada **5 minutos** via cron
- **Seg-Sex às 08:00**: Limpa a equipe e adiciona apenas quem está no turno inicial
- **Seg-Sex (horário normal)**: Adiciona quem entrou no turno, remove quem saiu
- **Sáb-Dom**: Todos da escala entram nas suas equipes
- **Fallback**: Se ninguém estiver na escala no horário, todos entram

> ⚠️ O sistema **NUNCA deleta** usuários do Pipedrive. Apenas adiciona e remove da equipe.

---

## Pré-requisitos

- Node.js 18+
- Conta no [Google Cloud](https://console.cloud.google.com) para criar Service Account
- Token de API do Pipedrive
- Planilha Google Sheets no formato correto

---

## Configuração do Google Sheets

### 1. Estrutura da planilha

**Aba `escala_comercial`** (colunas A até H):
| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Nome | Email | Subarea | Cargo | Entrada | Saida | equipe_distribuicao | id_equipe_distribuicao |

- **Email**: obrigatório — usado para encontrar o usuário no Pipedrive
- **Entrada/Saida**: formato `HH:MM` ou `HH:MM:SS` (ex: `08:30`, `17:00`)
- **id_equipe_distribuicao**: ID numérico da equipe no Pipedrive (obrigatório)
- Linhas sem email ou sem `id_equipe_distribuicao` são ignoradas

### 2. Pegar IDs das equipes do Pipedrive

```bash
node src/index.js --list-teams
```

Cole os IDs na coluna H da planilha.

### 3. Criar Service Account no Google Cloud

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto (ou use um existente)
3. Ative a **Google Sheets API**
4. Vá em **IAM > Service Accounts > Criar**
5. Após criar, gere uma **chave JSON**
6. Compartilhe sua planilha Google Sheets com o email da Service Account (apenas leitura)

---

## Instalação local

```bash
git clone https://github.com/seu-usuario/pipedrive-escala.git
cd pipedrive-escala

npm install

cp .env.example .env
# Edite o .env com seus valores

npm start
```

### Variáveis de ambiente (`.env`)

```env
PIPEDRIVE_API_TOKEN=seu_token_aqui
GOOGLE_SHEET_ID=id_da_planilha_aqui
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
TIMEZONE=America/Sao_Paulo
RESET_HOUR=8
```

**Como pegar o `GOOGLE_SHEET_ID`**: Na URL da planilha:
`https://docs.google.com/spreadsheets/d/`**`ESTE_E_O_ID`**`/edit`

**Como compactar o JSON da Service Account em uma linha:**
```bash
cat sua-service-account.json | tr -d '\n'
```

---

## Deploy no Render

1. Suba o projeto para o GitHub
2. Acesse [render.com](https://render.com) e crie um novo **Background Worker**
3. Conecte ao repositório GitHub
4. O `render.yaml` já está configurado — basta adicionar as variáveis de ambiente:
   - `PIPEDRIVE_API_TOKEN`
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_JSON`

---

## Logs esperados

```
========================================
[Escala] 06/05/2026, 08:00:00
[Escala] Dia semana: 3 | Fim de semana: false | Reset 08h: true
========================================

--- Equipe: DISTRIBUIÇÃO - QUENTE (id: 13) ---
[Escala] Reset 08h — removendo 8 membro(s)
[Escala] Reset 08h — adicionando 3 pessoa(s) do turno

--- Equipe: DISTRIBUIÇÃO - MORNO (id: 14) ---
[Escala] Reset 08h — removendo 5 membro(s)
[Escala] Reset 08h — adicionando 2 pessoa(s) do turno

[Escala] Sync concluido
```

---

## Estrutura do projeto

```
pipedrive-escala/
├── src/
│   ├── index.js       # Entry point + cron
│   ├── scheduler.js   # Lógica principal da escala
│   ├── sheets.js      # Leitura do Google Sheets
│   └── pipedrive.js   # Chamadas à API do Pipedrive
├── render.yaml        # Config deploy Render
├── .env.example       # Template de variáveis
├── .gitignore
└── package.json
```
