# Ateliê — Nail Studio

Gestão de agenda para uma nail designer, com Next.js, React, TypeScript e Supabase.

Login real por e-mail e senha, sessão protegida, persistência no Supabase e publicação no Railway.

Aplicação publicada: https://studio-nail-api-production.up.railway.app

A integração com o Google Agenda foi adiada a pedido da usuária e permanece inativa. As credenciais cadastradas no Railway não iniciam nenhuma sincronização sozinhas.

## Executar

Requer Node.js 22 LTS ou superior.

```sh
npm install
# Configure .env.local usando .env.example como referência.
npm run dev
```

Abra http://127.0.0.1:3335. Sem sessão, a aplicação abre o login. Somente a conta vinculada a `nail_accounts` tem acesso aos dados. Não há cadastro público no aplicativo.

A senha é definida pela própria profissional no Supabase; não fica em código nem em arquivos do projeto. `.env.local` é ignorado pelo Git e contém a configuração local. O aplicativo usa a chave Publishable/anon para autenticação e acesso com a sessão da usuária. A senha administrativa do banco é usada somente pelos scripts de preparação, não pelas rotas do aplicativo.

## Funcionalidades

- Agenda diária e semanal, navegação entre datas e filtro por situação.
- Agendamentos com vários procedimentos e preço/duração personalizados.
- Confirmação de sobreposição e preservação do histórico de preços.
- Clientes com ficha, observações e histórico.
- Procedimentos com preço, duração e arquivamento.
- Disponibilidade por semana, vários dias de uma vez, ajuste por dia e cópia da semana anterior.
- Sinais e pagamentos manuais, saldo pendente e despesas por categoria.
- Relatório de caixa por período; cada recebimento é contado uma vez.
- Exportação real `.xlsx`, com seis abas e todos os dados da conta.
- Login, saída da conta e fluxos de recuperação/redefinição de senha.

Na conta real, os dados não são guardados em `localStorage`. Ela começa vazia, sem importar os exemplos da etapa 1. Os cadastros só aparecem como salvos depois da confirmação do Supabase. Em caso de alteração concorrente, o formulário é fechado e os dados atuais são carregados para evitar uma sobrescrita silenciosa. Formulários abertos não recebem atualizações automáticas por cima do rascunho.

Valores financeiros usam centavos inteiros; datas e horários da agenda seguem Brasília.

## Preparar outro ambiente

As instruções completas estão em [docs/SUPABASE.md](docs/SUPABASE.md).

```sh
npm run db:inspect
npm run db:migrate
npm run db:provision
npm run db:verify
```

Os scripts verificam o certificado do Supabase. A migração cria somente tabelas com prefixo `nail_` e um histórico privado de migrações. As tabelas da aplicação anterior permanecem separadas. O script de verificação faz uma gravação temporária e a reverte com `ROLLBACK`.

## Segurança e gravações

O acesso é conferido no servidor e no banco. As oito tabelas novas têm RLS. As tabelas do aplicativo não aceitam gravações diretas de clientes autenticados; as funções de banco autorizam a conta e executam transações completas.

Cada alteração usa uma revisão esperada e um identificador de operação. O banco bloqueia alterações concorrentes, sobrepagamentos, referências entre contas e repetições de uma mesma operação. O histórico dos procedimentos é copiado pelo banco, e não confiado ao navegador.

As sessões usam cookies `HttpOnly`, com `SameSite=Lax` e `Secure` em produção. Respostas privadas não são armazenadas em cache. A chave `service_role` não é necessária e é rejeitada na configuração do aplicativo.

## Verificar

```sh
npm test
npm run typecheck
npm run build
node scripts/check-public-access.mjs
```

Há 24 testes de validação, isolamento, confirmação de conflitos, transações, valores e controle de revisão, executados em PostgreSQL isolado com PGlite. No Supabase real, foram verificadas as onze tabelas protegidas, a negação de acesso anônimo, o isolamento de contas e uma gravação revertida. O login real foi realizado pela usuária, e o salvamento autenticado pela interface foi conferido após recarregar a página.

O fluxo de envio de e-mail de recuperação está implementado, mas o recebimento real da mensagem depende das URLs permitidas e do serviço de e-mail configurado no Supabase. Nenhum e-mail de teste foi enviado automaticamente.

## Demonstração da etapa 1

Somente em desenvolvimento, `http://127.0.0.1:3335/demo` abre a interface com dados fictícios locais, separada da conta real. A rota não está disponível em produção. O reset da demonstração altera apenas os dados desse modo.

## Publicação e próximos passos

O repositório `Jonatas6199/studio-nail-api` publica somente este projeto no serviço novo `studio-nail-api` do Railway. A API anterior permanece no projeto separado. A aplicação usa uma imagem standalone e não precisa da conexão administrativa do PostgreSQL em produção.

Ver [docs/RAILWAY.md](docs/RAILWAY.md) para configuração, verificações e cuidados com o orçamento compartilhado.

Para uma próxima etapa, após nova autorização: Google Agenda nos dois sentidos, revisão de alterações e exclusões externas e validação completa da integração. O recebimento real dos e-mails de recuperação continua dependendo da configuração de envio do Supabase.

## WhatsApp e lembretes

Confirmações e lembretes com prévia editável e abertura manual do WhatsApp, endereço do ateliê, sinal e saldo. Pendências na agenda a partir das 09h, dois dias antes, com marcação manual de envio. Notificações opcionais no iPhone após instalar na Tela de Início e permitir os avisos. Consulte [docs/WHATSAPP.md](docs/WHATSAPP.md) para uso, operação e limites. Não usa API paga de mensagens.

## Cancelamento, correções e histórico importado

O botão Cancelar agendamento pede confirmação e preserva os recebimentos. O lápis em Recebimentos corrige o sinal ou outro pagamento sem duplicar entradas. Histórico sem preço ou horário usa indicações explícitas, com procedimentos editáveis e avisos de sobreposição. Consulte [docs/IMPORTACAO.md](docs/IMPORTACAO.md) para as regras e a operação da importação.
