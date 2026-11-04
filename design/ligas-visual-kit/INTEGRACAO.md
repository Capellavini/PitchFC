# PITCH — preparação do redesign em paralelo

Estado: preparação isolada; ainda não integrada ao aplicativo. A base já foi confirmada pelo alinhamento com Claude: `Capellavini/PitchFC`, commit `763e385`. Foi criada a branch `codex/pitch-ligas-redesign` na cópia `work/pitch-ligas-redesign` deste workspace.

## Direção aprovada

Referência visual: Arquibancada refinada, no protótipo `pitch-arquibancada-refinada.html` desta conversa.

- Gestão: navy/preto PITCH e verde-lima. A cor de marca identificada na cópia local é **#C8FF00**; a implementação deve usar esse token oficial, consolidando a pequena diferença dos protótipos.
- Pública: base clara, identidade da liga contratante, linguagem própria PITCH e foco no acompanhamento esportivo.
- Futebol: marcações de campo, placares, emblemas, camisola e bandeirolas como detalhes funcionais/decorativos contidos. Nenhuma informação depende apenas dessas formas ou da cor.
- Corpo de texto legível, nomes reconhecíveis, pontos visíveis no celular e tarefas agrupadas.
- Escopo confirmado: somente o **PITCH Ligas**, em todos os seus perfis e estados, PC e celular. Não abrange o restante do produto PITCH. Fantasy e blog entram apenas como experiências vinculadas à liga. A fase seguinte deve confirmar a lista de módulos de Ligas na base atual.

## Entregas já preparadas

- `pitch-tokens.css`: variáveis visuais com aplicação voluntária e temas separados de app e página pública. Não contém seletores globais nem foi importado no app.
- `pitch-tokens.mjs`: constantes de marca/layout e geração de paleta pública a partir da cor de uma liga. Seleciona texto claro/escuro por contraste e escurece a cor de links quando necessário.
- `COBERTURA.md`: mapa inicial de telas, componentes e verificações.
- `components/`: 20 componentes React de apresentação, em arquivos separados, com estilos próprios de Ligas.
- `preview/`: galeria com dados fictícios e versão HTML autocontida produzida pelo build.
- `COMPONENTES.md`: contrato da camada visual, instruções de compilação e limites das verificações.

Os tamanhos, raios e fontes são pontos iniciais extraídos da direção visual, sujeitos à integração com os componentes reais. Os arquivos não constituem um build do redesign.

## Evidência local e limite

Foi lida apenas como referência a cópia `output/pitch-ligas-tournify-build`. Ela usa React 18, Vite 6, Lucide React e tokens em `src/theme.js`. O estado observado foi HEAD separado, commit `52faad9`, com diversas alterações locais não commitadas. Não há evidência de que seja a cópia atual do Claude ou a versão de produção.

Essa cópia não foi modificada. Posteriormente, o usuário trouxe a base definitiva do Claude; a nova cópia isolada foi criada em `763e385`. O `origin/main` observado já apontava para `1c61c68`, por isso a preparação permaneceu fixada no commit explicitamente indicado.

## Compatibilidade que precisa ser preservada

Na cópia lida, `C` em `src/theme.js` é um objeto mutável. Há componentes que concatenam transparência hexadecimal aos valores, por exemplo `C.red + "44"`. Substituir indiscriminadamente os valores por referências CSS quebraria esse padrão.

A integração deverá preservar a API de `C` para os componentes existentes e introduzir variáveis semânticas nas superfícies migradas, ou fazer uma migração explícita de cada consumidor. Os tokens deste pacote não devem substituir o arquivo global diretamente.

A página comercial `/league`, a página pública de uma liga e a área autenticada são superfícies diferentes. Na cópia local, `src/components/LeaguePage.jsx` é a página comercial: não presumir que seja a página pública de `/leagues/<slug>`.

## Divisão sugerida

Codex: tema, tipografia, espaçamento, componentes visuais, navegação responsiva, telas e estados visuais, integração e verificação final do redesign.

Claude: concluir as features em andamento e informar os arquivos e contratos afetados. Confirmar explicitamente quem assume funcionalidades novas de blog/anúncios e cadastro/login/Fantasy.

Arquivos compartilhados que exigem coordenação: tema global, estilos globais, navegação/rotas, shells, autenticação, página pública e componentes compartilhados usados pelas features.

## Sequência de integração

1. Receber caminho do repositório, remoto, branch, commit-base, alterações locais e escopo atual do Claude.
2. Registrar o estado existente sem alterar ou descartar trabalho em andamento.
3. Criar cópia de trabalho/branch isolada a partir da base acordada. Não usar snapshots antigos como base implícita.
4. Mapear as telas e consumidores de tema na base atual; reconciliar com `COBERTURA.md`.
5. Integrar tokens e componentes primitivos antes de migrar páginas. Manter contratos funcionais.
6. Migrar gestão, capitão, atleta, adepto, página pública e autenticação vinculada a Ligas em blocos revisáveis. Componentes compartilhados precisam de isolamento para não mudar a aparência dos demais produtos PITCH.
7. Integrar as features do Claude; resolver conflitos com contexto de ambos os trabalhos e executar as verificações aplicáveis.
8. Revisar PC e celular, papéis, formulários, estados e fluxos completos. Só considerar “100%” quando todo o mapa acordado estiver verificado.

Publicação, merge e mudanças de produção não foram executados nesta preparação.

## Novas funções da página pública

### Adepto e Fantasy

Prever entrada pública, criar conta, login, recuperação de senha, retorno ao ponto de origem e área pessoal/Fantasy. A implementação precisa verificar o backend disponível, o vínculo conta–liga, permissões e contratos; existência de componentes de Fantasy na cópia antiga não comprova integração funcional atual.

### Blog e anúncios

Prever listagem pública, artigo individual, categorias de conteúdo, imagens, homenagens, avisos e resumos. Na gestão: criar/editar, rascunho, pré-visualizar, publicar e fixar. Persistência, permissões, upload, conteúdo seguro e eventual migração precisam ser definidos com quem assume a feature. Não apresentar esses comportamentos como existentes apenas porque aparecem num protótipo.
