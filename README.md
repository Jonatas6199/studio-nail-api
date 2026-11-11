# Ateliê — Nail Studio

Gestão de agenda para uma nail designer, com Next.js, React, TypeScript e Supabase.

**Etapa 2:** login real por e-mail e senha, sessão protegida e persistência no Supabase. A integração com Google Agenda e a publicação pertencem à etapa 3 e dependem de autorização.

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

Há 11 testes de validação, isolamento, confirmação de conflitos, transações, valores e controle de revisão, executados em PostgreSQL isolado com PGlite. No Supabase real, foram verificadas as oito tabelas protegidas, a negação de acesso anônimo, o isolamento de contas e uma gravação revertida. O login real foi realizado pela usuária, e o salvamento autenticado pela interface foi conferido após recarregar a página.

O fluxo de envio de e-mail de recuperação está implementado, mas o recebimento real da mensagem depende das URLs permitidas e do serviço de e-mail configurado no Supabase. Nenhum e-mail de teste foi enviado automaticamente.

## Demonstração da etapa 1

Somente em desenvolvimento, `http://127.0.0.1:3335/demo` abre a interface com dados fictícios locais, separada da conta real. A rota não está disponível em produção. O reset da demonstração altera apenas os dados desse modo.

## Próxima etapa

Google Agenda nos dois sentidos, revisão de alterações e exclusões externas, preparação da publicação e conferência do custo de operação. Nenhum serviço de hospedagem foi criado ou publicado nesta etapa.
