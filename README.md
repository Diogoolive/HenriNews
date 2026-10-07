# HenriNews — versão Supabase

Esta versão troca os dados simulados em `localStorage` por um banco PostgreSQL no Supabase, com autenticação real e Row Level Security (RLS).

## Arquivos

- `index.html` — interface do HenriNews.
- `style.css` — estilos adicionais.
- `script.js` — integração com Supabase Auth e banco de dados.
- `database.sql` — cria tabelas, políticas RLS, funções e dados iniciais.

## O que já está funcionando

- Cadastro de aluno com e-mail e senha pelo Supabase Auth.
- Login e logout reais.
- Recuperação e alteração de senha.
- Perfis com papéis `student` e `admin`.
- Notícias publicadas e rascunhos.
- Salvar notícia para ler depois por usuário.
- Biblioteca com disponibilidade de exemplares.
- Solicitação de empréstimo com voucher e prazo de 30 dias.
- Área "Meus Empréstimos".
- Registro de devolução pelo gestor.
- Enquetes com 2 a 5 opções e um voto por usuário.
- Perguntas de suporte gravadas no banco.
- Painel administrativo protegido por RLS.

## 1. Criar o projeto Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**.
3. Cole todo o conteúdo de `database.sql`.
4. Execute o script.

O SQL cria as tabelas `profiles`, `articles`, `article_saves`, `books`, `loans`, `polls`, `poll_options`, `poll_votes` e `help_questions`, além das políticas RLS e funções necessárias.

## 2. Configurar o script.js

No Supabase, abra as configurações da API do projeto e copie:

- Project URL
- Publishable key (ou anon key, em projetos que ainda usam esse nome)

Depois abra `script.js` e substitua:

```js
const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'COLE_SUA_PUBLISHABLE_OU_ANON_KEY_AQUI';
```

Não use a chave `service_role` no navegador.

## 3. Criar o primeiro administrador

O site não permite que alguém marque "sou administrador" durante o cadastro. Isso é proposital.

1. Abra o HenriNews e cadastre a conta do gestor normalmente.
2. Confirme o e-mail, caso a confirmação de e-mail esteja habilitada.
3. Volte ao SQL Editor do Supabase e execute:

```sql
update public.profiles
set role = 'admin'
where email = 'gestor@escola.com';
```

Troque o e-mail pelo e-mail real do gestor.

## 4. Configurar recuperação/confirmação de e-mail

No Supabase Auth, configure a URL do site e os Redirect URLs.

Durante o desenvolvimento com a extensão Live Server do VS Code, adicione o endereço usado pelo navegador, por exemplo:

```text
http://127.0.0.1:5500/**
```

Quando publicar o projeto, adicione também o domínio final do HenriNews.

## 5. Rodar no VS Code

Não abra apenas clicando duas vezes no `index.html`. Use um servidor local.

Uma opção simples é a extensão **Live Server** no VS Code:

1. Abra a pasta `henrinews_supabase` no VS Code.
2. Abra `index.html`.
3. Inicie com Live Server.
4. Teste cadastro, login, notícias, biblioteca e enquetes.

## Segurança

As permissões importantes estão no banco de dados, não apenas escondidas na interface. As políticas RLS impedem, por exemplo, que um aluno publique notícias ou altere dados administrativos apenas manipulando o JavaScript do navegador.

O Supabase Auth é responsável pelo armazenamento seguro das credenciais. O HenriNews não grava senhas em tabelas próprias.

## Implantação

Por ser um front-end estático, a pasta pode ser publicada em serviços de hospedagem estática. Depois da publicação, atualize os Redirect URLs do Supabase Auth para o domínio definitivo.
