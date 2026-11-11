# Publicação no Railway

URL: https://studio-nail-api-production.up.railway.app

- Repositório novo: `Jonatas6199/studio-nail-api`, branch `main`.
- Projeto Railway: `vivacious-peace`.
- Serviço: `studio-nail-api`.
- Ambiente: `production`.
- Interface e API no mesmo serviço; banco e autenticação permanecem no Supabase.
- Região: US East / Virginia, próxima do banco atual no Canadá.
- Uma réplica, limitada a 0,15 vCPU e 0,25 GB de memória.
- O processo Node usa heap máximo de 128 MB; o limite de memória do serviço inclui o restante do processo.
- HTTPS e domínio gratuito do Railway, sem compra de domínio.
- Sem CDN para respostas privadas e sem observabilidade paga adicional.

## Variáveis do aplicativo

`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_OWNER_EMAIL`, `APP_URL`, `NODE_ENV=production`, `PORT=3000`, `NEXT_TELEMETRY_DISABLED=1` e `NODE_OPTIONS=--max-old-space-size=128`.

`APP_URL` deve ser a URL HTTPS exata acima. O certificado público do Supabase está incluído na imagem. A senha administrativa do banco e `.env.local` não são enviados ao repositório ou à imagem.

As variáveis `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` foram cadastradas pela usuária. Não há conexão ativa com Google nem rotas de sincronização nesta publicação. Retomar essa parte apenas quando solicitado.

## Construção e atualização

O Dockerfile instala dependências e compila em uma etapa de construção separada. A imagem final contém a saída standalone do Next.js, os arquivos estáticos e o certificado público. Ela executa como usuário sem privilégios administrativos.

O Railway acompanha a branch `main` do repositório novo. Não publicar a pasta superior da aplicação antiga, nem arquivos `.env`. `.dockerignore` e `.railwayignore` excluem configurações privadas e dependências locais.

O endpoint `/api/health` precisa retornar HTTP 200 antes da troca de versão. Sem configuração válida do aplicativo, ele retorna 503.

## Orçamento da conta inteira

O orçamento informado é de até R$ 50/mês para a conta inteira, incluindo a API antiga. O plano observado é Hobby, com US$ 5 de uso incluído. A cobrança depende do consumo, câmbio e impostos; limites de CPU/memória do serviço não são um teto de cobrança da conta.

Na conferência inicial, o painel indicava aproximadamente US$ 0,09 de consumo no ciclo. O serviço novo usava cerca de 44 MB de memória em repouso, antes do uso real; essa amostra inicial não garante o consumo futuro. Não foram contratados serviços adicionais de banco, volumes ou agentes.

Um limite rígido de consumo do workspace pode suspender todos os serviços, inclusive a API antiga. Ele só deve ser alterado após autorização explícita dessa consequência. Os limites de recursos do serviço novo não alteram a configuração da API antiga.

A usuária escolheu manter apenas os limites do aplicativo novo e suspender a API antiga por conta própria quando decidir. Não foi configurado um teto global de cobrança nem foi suspensa a API antiga. Portanto, o orçamento de R$ 50 é uma meta de operação a acompanhar, e não um bloqueio automático de faturamento.

## Verificações

- `/api/health`: 200 com configuração válida.
- `/login`: 200.
- `/api/workspace` sem sessão: 401.
- POST de origem externa: 403.
- `/demo` em produção: 404.
- Conferir login e salvamento autenticado na URL pública.
- Conferir consumo e previsão da conta no painel do Railway após o uso real.

O acesso ao aplicativo é restrito à conta já liberada no Supabase. O modo de demonstração permanece disponível apenas no desenvolvimento local.
