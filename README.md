# Class Points

Crie uma aplicação web responsiva (Mobile-First) em React e Tailwind CSS integrada com MongoDB, voltada para gamificação escolar e presença, com dois perfis de acesso: PROFESSOR e ALUNO.

--- 1. AUTENTICAÇÃO E PERFIS ---

- Tela de Login e Cadastro simples com E-mail e Senha.

- Seleção de Perfil no cadastro: "Professor" ou "Aluno".

- O layout deve ser limpo, moderno, responsivo para celular e computador.

--- 2. PAINEL DO PROFESSOR (ROLE: TEACHER) ---

A) Módulo de Chamada e Gamificação (Baseado no sistema de pontuação):

- Lista de alunos da turma com botões de ação rápida para aplicar pontos com um clique:

  • Presença (+10)

  • Pontualidade (+10)

  • Atraso (-5)

  • Falta Não Justificada (-10)

  • Trazer Visitante (+50)

  • Trazer Bíblia (+20) / Não Trazer Bíblia (-30)

  • Trazer Revista (+20) / Não Trazer Revista (-30)

  • Entrega de Atividades no Prazo (+20) / Com Atraso (+5)

  • Pontualidade Geral (+30)

  • Destaque do Mês (+40)

- Extrato do lançamento com histórico da turma.

B) Módulo de Criar Perguntas / Quizzes:

- Criar formulários interativos com título, prazo e valor de pontuação.

- Adicionar perguntas de múltipla escolha.

- Painel para ver as respostas individuais de cada aluno em tempo real.

--- 3. PAINEL DO ALUNO (ROLE: STUDENT) ---

A) Dashboard Gamificado:

- Exibir em destaque no topo o SALDO TOTAL DE PONTOS do aluno e seu nível/badge atual.

- Extrato estilo histórico mostrando exatamente onde ganhou ou perdeu pontos.

- Card/Tabela responsiva explicando a tabela de regras de pontuação da sala.

B) Central de Tarefas e Perguntas:

- Lista de perguntas/quizzes liberados pelo professor.

- Interface interativa estilo quiz (responder uma pergunta por vez, com boa experiência mobile).

- Ao enviar, o aluno recebe o feedback da pontuação e os pontos são creditados no saldo dele.

--- 4. ESTRUTURA DO BANCO DE DADOS (MONGODB / BACKEND) ---

Crie os schemas/collections para:

1. `Users` (id, name, email, password, role, totalPoints)

2. `PointsHistory` (id, studentId, type, points, date, registeredBy)

3. `Quizzes` (id, title, dueDate, questions:[{id, statement, options, correctOption, points}])

4. `Submissions` (id, quizId, studentId, answers, scoreObtained, submittedAt)

Capriche nas animações de feedback visual (ex: confetes ou aviso de pontos quando o aluno acerta uma pergunta ou ganha pontos).

faça um modelo bem elegante e não seja poluente pra que veja

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/35b29bf7-e181-48d8-b6dd-3af2a57be52d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
