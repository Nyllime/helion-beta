# Helion — versão oficial

Publicação unificada de 21/10/2026 no endereço principal: https://nyllime.github.io/helion-beta/.

Esta publicação mantém a base atual e incorpora as melhorias da segunda versão.

- Agenda e Bloco de notas no canto inferior direito, com retorno ao módulo anterior pelo ×; visitas, rota diária, coordenadas e notas vinculadas ao cliente continuam disponíveis.
- Projetos com catálogo por produto/grupo/conjunto, biblioteca de arquivos, gestão de modelos, serviços e gastos, ajustes gerais e gráficos financeiros. Arquivos DWG/DXF são preservados para download no formato original.
- Histórico de desfazer/refazer e recuperação local de projetos, com sincronização automática e tratamento de autorização de descontos.
- Orçamentos em etapas: dados, materiais e revisão; edição de propostas já geradas a partir de projetos mantém a planilha completa.
- Tabelas com filtros e ordenação por coluna, contagem de itens/unidades e abertura de módulos em outra aba.
- Relatório contábil com seleção de colunas, exportação e escolha de inclusão dos lançamentos; alteração da classificação não muda valores nem repete pagamentos.
- Identidade da empresa e cores de impressão, nomes completos e seleção de responsáveis conforme a função.
- Assinaturas eletrônicas por link, consultas de preços e importações da base atual foram preservadas.
- Menu do usuário com “Instalar / criar atalho”, incluindo download de Helion.url para Windows.

## Verificação

Testes de regressão cobriram cálculos, escopo de descontos, coordenadas, vínculos de notas, arquivos DWG/DXF, assinatura, quantidades dos modelos, contagem após filtros, recuperação de projetos e fila de salvamento. O navegador foi testado com banco simulado para os fluxos de navegação, projeto, orçamento e atalho.

A mudança de classificação contábil foi testada no banco com registros sintéticos e rollback completo: autorização de Gestor e empresa, idempotência, preservação dos valores e ausência de pagamentos duplicados.

Para executar o teste da publicação: `node tests/official-release.cjs`.

O acesso e a sincronização dos registros exigem conexão com a internet. Arquivos de projeto têm limite de 10 MB por arquivo. Esta publicação não altera os dados reais da empresa.
