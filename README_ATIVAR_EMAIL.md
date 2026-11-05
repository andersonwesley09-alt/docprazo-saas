# DocPrazo V3.1 — Ativar e testar e-mails

## 1. O que já foi implementado

- Alertas visuais por empresa e verificação de documentos em atraso e dentro do prazo de alerta.
- Até **5 destinatários** por empresa (e-mails separados por vírgula).
- Um **resumo por empresa por dia**, com identificação de validade e situação. Não envia os PDFs ou outros anexos.
- Botão **Enviar e-mail de teste** independente do resumo diário.
- **Prévia** do resumo sem enviar e histórico de envio/falha por empresa.
- Verificação automática após o horário configurado, desde que o servidor esteja executando.
- A conta cliente só edita seus próprios destinatários. Credenciais secretas pertencem ao proprietário da plataforma.

**IMPORTANTE:** Não foi enviada nenhuma mensagem real durante a elaboração deste pacote. A integração foi testada com um simulador da API, não com uma chave real do Resend. O status "aceito" significa que o provedor registrou a solicitação, não necessariamente entrega na caixa de entrada. Teste recebimento, spam e limites na sua conta.

## 2. Como testar sem comprar domínio

1. Abra https://resend.com e crie sua conta, usando **seu e-mail real**.
2. No painel Resend, abra **API Keys > Create API Key**, crie uma chave com permissão **Sending access** e copie-a para um local seguro.
3. Na pasta `DocPrazo_V3_1`, copie `.env.example` para um arquivo chamado `.env` (no Windows, habilite a exibição de extensões para não gerar `.env.txt`).
4. Edite `.env` pelo Bloco de Notas. Cole sua chave **apenas** na linha `RESEND_API_KEY=`. Confira:

   ```ini
   RESEND_API_KEY=re_SUA_CHAVE_PRIVADA
   REMINDER_FROM_EMAIL="DocPrazo <onboarding@resend.dev>"
   REMINDERS_SCHEDULE_ENABLED=0
   EMAIL_REMINDER_HOUR=9
   ```

5. Pare e reinicie o servidor pelo `INICIAR_DOC_PRAZO.bat` ou `npm start`.
6. Entre como **Administrador** da sua empresa e abra **E-mail de alertas**.
7. Em **E-mails destinatários**, informe **exatamente o mesmo e-mail usado para cadastrar a conta no Resend**. Salve; você pode manter o checkbox de avisos diários desativado neste momento.
8. Clique em **Enviar e-mail de teste** e confira a caixa de entrada e a pasta de spam. Você deverá ver no histórico "Aceito pelo provedor" se a API aceitou.

**Limitação do remetente de testes:** `onboarding@resend.dev` é para testar a integração, não para enviar a todas as empresas. Ele só permite e-mails para o endereço vinculado à sua conta Resend. Para destinatários de clientes, valide um domínio de sua propriedade.

## 3. Como habilitar envios reais às empresas

1. Registre um domínio ou escolha um subdomínio de envio que pertença a você (por exemplo, `avisos.seudominio.com.br`).
2. Em Resend > **Domains**, adicione esse domínio e configure os registros DNS apresentados (SPF, DKIM e os demais registros exigidos pela plataforma). Aguarde constar **Verified**.
3. No `.env` ou nas variáveis privadas da sua hospedagem, troque para o remetente validado:

   ```ini
   REMINDER_FROM_EMAIL="DocPrazo <alertas@avisos.seudominio.com.br>"
   REMINDERS_SCHEDULE_ENABLED=1
   EMAIL_REMINDER_HOUR=9
   ```

4. Reinicie a aplicação. Cada empresa, na própria aba **E-mail de alertas**, cadastra os destinatários e marca **Ativar avisos diários**.
5. Confira o envio de teste e o recebimento em endereços de diferentes provedores. Cadastre alguns documentos de teste com vencimento próximo.
6. Confira **Prévia dos alertas** e depois **Enviar resumo de hoje**. Um segundo resumo diário será rejeitado no mesmo dia. Um e-mail de teste NÃO consome o resumo diário.
7. Deixe a aplicação rodando continuamente em hospedagem. A rotina tenta o envio a partir da hora definida em `EMAIL_REMINDER_HOUR`, usando **America/Fortaleza**, e verifica a cada cinco minutos. Se o servidor ficar desligado, o envio não ocorrerá no horário; quando voltar após a hora, tentará enviar naquele mesmo dia.

Para teste de mensagens sem vencimentos cadastrados, use **Enviar e-mail de teste**. O resumo diário só é disparado quando existem documentos em alerta.

## 4. Segurança e limitações

- **Não cole `RESEND_API_KEY` no ChatGPT e não a envie em imagens ou prints.** Configure diretamente no `.env` privado ou nas variáveis da hospedagem.
- O arquivo `.env` está ignorado pelo Git, mas confira antes de publicar. Não inclua `.env` em pacotes públicos.
- O envio exige conexão com a internet e um serviço Resend funcionando. O limite de mensagens depende do plano do Resend; monitorar volume e erros.
- No provedor de e-mail os nomes e vencimentos dos documentos são transmitidos para montar os avisos. Não inclua dados sensíveis desnecessários nos títulos e revise termos/privacidade.
- Alertas por e-mail não substituem a responsabilidade da empresa de conferir os vencimentos; o provedor pode atrasar ou não entregar mensagens.
- A aplicação utiliza SQLite em instância única. Para grande escala, conclua a migração para PostgreSQL, rotinas independentes de envio, fila de mensagens, monitoramento, backups externos e conciliação de falhas.
- O histórico local registra "Aceito" ou "Falhou" conforme a resposta da API. Não informa se o e-mail foi aberto ou recebido. Para ter status de entrega/bounce seria preciso integrar webhooks de eventos do Resend em próxima fase.

## 5. Atualizar a versão anterior sem perder dados

1. Pare o sistema anterior.
2. Copie a pasta `data` e execute um backup antes de atualizar.
3. Extraia o ZIP V3.1 em uma pasta nova.
4. Copie a pasta `data` antiga inteira para `DocPrazo_V3_1/data`.
5. Configure seu `.env` novo (não transfira configurações se não souber a origem) e execute `INICIAR_DOC_PRAZO.bat`.
6. Entre com suas contas e confira documentos e anexos. Execute `npm test` para os testes automatizados.
7. Não apague a pasta anterior até validar os cadastros, anexos e histórico.

## 6. Referências do serviço de envio

- Resend: https://resend.com
- API Keys: https://resend.com/api-keys
- Domains: https://resend.com/domains
- Documentação: https://resend.com/docs

