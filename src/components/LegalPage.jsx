import { ArrowLeft } from "lucide-react";
import { C, displayFont, BRAND } from "../theme";

// Static content for both legal pages — kept in JSX rather than fetched
// markdown so there's no extra request/parsing on a page that should load
// instantly. Source of truth for the *drafting* of this text is
// docs/PRIVACY-POLICY.md and docs/TERMS-OF-USE.md in the repo; keep both
// in sync if the wording changes.
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
          "Contacto: número de telemóvel (usado também para identificar pagamentos por MB Way entre jogadores).",
          "Atividade no jogo: confirmações/recusas de presença, pagamentos marcados como feitos, golos, assistências, votos de MVP, histórico de jogos.",
          "Conteúdo que publicas: fotos, vídeos e comentários que partilhas no feed social.",
          "Dados técnicos: idioma escolhido, preferências guardadas no teu dispositivo (localStorage), e dados de utilização básica da app.",
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
          "Enviar lembretes e notificações sobre o teu jogo (incluindo via WhatsApp, quando aplicável — Pitch AI)",
          "Melhorar a app e perceber como é usada",
          "Cumprir obrigações legais",
        ],
      },
      {
        h: "4. Base legal (RGPD)",
        p: ["Tratamos os teus dados com base em:"],
        ul: [
          "Execução de um contrato — precisamos dos teus dados para te dar acesso à app e às suas funcionalidades.",
          "Consentimento — para conteúdo opcional que partilhas (fotos, posts) e comunicações não essenciais.",
          "Interesse legítimo — para segurança, prevenção de abuso e melhoria do serviço.",
        ],
      },
      {
        h: "5. Com quem partilhamos dados",
        p: ["Não vendemos os teus dados a ninguém. Partilhamos apenas com:"],
        ul: [
          "Supabase (alojamento da base de dados e autenticação, servidores na UE)",
          "Vercel (alojamento da aplicação web)",
          "Resend (envio de emails transacionais, ex. confirmação de conta)",
          "WhatsApp/Meta, apenas nas mensagens que o Pitch AI envia ou recebe no teu grupo, se o teu grupo usar essa funcionalidade",
          "Autoridades, quando exigido por lei",
        ],
      },
      {
        h: "6. Quanto tempo guardamos os teus dados",
        p: [
          "Guardamos os teus dados enquanto a tua conta estiver ativa. Se pedires a eliminação da conta, apagamos os teus dados pessoais no prazo de 30 dias, exceto o que formos legalmente obrigados a manter.",
        ],
      },
      {
        h: "7. Os teus direitos",
        p: ["Ao abrigo do RGPD, tens direito a:"],
        ul: [
          "Aceder aos dados que temos sobre ti",
          "Corrigir dados incorretos",
          "Pedir a eliminação da tua conta e dados",
          "Pedir a portabilidade dos teus dados",
          "Opor-te a determinados tratamentos",
          "Retirar o consentimento a qualquer momento",
        ],
        p2: [
          "Para exercer qualquer um destes direitos, contacta vini@pitch-fc.com. Tens também o direito de apresentar queixa junto da Comissão Nacional de Proteção de Dados (CNPD).",
        ],
      },
      {
        h: "8. Menores de idade",
        p: [
          "O PITCH pode ser usado a partir dos 13 anos, idade mínima de consentimento digital em Portugal (Lei n.º 58/2019). O produto é pensado para grupos de futebol amador organizados por um adulto (o organizador do grupo); recomendamos que jogadores menores de 18 anos usem a app com conhecimento de um encarregado de educação.",
        ],
      },
      {
        h: "9. Segurança",
        p: [
          "Usamos medidas técnicas e organizativas razoáveis (encriptação em trânsito, autenticação segura, controlo de acesso por grupo) para proteger os teus dados. Nenhum sistema é 100% seguro — se detetarmos uma violação de dados que te afete, iremos notificar-te nos termos da lei.",
        ],
      },
      {
        h: "10. Alterações a esta política",
        p: ["Podemos atualizar esta política. Alterações relevantes serão comunicadas na app ou por email."],
      },
      {
        h: "11. Contacto",
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
          "Ao criar uma conta no PITCH, aceitas estes Termos de Uso e a nossa Política de Privacidade. Se não concordares, não uses a app.",
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
        h: "7. Propriedade intelectual",
        p: [
          "O design, marca, código e conteúdo do PITCH (exceto o conteúdo que os utilizadores publicam) pertencem ao PITCH. Não podes copiar, distribuir ou criar produtos derivados sem autorização.",
        ],
      },
      {
        h: "8. Limitação de responsabilidade",
        p: [
          "O PITCH é fornecido “tal como está”. Não garantimos que a app esteja sempre disponível, livre de erros, ou que resolva disputas entre jogadores (dinheiro, comportamento, resultados de jogos). Na máxima medida permitida por lei, não somos responsáveis por danos indiretos resultantes do uso da app.",
        ],
      },
      {
        h: "9. Suspensão e eliminação de conta",
        p: [
          "Podes eliminar a tua conta a qualquer momento a partir do Perfil, ou contactando-nos. Podemos suspender contas que violem estes termos, com ou sem aviso prévio, consoante a gravidade.",
        ],
      },
      {
        h: "10. Alterações a estes termos",
        p: [
          "Podemos atualizar estes termos. Alterações relevantes serão comunicadas na app ou por email. O uso continuado do PITCH após uma alteração significa que aceitas os novos termos.",
        ],
      },
      {
        h: "11. Lei aplicável",
        p: [
          "Estes termos regem-se pela lei portuguesa. Qualquer litígio será submetido aos tribunais competentes do Porto.",
        ],
      },
      {
        h: "12. Contacto",
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
        <div style={{ ...displayFont, fontSize: "clamp(28px, 5vw, 40px)", marginBottom: 8 }}>{data.title}</div>
        <div style={{ fontSize: 13, color: C.text3, marginBottom: 40 }}>PITCH · pitch-fc.com</div>

        {data.sections.map((s) => (
          <div key={s.h} style={{ marginBottom: 30 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text1, marginBottom: 10 }}>{s.h}</div>
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
          </div>
        ))}
      </div>
    </div>
  );
}
