# DocPrazo V3.1 — Piloto SaaS + Alertas por e-mail

**LEIA PRIMEIRO `README_ATIVAR_EMAIL.md` para configurar os alertas e `README_LANCAMENTO_V3.md` para publicação.** A V3 adiciona assinatura, período de teste, painel SaaS e recuperação de senha. Não é publicação pública concluída. Esta versão permanece em SQLite para operação em uma instância com volume persistente.

---

# Histórico de funcionalidades V2.1 — Controle de Vencimento de Documentos

**Atualização ampla sobre a V1**, preservando cadastros e renovações existentes. Plataforma web local com login multiempresa, anexos de documentos, equipe, auditoria, relatórios e e-mails de vencimento opcionais.

> **Estado do produto:** versão funcional para testes internos e validação. Não é um SaaS comercial já publicado. Para produção pública ainda são necessários PostgreSQL, serviço persistente de armazenamento, HTTPS, backups externos, monitoramento, recuperação de conta, revisão de segurança/LGPD, sistema de assinatura e testes de carga.

## Requisitos

- Windows, Linux ou macOS com **Node.js 22.13+** (Node.js 24 ou 26 LTS recomendado, se disponível).
- Sem `npm install`: usa apenas bibliotecas nativas de Node (`node:http`, `node:sqlite`, `node:crypto`).
- O aviso do SQLite experimental pode aparecer no Node.js 22.

## Executar no Windows

1. Extraia o ZIP e entre na pasta `DocPrazo_V2` (a que contém `package.json`).
2. Na barra de endereço do Explorador, escreva `powershell` e pressione Enter.
3. Execute (ou dê dois cliques em `INICIAR_DOC_PRAZO.bat`):

```powershell
node -v
npm start
```

4. Abra **http://localhost:3005** e clique em **Cadastrar empresa**.
5. O usuário que cadastra a empresa vira **administrador**.

Para usar outra porta:

```powershell
$env:PORT=3010
npm start
```

### Já utiliza a V1? Não perca os dados

1. **Pare o servidor antigo** (`Ctrl+C`).
2. Faça uma cópia de segurança da pasta `data` da V1 antes de qualquer alteração.
3. Copie a pasta `data` inteira da V1, incluindo `docprazo.sqlite`, para dentro da pasta da V2, ou configure `DATA_DIR` apontando para a pasta original.
4. Inicie a V2 com `npm start`. As novas tabelas e colunas são criadas automaticamente **sem apagar os documentos/renovações da V1**.
5. Se precisar voltar à V1, recupere o backup completo anterior à migração.

Por padrão, os arquivos são mantidos em `data/docprazo.sqlite` e `data/uploads/`. **Não exclua essa pasta** e nunca envie `data/` para um repositório público.

## Telas e funcionalidades

| Módulo | V2.1 |
|---|---|
| Visão geral | Indicadores, prioridades e vencimentos mais próximos |
| Documentos | Criar, editar, excluir, renovar, consultar histórico e filtrar |
| Anexos | PDF, PNG e JPG de até 5 MB cada, até 10 arquivos por documento; download autenticado |
| Alertas | Avisos na tela conforme antecedência de 7, 15, 30, 60 ou 90 dias |
| Relatórios | Indicadores por categoria, exportação CSV completa ou filtrada e calendário `.ics` |
| Equipe | Usuários com perfis administrador, editor e leitor; ativação/desativação; redefinição pelo administrador |
| Auditoria | Histórico das ações realizadas (últimos 500 eventos exibidos) |
| Configurações | Alterar o nome da empresa e a própria senha |
| E-mail de alertas | Configuração do destinatário, habilitar/desabilitar, teste de envio e rotina automática opcionais |
| Backup | Comando para copiar o banco SQLite de forma consistente e os anexos |

### Permissões

- **Administrador:** gerencia tudo, inclusive usuários, auditoria, nome da empresa e configurações de e-mail.
- **Editor:** cria, edita, renova e exclui documentos e anexos, consulta e exporta dados.
- **Leitor:** visualiza os dados, pode baixar anexos e exportar, mas não modifica cadastros.
- As verificações de permissões e de isolamento de empresas são feitas no **servidor** (não somente na interface).
- Desativar um membro encerra suas sessões; sua identificação permanece na auditoria. A conta pode ser reativada.

### Notificações por e-mail — configuração opcional

O sistema integra a **API de envio do Resend** pelo `fetch` nativo. Não há e-mails enviados se não configurar credenciais.

1. Crie uma conta no Resend, valide um domínio remetente e gere uma chave de API com permissão de envio.
2. Configure as variáveis de ambiente no **servidor**. Exemplo em PowerShell (substitua pelos seus próprios valores, não inclua credenciais no ZIP nem no Git):

```powershell
$env:RESEND_API_KEY="sua-chave-privada"
$env:REMINDER_FROM_EMAIL="DocPrazo <avisos@seudominio.com.br>"
$env:REMINDERS_SCHEDULE_ENABLED="1"
npm start
```

3. Acesse **E-mail de alertas** com um administrador, cadastre o destinatário, marque **Habilitar** e salve.
4. É possível clicar em **Enviar resumo agora**. Com a rotina automática ativada, o processo tenta enviar após as **09:00 (America/Fortaleza)**, verificando a cada 5 minutos enquanto o Node estiver em execução.

**Observações:** a plataforma envia no máximo **um resumo por empresa por data local**, incluindo documentos vencidos e documentos no período de aviso, e apenas quando houver alertas. O envio externo exige internet, domínio/conta do provedor configurados e sua disponibilidade. Os dados enviados ao provedor são nome e vencimento dos documentos; não envia o conteúdo dos anexos. Para operar publicamente, providencie consentimentos, políticas e proteção de dados apropriados. O sistema registra o aceite do provedor, não a entrega na caixa postal. Esta integração **não foi testada com credenciais reais**.

### Exportações

- Em **Documentos**, **Exportar filtrados** exporta somente os documentos visíveis após busca/filtro; **Todos** exporta toda a empresa.
- Em **Relatórios**, **CSV completo** exporta todos e **Calendário .ICS** gera um arquivo para importar em serviços como Outlook ou Google Agenda. O calendário importado é **estático**: alterações posteriores exigem nova importação.
- O CSV usa UTF-8 com BOM e separador `;`, com proteção básica contra interpretações de fórmulas em planilhas.

## Backup e testes

Para backup do banco SQLite consistente e da pasta de anexos:

```powershell
npm run backup
```

O resultado é criado em `backups/<data-e-hora>/` e contém o banco, `uploads/` e instruções. Configure cópias externas seguras para evitar perda em caso de falha do computador. A operação de backup não substitui uma política de recuperação testada.

Para executar todos os testes automatizados:

```powershell
npm test
```

Testes cobrindo API V1, V2, migração com dados antigos, limites de acesso e renderização das telas. Os testes criam bancos temporários: **não apagam seu banco local**.

Para verificar a sintaxe:

```powershell
npm run check
```

## Estrutura do pacote

```text
DocPrazo_V2/
├── server.js              API HTTP, autenticação, dados, auditoria e notificações
├── package.json           Scripts do projeto
├── INICIAR_DOC_PRAZO.bat  Inicialização no Windows
├── public/
│   ├── index.html
│   ├── app.js             Interface e ações
│   ├── styles.css         Layout responsivo
│   └── favicon.svg
├── scripts/
│   └── backup.js
├── test/
│   ├── api.test.js
│   ├── v2.test.js
│   ├── migration.test.js
│   └── ui.test.js
└── data/                  Criada automaticamente (nunca publicar)
```

## Antes de vender como SaaS

Ainda faltam hospedagem com persistência e domínio HTTPS, banco de dados apropriado à escala, backup automático externo, controles operacionais, monitoramento e proteção contra abuso, recuperação de senha e confirmação de e-mail, política de privacidade/LGPD, termos de uso, cobrança e assinatura, controle de plano e testes de segurança independentes. Recomenda-se também antivírus/antimalware para uploads e autenticação de dois fatores para administradores.

**Hospedagem:** GitHub Pages não executa aplicações Node.js nem armazena um banco de dados de servidor. Para publicar este projeto, será necessário um serviço de hospedagem compatível com backend e armazenamento persistente.

**DocPrazo** é nome provisório; verifique disponibilidade de domínio e marca antes de comercializar.


## O que mudou na V2.1 — Excel e renovações

- **Excel real (.xlsx)**: na tela Documentos, utilize **Excel filtrados** ou **Excel todos**. O sistema gera uma planilha com cabeçalho profissional, painel de indicadores, abas **Documentos** e **Resumo**, datas reconhecidas como datas e formatadas como `dd/mm/aaaa`, colunas ajustadas, situação colorida, filtros no cabeçalho e linhas alternadas.
- **CSV preservado**: botões **CSV filtrados** e **CSV todos** permanecem disponíveis. CSV é um formato de dados e não armazena largura de colunas ou formatação visual; para apresentar a planilha use Excel.
- **Relatórios**: botão **Excel completo**, além de CSV e calendário ICS.
- **Renovar com comprovante**: no formulário de renovação existe um campo opcional para anexar o novo PDF, PNG ou JPG. Se anexado, o arquivo fica vinculado à renovação respectiva e os anexos anteriores continuam guardados. O sistema valida o arquivo antes de atualizar a data e não altera a validade se o upload falhar.
- **Rastreabilidade dos anexos**: a janela de anexos identifica os comprovantes associados a uma renovação; anexos antigos sem vínculo não são reclassificados indevidamente.
- **Melhorias de interface**: a auditoria mostra horário local de João Pessoa (UTC−3) e o perfil do usuário aparece em português.
- **Sem novas dependências**: o módulo exportador Excel usa bibliotecas nativas do Node.js e não exige `npm install`.

### Atualizar da V2.0 para V2.1 (preservando seus dados)

1. Pare a versão anterior com **Ctrl+C** e feche o aplicativo.
2. Execute `npm run backup` dentro da pasta da V2.0, ou copie com o servidor parado toda a pasta `data`, inclusive `docprazo.sqlite` e `uploads`.
3. Extraia o ZIP da V2.1 **em uma pasta nova**, por exemplo `DocPrazo_Atualizado`.
4. Copie a pasta `data` completa da V2.0 para a nova pasta `DocPrazo_V2` (ao lado do `server.js`).
5. Execute `INICIAR_DOC_PRAZO.bat` na pasta nova e acesse `http://localhost:3005`.
6. Verifique seu cadastro, documentos, anexos e histórico de renovações. A nova coluna `renewal_id` será criada automaticamente sem apagar arquivos anteriores.

**Não exclua a instalação antiga nem o backup até confirmar os dados na V2.1.** A V2.0 e a V2.1 não devem rodar simultaneamente na mesma porta. Se usar `DATA_DIR`, mantenha o caminho da base e faça backup antes.

### Limites

- Exportação de Excel limitada a 20.000 documentos por arquivo.
- Arquivos: até 5 MB por anexo e 10 por documento.
- Se o prazo for renovado sem incluir um novo comprovante, o sistema mantém os anteriores; a atualização de um cadastro não altera o conteúdo de um PDF já existente.
- Para auditoria com valor probatório e uso comercial, o produto ainda necessita infraestrutura e revisões de segurança adicionais.
