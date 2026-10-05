import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { C, displayFont, BRAND } from "../theme";
import { analyticsConfigured } from "../lib/analytics";
import { openPreferences } from "../lib/consent";
import BtnGhost from "./BtnGhost";

// Static content for both legal pages — kept in JSX rather than fetched
// markdown so there's no extra request/parsing on a page that should load
// instantly. Source of truth for the *drafting* of this text is
// docs/PRIVACY-POLICY.md and docs/TERMS-OF-USE.md in the repo; keep both
// in sync if the wording changes.
//
// Section shape: { h, id?, p?, ul?, p2?, action? } — `action: "cookies"`
// renders the "manage cookie preferences" button (only when a GA4 property
// is configured, i.e. when there is actually something to manage).
const UPDATED = "Última atualização: 5 de outubro de 2026";

const CONTENT = {
  privacy: {
    title: "Política de Privacidade",
    sections: [
      {
        h: "1. Quem somos",
        p: [
          "O PITCH (“nós”, “a app”) é operado por Vinicius Capella, em nome individual, ainda sem empresa constituída. Para qualquer questão sobre esta política ou os teus dados, contacta-nos em vini@pitch-fc.com.",
        ],
      },
      {
        h: "2. Que dados recolhemos",
        p: [
          "Recolhemos apenas o necessário para o PITCH funcionar:",
        ],
        ul: [
          "Conta: email e palavra-passe (gerida pelo nosso fornecedor de autenticação, Supabase).",
          "Perfil de jogador: nome, alcunha, foto, posição, pé preferido, idade, nacionalidade, clube do coração, atributos de jogo (autoavaliados e avaliados pelos teus colegas de equipa).",
          "Contacto: número de telemóvel (usado para identificar pagamentos por MB Way entre jogadores e para te reconhecer quando falas com o Pitch AI no grupo de WhatsApp).",
          "Atividade no jogo: confirmações/recusas de presença, pagamentos marcados como feitos, golos, assistências, votos de MVP, histórico de jogos.",
          "Conteúdo que publicas: fotos, vídeos e comentários que partilhas no feed social.",
          "Mensagens ao Pitch AI: se o teu grupo usar o bot de WhatsApp, o texto das mensagens que lhe diriges (por exemplo, “@Pitch eu vou” ou uma pergunta sobre o jogo) e as respostas que ele envia ficam registados.",
          "Dados técnicos: o idioma, o tema e a tua escolha sobre cookies (guardados no teu dispositivo) e, apenas se aceitares, dados de utilização recolhidos pelo Google Analytics (ecrãs visitados, ações como criar conta ou confirmar presença, tipo de dispositivo e país aproximado).",
        ],
        p2: [
          "Não recolhemos dados de cartão de crédito, dados bancários, nem processamos pagamentos diretamente — a mensalidade do campo é combinada e paga diretamente entre os jogadores (MB Way, dinheiro).",
        ],
      },
      {
        h: "3. Para que usamos os teus dados",
        ul: [
          "Criar e gerir a tua conta e o teu grupo",
          "Mostrar a grelha de vagas, confirmações e sorteio de equipas",
          "Calcular estatísticas, rankings e o teu cartão de jogador",
          "Enviar lembretes e avisos do jogo no grupo de WhatsApp, quando o grupo usa o Pitch AI",
          "Responder e agir quando falas com o Pitch AI (confirmar ou recusar a tua presença, consultar vagas e estatísticas e, se fores organizador ou auxiliar, criar ou cancelar jogos do grupo)",
          "Melhorar a app e perceber como é usada (análise de utilização, apenas com o teu consentimento)",
          "Cumprir obrigações legais",
        ],
      },
      {
        h: "4. Base legal (RGPD)",
        p: ["Tratamos os teus dados com base em:"],
        ul: [
          "Execução de um contrato — precisamos dos teus dados para te dar acesso à app e às suas funcionalidades, incluindo o Pitch AI no teu grupo.",
          "Consentimento — para a análise de utilização (cookies de analytics), para conteúdo opcional que partilhas (fotos, posts) e comunicações não essenciais.",
          "Interesse legítimo — para segurança, prevenção de abuso e melhoria do serviço.",
        ],
      },
      {
        h: "5. Com quem partilhamos dados",
        p: ["Não vendemos os teus dados a ninguém. Partilhamos apenas com:"],
        ul: [
          "Supabase (alojamento da base de dados e autenticação, servidores na UE)",
          "Vercel (alojamento da aplicação web)",
          "Fly.io (alojamento do bot Pitch AI, em Paris, UE)",
          "Resend (envio de emails transacionais, ex. confirmação de conta)",
          "Anthropic (modelo de inteligência artificial do Pitch AI): recebe o texto das mensagens que lhe diriges e os dados de jogo necessários para responder, como a lista de confirmados e as estatísticas do grupo",
          "Google (Google Analytics), apenas se aceitares os cookies de analytics",
          "WhatsApp/Meta, nas mensagens que o Pitch AI envia ou recebe no teu grupo, se o teu grupo usar essa funcionalidade",
          "Autoridades, quando exigido por lei",
        ],
        p2: [
          "Alguns destes fornecedores (Anthropic, Google, Meta) podem tratar dados fora da UE/EEE. Nesses casos, a transferência assenta em mecanismos reconhecidos pelo RGPD, como as cláusulas contratuais-tipo ou decisões de adequação.",
        ],
      },
      {
        h: "6. Cookies e armazenamento local",
        id: "cookies",
        p: ["O PITCH usa o armazenamento do teu navegador (localStorage e cookies) de duas formas:"],
        ul: [
          "Essencial (não precisa de consentimento): manter a tua sessão iniciada, lembrar o idioma e o tema, o estado do tutorial inicial e a tua escolha sobre cookies. Sem isto a app não funciona.",
          "Análise de utilização (só com o teu consentimento): Google Analytics 4, que define cookies como _ga e _ga_* (validade até 2 anos) e nos diz, de forma agregada, que páginas e ações são mais usadas.",
        ],
        p2: [
          "Não usamos cookies de publicidade nem de marketing e desativámos a personalização de anúncios do Google. Nunca enviamos ao Google o teu nome, email, telefone ou identificadores de conta, e os endereços de página que lhe enviamos não incluem parâmetros — por isso links de convite ou de confirmação, que contêm códigos secretos, nunca são partilhados.",
          "Na primeira visita perguntamos-te se aceitas a análise de utilização. Podes mudar de ideias a qualquer momento: retirar o consentimento é tão fácil como dá-lo. Se recusares, ou não responderes, o Google Analytics nem chega a ser carregado. Também podes apagar cookies e dados do site nas definições do teu navegador.",
        ],
        action: "cookies",
      },
      {
        h: "7. Quanto tempo guardamos os teus dados",
        p: [
          "Guardamos os teus dados enquanto a tua conta estiver ativa. Se pedires a eliminação da conta, apagamos os teus dados pessoais no prazo de 30 dias, exceto o que formos legalmente obrigados a manter.",
          "Os registos de mensagens do Pitch AI (pergunta e resposta) são guardados apenas pelo tempo necessário para auditoria e melhoria do serviço. Os dados de análise ficam no Google pelo período configurado na nossa conta de Analytics (no máximo 14 meses).",
        ],
      },
      {
        h: "8. Os teus direitos",
        p: ["Ao abrigo do RGPD, tens direito a:"],
        ul: [
          "Aceder aos dados que temos sobre ti",
          "Corrigir dados incorretos",
          "Pedir a eliminação da tua conta e dados",
          "Pedir a portabilidade dos teus dados",
          "Opor-te a determinados tratamentos",
          "Retirar o consentimento a qualquer momento (por exemplo, nas preferências de cookies)",
        ],
        p2: [
          "Para exercer qualquer um destes direitos, contacta vini@pitch-fc.com. Tens também o direito de apresentar queixa junto da Comissão Nacional de Proteção de Dados (CNPD).",
        ],
      },
      {
        h: "9. Menores de idade",
        p: [
          "O PITCH pode ser usado a partir dos 13 anos, idade mínima de consentimento digital em Portugal (Lei n.º 58/2019). O produto é pensado para grupos de futebol amador organizados por um adulto (o organizador do grupo); recomendamos que jogadores menores de 18 anos usem a app com conhecimento de um encarregado de educação.",
        ],
      },
      {
        h: "10. Segurança",
        p: [
          "Usamos medidas técnicas e organizativas razoáveis (encriptação em trânsito, autenticação segura, controlo de acesso por grupo) para proteger os teus dados. Nenhum sistema é 100% seguro — se detetarmos uma violação de dados que te afete, iremos notificar-te nos termos da lei.",
        ],
      },
      {
        h: "11. Alterações a esta política",
        p: ["Podemos atualizar esta política. Alterações relevantes serão comunicadas na app ou por email."],
      },
      {
        h: "12. Contacto",
        p: ["Dúvidas sobre privacidade: vini@pitch-fc.com"],
      },
    ],
  },
  terms: {
    title: "Termos de Uso",
    sections: [
      {
        h: "1. Aceitação dos termos",
        p: [
          "Ao criar uma conta no PITCH, aceitas estes Termos de Uso e a nossa Política de Privacidade (que inclui a informação sobre cookies). Se não concordares, não uses a app.",
        ],
      },
      {
        h: "2. O que é o PITCH",
        p: [
          "O PITCH é uma aplicação que ajuda grupos de amigos a organizar o seu jogo semanal de futebol amador: confirmações de presença, divisão de custos do campo, sorteio de equipas, estatísticas e cartão de jogador. O PITCH não é uma operadora de campos, uma processadora de pagamentos, nem garante a realização de qualquer jogo.",
        ],
      },
      {
        h: "3. A tua conta",
        ul: [
          "Precisas de fornecer informação verdadeira ao criar a tua conta.",
          "És responsável por manter a tua palavra-passe segura.",
          "Tens de ter pelo menos 13 anos para criar uma conta.",
          "Podemos suspender ou eliminar contas que violem estes termos.",
        ],
      },
      {
        h: "4. As tuas responsabilidades",
        p: ["Ao usar o PITCH, comprometes-te a:"],
        ul: [
          "Não publicar conteúdo ofensivo, discriminatório, ilegal ou que viole direitos de terceiros",
          "Não usar a app para assediar, ameaçar ou prejudicar outros utilizadores",
          "Não tentar aceder a dados ou grupos aos quais não pertences",
          "Respeitar os outros jogadores e organizadores",
        ],
      },
      {
        h: "5. Conteúdo que publicas",
        p: [
          "Ao publicar fotos, vídeos ou comentários no PITCH, manténs os direitos sobre esse conteúdo, mas dás-nos uma licença para o mostrar dentro da app, aos outros membros dos teus grupos (ou publicamente, no caso do feed entre grupos). És responsável pelo que publicas.",
        ],
      },
      {
        h: "6. Pagamentos entre jogadores",
        p: [
          "Importante: o PITCH não processa, não guarda nem garante qualquer pagamento em dinheiro. O valor da mensalidade do campo é calculado pela app, mas o pagamento em si acontece diretamente entre os jogadores (ex: MB Way, dinheiro), fora do PITCH. O estado “pago” na app é apenas uma marca informativa, dada pelo próprio jogador ou pelo organizador — não é uma confirmação bancária. Qualquer disputa sobre dinheiro entre jogadores é da responsabilidade deles, não do PITCH.",
        ],
      },
      {
        h: "7. Pitch AI (bot de WhatsApp)",
        p: ["Se o teu grupo ativar o Pitch AI no WhatsApp:"],
        ul: [
          "Ele responde às mensagens que o mencionam e envia avisos do jogo no grupo (vagas, lembretes, resultados).",
          "Pode confirmar ou recusar a tua presença quando lho pedes e, se fores organizador ou auxiliar do grupo, criar ou cancelar jogos a teu pedido. Esses pedidos são tratados como feitos por ti.",
          "As respostas são geradas automaticamente com inteligência artificial e podem conter erros. Confirma na app a informação importante (horários, vagas, valores).",
        ],
        p2: [
          "O PITCH não é responsável por decisões tomadas com base em respostas automáticas incorretas, nem pelo que os membros do grupo escrevem no WhatsApp.",
        ],
      },
      {
        h: "8. Propriedade intelectual",
        p: [
          "O design, marca, código e conteúdo do PITCH (exceto o conteúdo que os utilizadores publicam) pertencem ao PITCH. Não podes copiar, distribuir ou criar produtos derivados sem autorização.",
        ],
      },
      {
        h: "9. Limitação de responsabilidade",
        p: [
          "O PITCH é fornecido “tal como está”. Não garantimos que a app esteja sempre disponível, livre de erros, ou que resolva disputas entre jogadores (dinheiro, comportamento, resultados de jogos). Na máxima medida permitida por lei, não somos responsáveis por danos indiretos resultantes do uso da app.",
        ],
      },
      {
        h: "10. Suspensão e eliminação de conta",
        p: [
          "Podes eliminar a tua conta a qualquer momento a partir do Perfil, ou contactando-nos. Podemos suspender contas que violem estes termos, com ou sem aviso prévio, consoante a gravidade.",
        ],
      },
      {
        h: "11. Alterações a estes termos",
        p: [
          "Podemos atualizar estes termos. Alterações relevantes serão comunicadas na app ou por email. O uso continuado do PITCH após uma alteração significa que aceitas os novos termos.",
        ],
      },
      {
        h: "12. Lei aplicável",
        p: [
          "Estes termos regem-se pela lei portuguesa. Qualquer litígio será submetido aos tribunais competentes do Porto.",
        ],
      },
      {
        h: "13. Contacto",
        p: ["Dúvidas sobre estes termos: vini@pitch-fc.com"],
      },
    ],
  },
};

/** Public legal page — /privacidade or /termos. Full width, no app shell,
 *  same dark brand treatment as LandingPage. Static content (see CONTENT
 *  above); keep in sync with docs/PRIVACY-POLICY.md and TERMS-OF-USE.md. */
export default function LegalPage({ type }) {
  const data = CONTENT[type];

  // The page renders client-side, after the browser's own #hash scroll
  // already ran — so jump to the section (e.g. /privacidade#cookies) ourselves.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, [type]);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text1, fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: `${C.bg}E6`, backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <img src={BRAND.logo} alt="PITCH App" style={{ height: 24 }} />
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 6, color: C.text2, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            <ArrowLeft size={15} /> Voltar
          </a>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px 80px" }}>
        <h1 style={{ ...displayFont, fontSize: "clamp(28px, 5vw, 40px)", margin: "0 0 8px" }}>{data.title}</h1>
        <div style={{ fontSize: 13, color: C.text3, marginBottom: 40 }}>PITCH · pitch-fc.com · {UPDATED}</div>

        {data.sections.map((s) => (
          <section key={s.h} id={s.id} style={{ marginBottom: 30, scrollMarginTop: 72 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: C.text1, margin: "0 0 10px" }}>{s.h}</h2>
            {s.p?.map((line, i) => (
              <p key={i} style={{ fontSize: 14, color: C.text2, lineHeight: 1.7, margin: "0 0 10px" }}>{line}</p>
            ))}
            {s.ul && (
              <ul style={{ margin: "0 0 10px", paddingLeft: 20 }}>
                {s.ul.map((item, i) => (
                  <li key={i} style={{ fontSize: 14, color: C.text2, lineHeight: 1.7, marginBottom: 6 }}>{item}</li>
                ))}
              </ul>
            )}
            {s.p2?.map((line, i) => (
              <p key={`p2-${i}`} style={{ fontSize: 14, color: C.text2, lineHeight: 1.7, margin: "0 0 10px" }}>{line}</p>
            ))}
            {s.action === "cookies" && analyticsConfigured() && (
              <BtnGhost onClick={openPreferences} style={{ marginTop: 6 }}>Gerir preferências de cookies</BtnGhost>
            )}
          </section>
        ))}

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
          <a href="/privacidade" style={{ fontSize: 13, color: type === "privacy" ? C.text1 : C.text2, textDecoration: "none", fontWeight: 700 }}>Política de Privacidade</a>
          <a href="/termos" style={{ fontSize: 13, color: type === "terms" ? C.text1 : C.text2, textDecoration: "none", fontWeight: 700 }}>Termos de Uso</a>
        </div>
      </div>
    </div>
  );
}
