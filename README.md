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
- **Deploy**: Localhost/Production

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

## 🌐 Deploy

### ✅ **Configuração para Produção**

Configure as variáveis de ambiente no seu provedor de hosting:

```bash
MONGODB_URI=sua_string_de_conexao_mongodb
MONGODB_DB=condominio-sistema
NODE_ENV=production
```

### 🎯 **Auto-Seed em Produção**

- ✅ Dados de teste são criados automaticamente em produção
- ✅ **Master**: master@teste.com | Senha: 123456
- 🏢 Condomínio de teste: "Residencial Teste Produção"
- 👥 Moradores e lançamentos financeiros de exemplo

### 🛠️ **Troubleshooting**

Verifique se as variáveis de ambiente estão configuradas:
```bash
echo $MONGODB_URI
echo $NODE_ENV
```

**Problemas comuns:**
1. Verificar string de conexão do MongoDB
2. Confirmar se o database existe
3. Executar `npm run build` localmente para testar

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
