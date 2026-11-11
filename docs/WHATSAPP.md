# WhatsApp e lembretes

Nos detalhes de um atendimento agendado, use **Preparar confirmação** ou **Preparar lembrete**. A prévia pode ser editada; Abrir WhatsApp abre a conversa e preenche o texto. A profissional toca em Enviar no WhatsApp. O aplicativo não faz disparos nem recebe confirmações de entrega ou leitura.

Os modelos incluem nome, data, horário, procedimentos do agendamento, endereço do ateliê, valor combinado (inclusive alterações), sinal recebido e saldo. Pagamento integral é identificado. O endereço é cadastrado em Configurações > Seu negócio. Números brasileiros precisam de DDD; números estrangeiros usam + e código do país. Telefones incompletos bloqueiam a abertura da conversa.

No iPhone, o link comum pode abrir o WhatsApp pessoal. Não há garantia de escolha do Business por este link. Copiar mensagem permite colar o texto no Business. Não usamos esquemas não documentados para prometer abertura exclusiva de um dos aplicativos.

**Já enviei** é uma marcação manual, independente para confirmação e lembrete, compartilhada entre os dispositivos. Pode ser desfeita. Data, horário, cliente, telefone, procedimentos, preço, pagamentos ou endereço alterados tornam a marcação anterior desatualizada; o texto deve ser revisado e enviado novamente. O texto personalizado não é armazenado no histórico: a marcação registra o contexto do atendimento e a data informada pelo sistema, não prova de envio pelo WhatsApp.

## Avisos no aplicativo

Às 09h de Brasília, dois dias antes, o atendimento entra na lista da tela principal e no sino. Permanece até a marcação manual de envio ou o início do atendimento. Cancelados, concluídos, ausências e atendimentos passados não entram. A lista atualiza com a tela aberta e ao retornar ao aplicativo. Agendamentos feitos com menos de dois dias também aparecem quando já chegou o prazo.

## Notificações no iPhone

Requer iOS 16.4 ou posterior. No Safari, use Compartilhar > Adicionar à Tela de Início, abra pelo ícone do Ateliê, entre na conta e acesse Configurações > Seus lembretes > Ativar notificações. A permissão é solicitada somente depois do toque. Testar notificação envia um aviso apenas ao aparelho atual. Desativar neste aparelho não afeta outros dispositivos.

O aviso exibe somente a quantidade de lembretes; não inclui nomes, preços ou telefones na tela bloqueada. Tocá-lo abre a lista, protegida pelo login. Foco, permissões do iPhone, conexão e entrega do serviço de notificações podem adiar ou silenciar os avisos.

## Operação

- Web Push/VAPID, sem API paga de WhatsApp e sem novo serviço de hospedagem.
- O verificador roda no mesmo processo do Railway a cada minuto. A aplicação precisa permanecer ativa (`sleepApplication=false`) e com uma réplica.
- Jobs são reservados por cinco minutos; falhas temporárias tentam novamente depois de dez minutos. A entrega é deduplicada por aparelho e contexto do atendimento. Uma falha após a entrega, antes do registro no banco, pode causar repetição; a tag da notificação agrupa os avisos.
- O envio pode ocorrer alguns minutos após as 09h. A pendência na agenda independe da entrega da notificação.
- Endpoint expirado (404/410) é removido; a profissional pode reativar no aparelho. Limite de cinco aparelhos por conta.
- `PUSH_DATABASE_URL` usa um usuário dedicado, sem privilégios administrativos e sem leitura de clientes/agenda. Pode executar somente as funções de reservar e concluir jobs de push. A senha administrativa continua apenas no preparo local.
- `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`, `PUSH_DATABASE_URL` e `PUSH_WORKER_ENABLED=true` são configurações privadas do serviço. A chave pública é obtida após login; as demais nunca são enviadas ao navegador.
- `node scripts/configure-push.mjs` provisiona o usuário e gera as chaves no ambiente local privado. Não rotacionar as chaves sem planejar nova inscrição dos aparelhos. O worker local fica desativado para evitar processamento duplicado.
- O service worker não guarda páginas ou respostas privadas em cache.

As migrações 002 e 003 são adicionais e preservam os cadastros existentes. Os testes cobrem valores, telefones, horário de Brasília, remarcações, duplicidade, autorização e restrições do worker. A entrega real deve ser conferida pelo botão de teste no iPhone da profissional.
