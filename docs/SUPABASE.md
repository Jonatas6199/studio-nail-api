# Configuração do Supabase

## Configuração local

Crie `.env.local` com os nomes de `.env.example`:

- `SUPABASE_URL`: URL HTTPS do projeto.
- `SUPABASE_PUBLISHABLE_KEY`: chave Publishable ou anon legada. Nunca use service_role.
- `APP_URL`: origem exata da aplicação; localmente, `http://127.0.0.1:3335`. Em produção, uma URL HTTPS é obrigatória.
- `SUPABASE_OWNER_EMAIL`: e-mail da única profissional autorizada, usado na preparação e na solicitação de recuperação.
- `DIRECT_URL`: conexão PostgreSQL para administração/migrações. Ela não é usada pelas rotas de negócio nem precisa ser configurada na hospedagem do aplicativo.

Não coloque credenciais na linha de comando nem faça commit de `.env.local`. Caracteres reservados na senha de uma URL devem ser codificados. O script usa parâmetros separados para a conexão e não imprime a URL em erros.

O arquivo público `supabase/prod-ca-2021.crt` é o certificado raiz distribuído pelo Supabase em `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`. Ele é usado para verificar a cadeia e o nome do servidor. Não desative a validação TLS.

## Banco e conta

1. Execute `npm run db:inspect` para conferir a conexão e os nomes de tabelas já existentes.
2. Execute `npm run db:migrate`. As tabelas são `nail_accounts`, `nail_clients`, `nail_procedures`, `nail_appointments`, `nail_payments`, `nail_expenses`, `nail_availability` e `nail_requests`.
3. Em Authentication > Users, crie a usuária autorizada e confirme seu e-mail. A própria profissional define a senha, sem compartilhá-la com o desenvolvedor.
4. Execute `npm run db:provision`. Somente uma usuária já confirmada com o e-mail configurado será vinculada ao novo ateliê.
5. Execute `npm run db:verify`. O script verifica RLS e autorização; qualquer registro de verificação é revertido.

Não há importação automática da demonstração nem de dados da API antiga. Sem uma linha ativa em `nail_accounts`, uma conta do Supabase não obtém acesso à aplicação, mesmo que o provedor aceite novos usuários.

O provedor Supabase deste projeto compartilhado pode aceitar criação de contas para outros usos. O aplicativo não oferece cadastro e não concede acesso a essas contas. Se o projeto for exclusivo deste aplicativo, é possível desativar **Allow new users to sign up** em Authentication; avalie os demais usos do projeto antes de alterar essa configuração global.

## Recuperação de senha

Em Authentication > URL Configuration:

- Configure Site URL para a origem da aplicação.
- Adicione `http://127.0.0.1:3335/auth/callback` às URLs permitidas no ambiente local.
- Ao publicar, adicione a URL HTTPS equivalente e atualize `APP_URL` no servidor.

O aplicativo usa o fluxo PKCE: “Esqueci minha senha” solicita um e-mail; a rota `/auth/callback` troca o código por sessão e abre `/redefinir-senha`. O link deve ser aberto no mesmo navegador em que foi solicitado. A nova senha precisa ter de 12 a 128 caracteres; após a alteração, a usuária entra novamente.

Também há suporte à confirmação por token hash na rota `/auth/confirm`, para links de convite ou recuperação. Se optar por esse fluxo nos templates do Supabase, use a URL da aplicação com `token_hash={{ .TokenHash }}` e `type=invite` ou `type=recovery`; não altere o template para todos os consumidores de um projeto compartilhado sem conferir os outros usos.

O serviço padrão de e-mail do Supabase tem limites e restrições de destinatários. Para uso contínuo, configure um remetente SMTP no Supabase e confira a entrega real. O aplicativo apresenta erro quando o provedor recusa o envio; não simula uma mensagem enviada.

Nenhuma chamada de envio de e-mail é executada pelos testes automáticos deste projeto.

## Operação e acesso

- Manter `nail_accounts.active = false` revoga o acesso aos dados dessa conta, inclusive com uma sessão ainda válida.
- Não conceder INSERT/UPDATE/DELETE nas tabelas `nail_*` aos papéis públicos. As gravações passam por `nail_apply_command`.
- Não editar migrações já aplicadas; criar uma nova migração para ajustes de banco.
- A exportação Excel serve para consulta. Definir uma política de backup e recuperação do banco antes da publicação.

Referências: [SSR e sessão do Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [autenticação por senha](https://supabase.com/docs/guides/auth/passwords), [conexão SSL verificada](https://supabase.com/docs/guides/platform/ssl-enforcement).
