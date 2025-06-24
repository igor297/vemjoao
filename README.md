# 🏢 Sistema de Gestão de Condomínios

Sistema completo para gestão de condomínios desenvolvido com Next.js 15, MongoDB e React Bootstrap.

## 🚀 Funcionalidades

### 👥 **Gestão de Colaboradores**
- Cadastro e controle de colaboradores
- Gestão financeira (salários, bônus, benefícios)
- Sincronização automática com financeiro do condomínio

### 🏠 **Gestão de Moradores**
- Cadastro de moradores por unidade
- Controle de taxas e boletos
- Integração com financeiro

### 💰 **Sistema Financeiro**
- **Financeiro Colaborador**: Salários, bônus, descontos
- **Financeiro Morador**: Taxas, multas, receitas
- **Financeiro Condomínio**: Visão consolidada automática
- Relatórios e dashboards interativos

### 🔐 **Controle de Acesso**
- **Master**: Controle total do sistema
- **Síndico**: Gestão completa do condomínio
- **Subsíndico**: Gestão com restrições
- **Conselheiro**: Visualização de relatórios
- **Colaborador**: Acesso aos próprios dados

## 🛠️ Tecnologias

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: React Bootstrap, Chart.js
- **Backend**: Next.js API Routes
- **Database**: MongoDB com Mongoose
- **Deploy**: Railway

## 📦 Instalação

1. **Clone o repositório**
```bash
git clone [seu-repositorio]
cd vemjoao
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env.local
```

Edite o `.env.local` com suas configurações do MongoDB.

4. **Execute o projeto**
```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## 🌐 Deploy no Railway

### Pré-requisitos
- ✅ Conta no [Railway](https://railway.com)
- ✅ MongoDB configurado no Railway

### 🚀 Passo a Passo para Deploy

#### 1. **Conectar Repositório GitHub**
1. Acesse [Railway.app](https://railway.app)
2. Clique em "Start a New Project"
3. Selecione "Deploy from GitHub repo"
4. Escolha o repositório: `igor297/vemjoao`

#### 2. **Configurar MongoDB no Railway**
1. No dashboard do Railway, clique em "+ New"
2. Selecione "Database" → "MongoDB"
3. Aguarde a criação e anote as credenciais

#### 3. **✅ CONFIGURAÇÃO 100% AUTOMÁTICA** 
🎉 **NÃO PRECISA CONFIGURAR NADA MANUALMENTE!**

O projeto já está configurado com:
- ✅ Credenciais do MongoDB Railway atualizadas
- ✅ Variáveis de ambiente automáticas via `railway.toml`
- ✅ Configuração de produção vs desenvolvimento
- ✅ Detecção automática de ambiente (local/Railway)

**Arquivos configurados:**
```bash
railway.toml          # Configuração automática Railway
next.config.ts        # Configuração Next.js
src/lib/mongodb.ts    # Conexão automática MongoDB
```

#### 4. **Deploy Automático**
- ✅ A cada push na branch `main`, o deploy acontecerá automaticamente
- ✅ Railway detectará automaticamente que é um projeto Next.js
- ✅ Build e start serão executados automaticamente

#### 5. **Verificar Deploy**
1. Aguarde o build finalizar (5-10 minutos)
2. Acesse a URL fornecida pelo Railway
3. Teste o login e funcionalidades

### 🔧 Comandos de Deploy
```bash
# Fazer deploy manual (push para main)
git add .
git commit -m "Deploy para Railway"
git push origin main
```

### 📊 Monitoramento
- **Logs**: Railway Dashboard → Deploy Logs
- **Métricas**: Railway Dashboard → Metrics
- **Banco**: Railway Dashboard → MongoDB → Connect

### ❌ Solução de Problemas

#### Erro: "MONGODB_URI não definido"
```bash
# Verificar se a variável está configurada no Railway Dashboard
MONGODB_URI=mongodb://mongo:password@mongodb.railway.internal:27017/database
```

#### Erro: "Cannot connect to MongoDB"
1. Verificar se MongoDB está rodando no Railway
2. Verificar string de conexão
3. Verificar se database existe

#### Build falha
1. Verificar logs no Railway Dashboard
2. Verificar dependências no package.json
3. Executar `npm run build` localmente

## 📊 Arquitetura

### Collections MongoDB
- `masters` - Usuários master
- `condominios` - Dados dos condomínios
- `colaboradors` - Colaboradores
- `moradors` - Moradores
- `financeirocolaboradors` - Lançamentos de colaboradores
- `financeiro-moradores` - Lançamentos de moradores
- `financeiro-condominio` - Consolidação automática

### Sincronização Automática
- Lançamentos de colaboradores → Despesas no condomínio
- Lançamentos de moradores → Receitas no condomínio
- Sistema de hash para evitar duplicatas
- Rastreabilidade completa da origem

## 🔄 Scripts Disponíveis

```bash
npm run dev          # Desenvolvimento
npm run build        # Build para produção
npm run start        # Execução em produção
npm run lint         # Linting do código
npm run seed:master  # Criar usuário master inicial
```

## 📱 Responsividade

- ✅ Desktop
- ✅ Tablet
- ✅ Mobile
- Interface adaptativa com React Bootstrap

## 🛡️ Segurança

- Autenticação baseada em sessão
- Controle granular de permissões
- Validação de dados server-side
- Sanitização de inputs
- Logs de auditoria

## 📈 Performance

- Connection pooling otimizado MongoDB
- Caching de componentes React
- Lazy loading de rotas
- Compressão de assets

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.
