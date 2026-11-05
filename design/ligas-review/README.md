# Prévia do redesign PITCH Ligas

Branch: codex/pitch-ligas-redesign · Base: 763e385.

Abrir: http://localhost:8202/?demo=1
Celular na mesma rede Wi-Fi: http://192.168.1.182:8202/?demo=1

A barra superior permite alternar entre Aplicação, Página pública, Gestão completa, Entrar/criar conta, Primeiros passos e Liga vazia. Os botões PC, Celular e 320 px mudam a largura do ecrã interno. Na Aplicação, «Ver como» troca entre Gestor, Capitão, Atleta e Adepto.

A prévia usa os componentes reais e dados fictícios. Alterações locais ficam no navegador. Convites, publicação e autenticação remota estão desligados. O fecho de época, a importação e os pedidos de atletas mantêm os contratos existentes.

Também é possível guardar e abrir index.html no Chrome. O logótipo e a fonte estão incorporados. A navegação em dispositivos que restrinjam ficheiros HTML locais deve ser feita pelo endereço na rede Wi-Fi.

Verificação: compilação da aplicação aprovada; 493 testes da aplicação, 209 do bot e 9 de integração visual aprovados. Painel no PC e classificação no PC/390 px foram inspecionados no Chrome na sessão anterior. A revisão visual completa das restantes telas e de um telefone físico ainda está pendente: o controlo do Chrome foi bloqueado por não conseguir confirmar o endereço da janela. Os testes de renderização não substituem essa inspeção.

Ainda não foi publicado nem integrado em main. O cadastro/login do adepto para Fantasy e um blog com artigos próprios continuam como desenvolvimento funcional separado; esta entrega redesenha os avisos/comunicados e a inscrição de interesse no Fantasy já existentes.
