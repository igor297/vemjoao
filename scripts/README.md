# Script de Inicialização do Banco de Dados

Este script cria toda a estrutura inicial do MongoDB para o sistema de condomínios.

## O que o script faz:

### 🔧 Estrutura Criada:
- **2 usuários Master** com credenciais específicas
- **4 condomínios** (2 para cada master)
- **10 moradores** distribuídos pelos condomínios
- **5 colaboradores** (porteiros, faxineiros, etc.)
- **Dados financeiros** (taxas de condomínio dos últimos 3 meses)

### 👤 Credenciais dos Masters:
- **Master 1**: `master@teste.com` | Senha: `>T8Nn7n_S8-T`
- **Master 2**: `master2@teste.com` | Senha: `>T8Nn7n_S8-T`

### 🏢 Condomínios Criados:

#### Master 1:
1. **Residencial Villa Bela** (São Paulo/SP)
   - Endereço: Rua das Flores, 123 - Vila Mariana
   - Taxa: R$ 450,00 - Vencimento: dia 10
   - Blocos A e B

2. **Edifício Solar dos Jardins** (São Paulo/SP)
   - Endereço: Alameda dos Anjos, 456 - Jardins
   - Taxa: R$ 680,00 - Vencimento: dia 15
   - Apartamentos numerados

#### Master 2:
1. **Condomínio Parque Verde** (Rio de Janeiro/RJ)
   - Endereço: Avenida das Américas, 789 - Barra da Tijuca
   - Taxa: R$ 520,00 - Vencimento: dia 5
   - Torre 1

2. **Residencial Águas Claras** (Rio de Janeiro/RJ)
   - Endereço: Rua Barata Ribeiro, 321 - Copacabana
   - Taxa: R$ 390,00 - Vencimento: dia 20
   - Apartamentos numerados

## 🚀 Como usar:

### Pré-requisitos:
- Node.js instalado
- MongoDB rodando (local ou remoto)
- Dependências do projeto instaladas (`npm install`)

### Executar o script:

```bash
# Executar com MongoDB local (padrão)
node scripts/init-database.js

# Executar com MongoDB remoto
MONGODB_URI="mongodb://usuario:senha@host:porta/database" node scripts/init-database.js

# Tornar executável e rodar
chmod +x scripts/init-database.js
./scripts/init-database.js
```

### Exemplo de saída:
```
🚀 Iniciando inicialização do banco de dados...
✅ Conectado ao MongoDB: mongodb://localhost:27017/condominiosistema
🧹 Limpando banco de dados...
✅ Banco de dados limpo
👤 Criando usuários master...
✅ 2 masters criados
🏢 Criando condomínios...
✅ 4 condomínios criados
👥 Criando moradores...
✅ 10 moradores criados
👷 Criando colaboradores...
✅ 5 colaboradores criados
💰 Criando dados financeiros...
✅ 30 lançamentos financeiros criados

📊 RESUMO DA INICIALIZAÇÃO:
👤 Masters: 2
🏢 Condomínios: 4
👥 Moradores: 10
👷 Colaboradores: 5
💰 Lançamentos Financeiros: 30

🔑 CREDENCIAIS DE ACESSO:
Master 1: master@teste.com | Senha: >T8Nn7n_S8-T
Master 2: master2@teste.com | Senha: >T8Nn7n_S8-T

✅ Inicialização concluída com sucesso!
```

## ⚠️ Importante:

- **O script LIMPA todo o banco de dados** antes de criar os novos dados
- Use apenas em ambiente de desenvolvimento/teste
- Certifique-se de ter backup dos dados importantes antes de executar
- As senhas são armazenadas em texto simples para testes

## 🔄 Executar novamente:

O script pode ser executado quantas vezes for necessário. Ele sempre:
1. Limpa todos os dados existentes
2. Recria toda a estrutura
3. Popula com dados de exemplo

## 📝 Personalização:

Para modificar os dados criados, edite o arquivo `scripts/init-database.js`:
- Altere as informações dos masters
- Modifique os dados dos condomínios
- Ajuste quantidade de moradores/colaboradores
- Personalize valores e datas dos lançamentos financeiros