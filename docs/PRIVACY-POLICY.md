# Política de Privacidade — PITCH

**Última atualização:** 13 de outubro de 2026

> ⚠️ **Rascunho de trabalho.** Escrito pelo Leo (CMO/IA) e atualizado pelo Cris (CTO/IA) a pedido do Vinicius, adaptado ao que o PITCH recolhe e faz de verdade hoje. Não é aconselhamento jurídico — antes de qualquer integração de pagamento real (MB Way) e, idealmente, antes de escalar, passa por um advogado. A versão publicada é `src/components/LegalPage.jsx`; mantém os dois em sincronia.

## 1. Quem somos

O PITCH ("nós", "a app") é operado por Vinicius Capella, em nome individual, ainda sem empresa constituída. Para qualquer questão sobre esta política ou os teus dados, contacta-nos em vini@pitch-fc.com.

*Nota interna: esta secção deve ser atualizada assim que houver uma empresa formalmente constituída (nome legal, NIF, sede), substituindo a responsabilidade individual pela da empresa. Garantir também que a caixa vini@pitch-fc.com existe e é monitorizada — é o contacto para pedidos RGPD.*

## 2. Que dados recolhemos

Recolhemos apenas o necessário para o PITCH funcionar:

- **Conta:** email e palavra-passe (gerida pelo nosso fornecedor de autenticação, Supabase).
- **Perfil de jogador:** nome, alcunha, foto, posição, pé preferido, idade, nacionalidade, clube do coração, atributos de jogo (autoavaliados e avaliados pelos teus colegas de equipa).
- **Contacto:** número de telemóvel (usado para identificar pagamentos por MB Way entre jogadores e para te reconhecer quando falas com o Pitch AI no grupo de WhatsApp).
- **Atividade no jogo:** confirmações/recusas de presença, pagamentos marcados como feitos, golos, assistências, votos de MVP, histórico de jogos.
- **Conteúdo que publicas:** fotos, vídeos e comentários que partilhas no feed social.
- **Vídeos do Pitch VAR:** pequenos clipes de vídeo (e som, se a opção de áudio estiver ligada) dos segundos à volta de cada golo registado no Matchday, quando o organizador ativa o VAR e um jogador filma com o próprio telemóvel. Vê a secção 8.
- **Mensagens ao Pitch AI:** se o teu grupo usar o bot de WhatsApp, o texto das mensagens que lhe diriges (por exemplo, "@Pitch eu vou" ou uma pergunta sobre o jogo) e as respostas que ele envia ficam registados (`bot_message_log`).
- **País aproximado:** ao abrir a página de planos, o nosso fornecedor de alojamento (Vercel) deduz o país a partir do teu endereço IP, só nesse momento, para te mostrar os preços do teu mercado. Não guardamos o endereço IP nem o país, e não os enviamos a terceiros.
- **Dados técnicos:** o idioma, o tema e a tua escolha sobre cookies (guardados no teu dispositivo) e, apenas se aceitares, dados de utilização recolhidos pelo Google Analytics (ecrãs visitados, ações como criar conta ou confirmar presença, tipo de dispositivo e país aproximado).

**Não recolhemos** dados de cartão de crédito, dados bancários, nem processamos pagamentos diretamente — a mensalidade do campo é combinada e paga diretamente entre os jogadores (MB Way, dinheiro).

## 3. Para que usamos os teus dados

- Criar e gerir a tua conta e o teu grupo
- Mostrar a grelha de vagas, confirmações e sorteio de equipas
- Calcular estatísticas, rankings e o teu cartão de jogador
- Enviar lembretes e avisos do jogo no grupo de WhatsApp, quando o grupo usa o Pitch AI
- Entregar a cada marcador o vídeo do seu golo, quando o grupo usa o Pitch VAR
- Responder e agir quando falas com o Pitch AI (confirmar ou recusar a tua presença, consultar vagas e estatísticas e, se fores organizador ou auxiliar, criar ou cancelar jogos do grupo)
- Melhorar a app e perceber como é usada (análise de utilização, apenas com o teu consentimento)
- Cumprir obrigações legais

## 4. Base legal (RGPD)

- **Execução de um contrato** — precisamos dos teus dados para te dar acesso à app e às suas funcionalidades, incluindo o Pitch AI no teu grupo.
- **Consentimento** — para a análise de utilização (cookies de analytics), para conteúdo opcional que partilhas (fotos, posts), para as gravações do Pitch VAR (de quem decide filmar) e comunicações não essenciais.
- **Interesse legítimo** — para segurança, prevenção de abuso e melhoria do serviço, e o interesse do grupo em rever os seus golos no Pitch VAR (com as garantias da secção 8).

## 5. Com quem partilhamos dados

Não vendemos os teus dados a ninguém. Partilhamos apenas com:

- **Supabase** (alojamento da base de dados e autenticação, servidores na UE)
- **Vercel** (alojamento da aplicação web)
- **Fly.io** (alojamento do bot Pitch AI, em Paris, UE)
- **Resend** (envio de emails transacionais, ex. confirmação de conta)
- **Anthropic** (modelo de inteligência artificial do Pitch AI): recebe o texto das mensagens que lhe diriges e os dados de jogo necessários para responder, como a lista de confirmados e as estatísticas do grupo
- **Google** (Google Analytics), apenas se aceitares os cookies de analytics
- **WhatsApp/Meta**, nas mensagens que o Pitch AI envia ou recebe no teu grupo, se o teu grupo usar essa funcionalidade
- **Autoridades**, quando exigido por lei

Alguns destes fornecedores (Anthropic, Google, Meta) podem tratar dados fora da UE/EEE. Nesses casos, a transferência assenta em mecanismos reconhecidos pelo RGPD, como as cláusulas contratuais-tipo ou decisões de adequação.

## 6. Cookies e armazenamento local

O PITCH usa o armazenamento do teu navegador (localStorage e cookies) de duas formas:

- **Essencial (não precisa de consentimento):** manter a tua sessão iniciada, lembrar o idioma e o tema, o estado do tutorial inicial e a tua escolha sobre cookies. Sem isto a app não funciona.
- **Análise de utilização (só com o teu consentimento):** Google Analytics 4, que define cookies como `_ga` e `_ga_*` (validade até 2 anos) e nos diz, de forma agregada, que páginas e ações são mais usadas.

Não usamos cookies de publicidade nem de marketing e desativámos a personalização de anúncios do Google. Nunca enviamos ao Google o teu nome, email, telefone ou identificadores de conta, e os endereços de página que lhe enviamos não incluem parâmetros — por isso links de convite ou de confirmação, que contêm códigos secretos, nunca são partilhados.

Na primeira visita perguntamos-te se aceitas a análise de utilização. Podes mudar de ideias a qualquer momento: retirar o consentimento é tão fácil como dá-lo. Se recusares, ou não responderes, o Google Analytics nem chega a ser carregado. Também podes apagar cookies e dados do site nas definições do teu navegador.

*Nota interna: o banner só existe quando `VITE_GA_MEASUREMENT_ID` está definido (ver `src/lib/analytics.js`). Sem esse ID, nada é recolhido e não há nada a consentir.*

## 7. Quanto tempo guardamos os teus dados

Guardamos os teus dados enquanto a tua conta estiver ativa. Se pedires a eliminação da conta, apagamos os teus dados pessoais no prazo de 30 dias, exceto o que formos legalmente obrigados a manter.

Os registos de mensagens do Pitch AI (pergunta e resposta) são guardados para auditoria e melhoria do serviço e apagados automaticamente ao fim de 90 dias. Os dados de análise ficam no Google pelo período configurado na nossa conta de Analytics (no máximo 14 meses).

Os vídeos do Pitch VAR guardados na nuvem são apagados automaticamente 3 horas depois de o organizador encerrar oficialmente o Matchday (ver secção 8).

## 8. Pitch VAR — vídeos dos golos

O Pitch VAR é opcional e só funciona num jogo em que o organizador o ativou. Nada é gravado sem uma ação de um jogador: o vídeo é captado apenas pelo telemóvel de quem, por iniciativa própria, abre o VAR e carrega em iniciar a câmera — e deixa de ser captado quando a desliga.

- **O que é gravado:** o telemóvel mantém só os últimos segundos de vídeo, em memória, e vai descartando o resto. Quando um golo é registado no Matchday, fica guardado um clipe curto com os segundos antes e depois desse golo. O jogo inteiro nunca é enviado para a nuvem.
- **Quem aparece:** os jogadores em campo e, eventualmente, outras pessoas que estejam no campo ou perto dele no momento do golo.
- **Base legal:** o consentimento de quem filma (ao iniciar a câmera) e o interesse legítimo do grupo em rever os seus golos, limitado a clipes curtos, acesso restrito e apagamento rápido. Qualquer pessoa que apareça num clipe — jogador ou não — pode pedir que seja removido, escrevendo para vini@pitch-fc.com; removemos a cópia na nuvem sem demora.
- **Quem tem acesso:** só o jogador a quem o golo é atribuído, através da sua conta PITCH. Os clipes de golos de outras pessoas captados pelo teu telemóvel são enviados para a nuvem e apagados do teu aparelho assim que o envio é confirmado — não ficam contigo. O organizador e os restantes membros do grupo não têm acesso aos vídeos na nuvem.
- **Quanto tempo:** as cópias na nuvem são apagadas automaticamente 3 horas depois de o organizador encerrar oficialmente o Matchday (a limpeza corre de poucos em poucos minutos). Os clipes dos teus próprios golos que ficam no teu telemóvel, e qualquer vídeo que descarregues ou partilhes, ficam sob o teu controlo e responsabilidade.
- **Onde e como:** os clipes são guardados nos servidores do nosso fornecedor Supabase, na UE, num espaço de armazenamento privado. Cada acesso exige sessão iniciada e é verificado no servidor (ser o marcador, pertencer ao grupo, prazo ainda válido); não existem links públicos para os vídeos.

Podes pedir acesso a, ou a eliminação de, qualquer clipe em que apareças através de vini@pitch-fc.com, nos termos da secção seguinte.

*Nota interna: bucket privado `pitch-var` (limite 24 MB/clipe, só `video/mp4`), RLS via `private.var_download_allowed` (só o marcador, membro do grupo, antes de `expires_at`); `expires_at` = fim do Matchday + 3h; a Edge Function `pitch-var-cleanup` corre a cada 10 min (pg_cron). Remoção a pedido: apagar o objeto em Storage → pitch-var e marcar o clipe. A opção "publicar o golo" ainda não existe — se for construída, esta secção tem de ser revista antes.*

## 9. Os teus direitos

Ao abrigo do RGPD, tens direito a:

- Aceder aos dados que temos sobre ti
- Corrigir dados incorretos
- Pedir a eliminação da tua conta e dados
- Pedir a portabilidade dos teus dados
- Opor-te a determinados tratamentos
- Retirar o consentimento a qualquer momento (por exemplo, nas preferências de cookies)

Para exercer qualquer um destes direitos, contacta vini@pitch-fc.com. Tens também o direito de apresentar queixa junto da Comissão Nacional de Proteção de Dados (CNPD).

## 10. Menores de idade

O PITCH pode ser usado a partir dos 13 anos, idade mínima de consentimento digital em Portugal (Lei n.º 58/2019). O produto é pensado para grupos de futebol amador organizados por um adulto (o organizador do grupo); recomendamos que jogadores menores de 18 anos usem a app com conhecimento de um encarregado de educação.

## 11. Segurança

Usamos medidas técnicas e organizativas razoáveis (encriptação em trânsito, autenticação segura, controlo de acesso por grupo) para proteger os teus dados. Nenhum sistema é 100% seguro — se detetarmos uma violação de dados que te afete, iremos notificar-te nos termos da lei.

## 12. Alterações a esta política

Podemos atualizar esta política. Alterações relevantes serão comunicadas na app ou por email.

## 13. Contacto

Dúvidas sobre privacidade: vini@pitch-fc.com
