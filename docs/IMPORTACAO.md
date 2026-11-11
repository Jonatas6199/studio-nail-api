# Agenda histórica e correções

O atendimento tem um botão **Cancelar agendamento**, seguido de confirmação. Ele libera o horário e interrompe os lembretes. O histórico e os recebimentos permanecem registrados; não há devolução automática.

Em **Recebimentos**, o lápis permite corrigir o sinal ou outro pagamento, incluindo valor, data e forma. A correção altera o mesmo registro, atualiza saldo e relatórios, não duplica entradas e guarda os valores anteriores no histórico privado de operações. Zero corrige um recebimento lançado por engano, preservando o registro. A soma recebida não pode ultrapassar o preço do atendimento. A correção também está disponível depois de um cancelamento.

## Importação da agenda 2026

O importador desta etapa lê o formato da aba `Agenda 2026`, colunas Data, Início, Evento e Valor. A preparação não grava cadastros; gera um plano privado para conferir. A aplicação é uma transação única, verifica a revisão do ateliê, preserva os registros existentes e reconcilia quantidade e total dos recebimentos antes de confirmar. Um histórico privado por arquivo/linha evita reimportar os mesmos agendamentos.

Regras aprovadas:

- Valor preenchido: dinheiro recebido, na data do atendimento. A forma fica **Não informado**, pois não consta da planilha.
- Zero: atendimento gratuito, sem criar recebimento.
- Em branco: atendimento ainda não realizado, com procedimento e valor **A definir**. O valor desconhecido não é exibido como gratuito nem entra nos totais previstos; também não é apresentado como quitado no WhatsApp. No Excel, os campos de valor desconhecido ficam vazios.
- Abaixo de R$ 120: Cutilagem Russa. R$ 120: alinhamento de lâmina. Entre R$ 120 e R$ 140: alinhamento e extra. R$ 140: alongamento. Acima disso: alongamento e extra. Os valores com centavos são preservados.
- Os procedimentos continuam editáveis. Cadastros auxiliares ficam arquivados, sem substituir os procedimentos e preços atuais do ateliê.
- Usa-se a duração cadastrada do procedimento principal. Nos indefinidos, 90 minutos estimados. A duração histórica real não consta da origem; as observações informam a estimativa.
- Registros sem início ficam identificados como **Horário não informado**. O horário técnico usado para armazenamento não é apresentado como horário real nem gera bloqueios ou lembretes. É possível completar a informação depois.
- Datas anteriores à referência da importação: concluídos; na referência ou posteriores: agendados.
- Remove-se “Unha” e outras etiquetas do nome, mantendo a descrição original nas observações do atendimento. A correspondência ignora acentos e caixa, mas não combina nomes parecidos automaticamente.
- Uniões de nomes exigem confirmação e são fornecidas em um arquivo de aliases privado. Clientes com nomes semelhantes permanecem separadas quando não há autorização para unir.
- As sobreposições autorizadas mantêm os horários de origem e exibem aviso na agenda e nos detalhes. Nenhum agendamento é movido automaticamente.

O arquivo de origem não é alterado. Planos, cópias anteriores e relatórios com dados pessoais ficam fora do repositório, com acesso privado. A planilha de dezembro tem outro formato e será tratada separadamente após ser fornecida.

Execução administrativa (nunca no navegador ou em produção com a senha administrativa):

```
node --import tsx scripts/import-agenda.mjs prepare ORIGEM.xlsx PLANO.json ENV_PRIVADO ALIASES.json
node --import tsx scripts/import-agenda.mjs apply PLANO.json RELATORIO.json ENV_PRIVADO
```

As migrações são adicionais e não removem os dados existentes. O aplicativo publicado continua usando a sessão da usuária; as credenciais administrativas ficam apenas no ambiente local de preparação.
