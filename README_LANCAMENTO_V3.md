# DocPrazo V3.1 — Preparação de lançamento e piloto comercial

**Estado: software em piloto com funções comerciais implementadas, NÃO lançado e NÃO validado com pagamentos reais.** Esta versão usa **SQLite em disco persistente** em **uma única instância Node.js**. Para ampliar escala, migrar a PostgreSQL e armazenamento de objetos, após validar o produto e executar testes de migração. NÃO use hospedagem efêmera ou várias réplicas com um único banco SQLite.

## Mudanças V3
- Teste de 14 dias para novas empresas (50 documentos, 3 usuários); contas já existentes recebem 30 dias de transição. O acesso após término vira **somente leitura e exportação**, mantendo os documentos.
- Plano Fundador R$ 99/mês, 100 documentos e 5 usuários, com checkout de assinatura Mercado Pago opcional.
- Consulta de assinatura no Mercado Pago e webhook de `subscription_preapproval` validado por HMAC + leitura autenticada da assinatura no provedor. O retorno do navegador **não autoriza acesso por si só**.
- Status `active` representa **assinatura autorizada pelo provedor**, não conciliação financeira de cada parcela; para operar cobranças reais, validar faturamento e eventos `subscription_authorized_payment` no ambiente do titular.
- Painel do proprietário com número de organizações, estado de acesso e limites. **Não dá acesso aos documentos de outras empresas.** Comando de promoção explícito.
- Recuperação de senha por e-mail com token de uso único e validade 30 minutos (requer Resend).
- Usuários seguem com papéis administrador/editor/leitor, com segregação entre organizações, CSRF, sessão HttpOnly e proteção de uploads.

## Teste no Windows
1. Extraia em nova pasta **DocPrazo_V3**.
2. Pare o V2.1 e **copie o diretório inteiro `data` (banco e uploads)** para a V3. Guarde a V2.1 intacta.
3. Em `DocPrazo_V3`, execute `npm start`. Não há dependências npm externas.
4. Acesse `http://localhost:3005`.
5. Entre com sua conta existente e confira Documentos, Anexos, Relatórios, Equipe e Assinatura. Na migração, a assinatura é criada com 30 dias de avaliação.
6. Para habilitar o **seu** acesso ao Painel SaaS, no PowerShell da V3 execute `node scripts/promover-proprietario.js seu-email@empresa.com`, reinicie/sessão ou faça logout/login.
7. Execute `npm test` e `npm run backup`.

## Hospedagem piloto na Railway (sugestão, uma instância)
1. Crie um **repositório privado** no GitHub com os arquivos da pasta V3, mas **nunca inclua** `data/`, `backups/`, `.env` nem credenciais.
2. Conecte esse repositório como serviço Node na Railway, configure uma instância (sem réplicas horizontais), instale um **Volume persistente** com caminho `/data`.
3. Configure variáveis do `.env.example` pela aba Variables, principalmente `NODE_ENV=production`, `APP_PUBLIC_URL=https://...` (URL final sem barra), `DATA_DIR=/data`, `COOKIE_SECURE=1`, `ALLOW_PUBLIC_SIGNUP=0` inicialmente.
4. Habilite domínio HTTPS, configure `RESEND_API_KEY` e `REMINDER_FROM_EMAIL` após validar o domínio. `REMINDERS_SCHEDULE_ENABLED=1` inicia a rotina de alertas. Faça teste real de e-mail.
5. Configure `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` depois de gerar credenciais válidas de sua empresa no Mercado Pago. Cadastre URL de webhook `https://SEU-DOMINIO/api/webhooks/mercadopago` para tópico **subscription_preapproval**. Comece por ambiente de homologação e simule webhooks assinados. **Não habilite checkout para clientes antes de homologar.**
6. Configure backups automáticos do volume e **cópias externas** com restauração testada; o comando `npm run backup` cria uma cópia local, mas NÃO equivale a backup externo.
7. Execute teste ponta a ponta com cliente fictício, comprovante, e-mail, tentativa de vazamento entre organizações, cadastro, cobrança, cancelamento e restauração. Revise termos de serviço, LGPD, suporte, impostos e notas fiscais com profissionais adequados antes de abertura pública.
8. Após verificação, mude `ALLOW_PUBLIC_SIGNUP=1` para permitir cadastro livre.

## Segurança e limites conhecidos
- O checkout bloqueia um segundo link caso já exista um identificador de assinatura na empresa; evita múltiplos vínculos acidentais. Para cancelar uma assinatura, conclua primeiro o processo no provedor. Implementar cancelamento self-service e conciliação de faturas é requisito para lançamento amplo.
- Webhooks exigem assinatura criptográfica com timestamp recente; o backend consulta o provedor e compara id, referência, e-mail, moeda e valor antes de autorizar. Os handlers dependem de credenciais externas e NÃO foram testados com uma conta real.
- **Os anexos permanecem em disco**, no mesmo volume que o banco SQLite; configure criptografia, controles de infraestrutura e backups externos. Não ofereça armazenamento ilimitado.
- O sistema **não faz** cálculo ou emissão de nota fiscal, não é um serviço de validade jurídica documental e não garante que alertas de e-mail sejam entregues.
- O `APP_PUBLIC_URL` é obrigatório em produção. A aplicação envia cookies `Secure` em produção e cabeçalhos de proteção, mas ainda exige auditoria de segurança e LGPD.
- Não existe sistema de tickets de suporte, DPA formal, painel de faturas liquidadas, cancelamento self-service, nem escala horizontal. Portanto, ainda NÃO anunciar como SaaS pronto para milhares de clientes.

## Checklist mínimo para abertura ao público
- [ ] CNPJ/contabilidade/preço/tributos e nota fiscal de serviço definidos
- [ ] Termos de uso e política de privacidade revisados e publicados
- [ ] Domínio HTTPS e empresa/contatos de suporte reais
- [ ] Banco e anexos em volume persistente, backups externos e teste de restauração
- [ ] Resend com domínio validado, e-mail de teste, resumo diário e recebimento real testados
- [ ] Mercado Pago homologado com checkout, webhooks, conciliação e cancelamento
- [ ] Testes com duas empresas reais de piloto e assinaturas de valor baixo (autorizadas)
- [ ] Monitoramento de falhas, alerta de indisponibilidade, prazo de suporte estabelecido

## Histórico de validação local em 02/11/2026
Foram executados sete testes automáticos (incluindo V1/V2/V2.1 e V3) e verificações de sintaxe JavaScript. A interface V3 passou por testes de renderização de componentes; um teste visual completo em navegador automatizado foi impedido pelas restrições do ambiente. Integrações externas (pagamento e e-mail reais) **não** foram exercitadas.

Referências úteis:
- https://docs.railway.com/volumes
- https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/create-preapproval/post
- https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks
