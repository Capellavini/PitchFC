# Ligas: identidade e prévia de confrontos

Base: origin/main em 52faad9. Cópia isolada; nenhuma alteração na checkout principal ou no banco em produção.

## Alteração

- Página da liga apresenta emblema/monograma, nome curto, descrição e cor sobre o visual Pitch.
- Proprietário/gestor dispõe de editor com prévia. Usa `update_league` existente; não altera visibilidade, slug, estado ou permissões.
- URLs de emblema aceitam apenas HTTPS sem credenciais. Falha de carregamento usa monograma. Campos seguem limites existentes.
- Espelho local devolve os campos de identidade na projeção da página.
- Geração de pontos corridos mostra equipes, rodadas e confrontos antes da confirmação. Ida e volta usa o gerador existente; mudar a configuração invalida a prévia. Agendamento permanece separado.
- Novos textos em PT-PT, PT-BR e inglês.

## Verificação

- 36 testes selecionados de ligas passaram, incluindo casos novos de URL inválida, payload sem alteração de visibilidade e persistência da identidade no espelho local.
- Compilação de produção passou. Permanece aviso de bundle grande existente na aplicação.
- Um teste automatizado de interface local parou na identificação do campo de descrição; o campo recebeu `aria-label` explícito. O teste não foi concluído.
- A abertura da prévia local pelo navegador conectado foi bloqueada pela política de URL para `file:`; não foi tentado contorno. Revisão visual dos novos componentes permanece pendente.
- Sem migrações, uploads, publicação, compras ou mensagens externas.

## Limites

Não implementa retirada da marca Pitch, domínio próprio, patrocinadores, grupos/eliminatórias, cadastro em lote, pagamentos nem Copilot real. Não é certificado de produto completo. O recurso existente de pontos corridos continua responsável por validar e criar confrontos no servidor.

## Revisão sugerida

1. Abrir uma liga privada de teste como gestor, editar identidade e verificar que o endereço e a visibilidade não mudam.
2. Entrar como público autorizado: identidade disponível e editor ausente.
3. Testar emblema inválido e campos vazios; remover emblema e conferir monograma.
4. Em competição de teste sem jogos, comparar prévia de quatro equipes em uma volta (6 jogos) e ida/volta (12); conferir que abrir prévia não grava.
5. Confirmar geração, recarregar e verificar confrontos e ausência de duplicação.
6. Rever larguras 320/390 px e os três idiomas.

Manter o aceite humano antes da publicação. Nenhum contato com Claude realizado.
