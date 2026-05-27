# Pipedrive Escala — Vercel

Gerencia automaticamente os membros das equipes no Pipedrive baseado em escala do Google Sheets.
Roda como **Vercel Cron Job** a cada 5 minutos.

## Estrutura

```
pipedrive-escala/
├── api/
│   └── sync.js          # Endpoint chamado pelo cron do Vercel
├── lib/
│   ├── scheduler.js     # Lógica principal da escala
│   ├── sheets.js        # Leitura do Google Sheets
│   └── pipedrive.js     # API do Pipedrive
├── vercel.json          # Config do cron
├── .env.example
└── package.json
```

## Como funciona

- Vercel chama `/api/sync` a cada 5 minutos automaticamente
- **Seg-Sex às 08:00**: Limpa a equipe e adiciona apenas quem está no turno
- **Seg-Sex (horário normal)**: Adiciona quem entrou no turno, remove quem saiu
- **Sáb-Dom**: Todos da escala entram nas suas equipes
- **Fallback**: Se ninguém estiver na escala, todos entram

> O sistema NUNCA deleta usuários do Pipedrive. Apenas adiciona/remove da equipe.

## Variáveis de ambiente (configurar no Vercel)

| Variável | Descrição |
|----------|-----------|
| `PIPEDRIVE_API_TOKEN` | Token da API do Pipedrive |
| `GOOGLE_SHEET_ID` | ID da planilha Google Sheets |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON da Service Account do Google Cloud |
| `TIMEZONE` | `America/Sao_Paulo` |
| `RESET_HOUR` | `8` (hora do reset diário) |
| `CRON_SECRET` | String secreta para proteger o endpoint |

## Deploy

1. Sobe o código no GitHub
2. Conecta o repositório no Vercel
3. Adiciona as variáveis de ambiente
4. Deploy automático!

O Vercel detecta o `vercel.json` e agenda o cron automaticamente.

## Testar manualmente

Após o deploy, acesse:
```
https://seu-projeto.vercel.app/api/sync
```

A resposta vai mostrar os logs do que foi feito nas equipes.
