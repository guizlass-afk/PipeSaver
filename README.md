# PipeSaver

Aplicação web para gerar o plano de corte completo de um projeto com tubos, barras e perfis de várias seções. Todo o cálculo e a leitura das planilhas acontecem no navegador; os dados não são enviados para um servidor.

Aplicação publicada: [guizlass-afk.github.io/PipeSaver](https://guizlass-afk.github.io/PipeSaver/)

## Recursos

- vários perfis/seções no mesmo estudo, cada um com material, geometria e dimensões próprios;
- lista de barras disponíveis relacionada aos perfis cadastrados;
- vários comprimentos e quantidades de barra para o mesmo perfil;
- opção de priorizar barras específicas, ideal para consumir retalhos antes das barras de prateleira;
- espessura de corte (*kerf*) configurável para o estudo;
- lista de peças em que cada medida seleciona o perfil correspondente;
- modelo Excel de projeto completo para download e importação de `.xlsx`, `.xls` e `.csv`;
- salvamento do formulário preenchido em Excel para interromper e retomar projetos grandes sem perder dados;
- mapa visual separado por perfil e agrupamento de padrões de corte repetidos;
- consolidação de barras, peças, aproveitamento, perda de corte e sobra do projeto inteiro;
- exportação detalhada do resultado para Excel e versão preparada para impressão.

## Como usar

1. Abra `index.html` em um navegador moderno.
2. No bloco **Arquivo do projeto**, baixe o modelo para começar por Excel ou importe um projeto salvo anteriormente.
3. Em **Perfis do projeto**, cadastre cada seção uma única vez. Os nomes `Perfil 1`, `Perfil 2` etc. podem ser editados.
4. Em **Barras disponíveis**, escolha o perfil de cada linha e informe o comprimento e a quantidade existente. Marque **Priorizar** quando aquela barra deve ser consumida antes das demais.
5. Informe a espessura consumida pela ferramenta de corte.
6. Em **Peças desejadas**, selecione o perfil de cada medida e informe identificação, comprimento final e quantidade.
7. Use **Salvar projeto preenchido** a qualquer momento para baixar uma planilha com todo o formulário, inclusive linhas ainda incompletas. Importe o mesmo arquivo para continuar depois.
8. Clique em **Gerar plano de corte**, confira o mapa separado por perfil e exporte o relatório Excel.

Na aba `Perfis`, cadastre uma única linha para cada seção:

| Coluna | Conteúdo |
|---|---|
| `Perfil` | Nome que relaciona seção, estoque e peças |
| `Material` | Material do perfil |
| `Tipo_secao` | Tubo redondo, tubo quadrado, tubo retangular, barra redonda, barra chata, cantoneira ou outro perfil |
| `Diametro_mm` | Diâmetro de tubos ou barras redondas |
| `Lado_mm` | Lado do tubo quadrado |
| `Largura_mm` | Largura de tubos retangulares e barras chatas |
| `Altura_mm` | Altura do tubo retangular |
| `Aba_A_mm` | Primeira aba da cantoneira |
| `Aba_B_mm` | Segunda aba da cantoneira |
| `Espessura_mm` | Espessura da seção, quando aplicável |
| `Descricao_secao` | Descrição livre para outro perfil |

Na aba `Barras`:

| Coluna | Conteúdo |
|---|---|
| `Perfil` | Nome exato do perfil cadastrado na aba `Perfis` |
| `Comprimento_barra_mm` | Comprimento bruto disponível |
| `Quantidade` | Quantidade existente desse comprimento |
| `Priorizar` | `Sim` para consumir essas barras antes das demais; `Não` para otimização normal |

Na aba `Cortes`:

| Coluna | Conteúdo |
|---|---|
| `Perfil` | Nome exato do perfil cadastrado na aba `Perfis` |
| `Identificacao` | Código ou nome da peça |
| `Comprimento_mm` | Comprimento final em milímetros |
| `Quantidade` | Número inteiro de peças |
| `Observacao` | Opcional; não interfere no cálculo |

As observações são preservadas quando um arquivo é importado e salvo novamente. Planilhas antigas contendo apenas a aba `Cortes` continuam aceitas; nesse caso, as medidas são importadas para o perfil que está aberto na tela.

Na aba `Configuracoes`, informe `Nome_projeto` e `Espessura_corte_mm`.

## Regra da espessura de corte

O PipeSaver aplica uma perda igual à espessura da ferramenta entre peças consecutivas na mesma barra. Quando existe retalho depois da última peça, também considera o corte que separa esse retalho. Assim, duas peças de 3.000 mm não cabem juntas em uma barra de 6.000 mm quando a ferramenta remove material. Uma peça com exatamente 6.000 mm, por outro lado, utiliza a barra inteira sem corte.

O aproveitamento considera somente o comprimento útil das peças. A perda da ferramenta e o retalho remanescente são calculados separadamente.

## Estratégia de otimização

Cada seção é tratada de forma independente como um problema de *one-dimensional cutting stock/bin packing*. O programa:

1. transforma comprimentos e espessura de corte em uma capacidade equivalente;
2. consome primeiro as barras marcadas como prioritárias sempre que houver peças compatíveis;
3. compara as barras de comprimentos e disponibilidades diferentes;
4. executa *best-fit decreasing*, estratégias de escolha de estoque e centenas de ordenações determinísticas;
5. depois de atender às prioridades, minimiza o comprimento bruto total consumido e a quantidade de barras;
6. em soluções equivalentes, concentra a sobra para produzir retalhos maiores e mais reaproveitáveis;
7. para listas menores com um único comprimento de barra, realiza uma busca exata com poda e limite de tempo.

O algoritmo é heurístico em listas grandes e em estoques mistos. Quando um perfil possui um único tamanho de barra e a solução alcança o limite inferior calculado pela capacidade total, a interface informa que o mínimo matemático foi atingido.

## Arquivos

- `index.html`: estrutura da interface;
- `styles.css`: identidade visual e layout responsivo;
- `app.js`: importação, otimização, visualização e exportação;
- `vendor/xlsx.full.min.js`: SheetJS Community Edition 0.20.3;
- `tests/browser-tests.html`: testes locais do algoritmo e da interface.

## Dependência de terceiros

[SheetJS Community Edition](https://docs.sheetjs.com/) 0.20.3 é usada para ler e gerar planilhas no navegador. O arquivo foi mantido localmente conforme a recomendação oficial de *vendoring*, evitando dependência do CDN durante o uso.
