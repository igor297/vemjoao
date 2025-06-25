import mongoose from 'mongoose'

// Configuração automática para Railway vs Local
const getMongoURI = () => {
  console.log('🔍 [MongoDB] Detectando ambiente...')
  console.log('🔍 [MongoDB] PORT:', process.env.PORT)
  console.log('🔍 [MongoDB] RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT)
  console.log('🔍 [MongoDB] NODE_ENV:', process.env.NODE_ENV)
  
  // Se estiver no Railway (detectar pela porta 8080 ou variável de ambiente)
  const isRailway = process.env.PORT === '8080' || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production'
  console.log('🔍 [MongoDB] É Railway?', isRailway)
  
  if (isRailway) {
    console.log('🔍 [MongoDB] Usando configuração Railway/Produção')
    console.log('🔍 [MongoDB] MONGODB_URI disponível?', !!process.env.MONGODB_URI)
    console.log('🔍 [MongoDB] MONGO_URL disponível?', !!process.env.MONGO_URL)
    console.log('🔍 [MongoDB] MONGO_PUBLIC_URL disponível?', !!process.env.MONGO_PUBLIC_URL)
    
    // MongoDB Railway interno para produção
    const uri = process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL || 'mongodb://localhost:27017/condominio-sistema'
    console.log('🔍 [MongoDB] URI selecionada:', uri.substring(0, 50) + '...')
    return uri
  }
  
  console.log('🔍 [MongoDB] Usando configuração Local/Desenvolvimento')
  // Se estiver em desenvolvimento local, usar MongoDB local
  return process.env.MONGODB_URI || 'mongodb://localhost:27017/condominio-sistema'
}

const MONGODB_URI = getMongoURI()

if (!MONGODB_URI) {
  console.error('❌ [MongoDB] MONGODB_URI não encontrada!')
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local')
}

const isRailwayEnv = process.env.PORT === '8080' || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production'
console.log(`🔗 [MongoDB] Conectando ao MongoDB: ${isRailwayEnv ? 'Railway (Produção)' : 'Local (Desenvolvimento)'}`)
console.log(`🔗 [MongoDB] URI configurada: ${MONGODB_URI}`)

interface GlobalMongoDB {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var mongodb: GlobalMongoDB | undefined
}

let cached = global.mongodb

if (!cached) {
  cached = global.mongodb = { conn: null, promise: null }
}

async function connectDB() {
  console.log('🔄 [MongoDB] Função connectDB chamada')
  console.log('🔄 [MongoDB] Cached connection exists?', !!cached!.conn)
  
  if (cached!.conn) {
    console.log('✅ [MongoDB] Retornando conexão cached existente')
    return cached!.conn
  }

  console.log('🔄 [MongoDB] Cached promise exists?', !!cached!.promise)
  if (!cached!.promise) {
    console.log('🔄 [MongoDB] Criando nova conexão...')
    console.log('🔄 [MongoDB] URI COMPLETA para conexão:', MONGODB_URI)
    
    const opts = {
      bufferCommands: false,
      // 🚀 Performance: Connection pooling otimizado
      maxPoolSize: 10, // Máximo 10 conexões simultâneas
      serverSelectionTimeoutMS: 30000, // Timeout de seleção do servidor (aumentado)
      socketTimeoutMS: 45000, // Timeout do socket
      connectTimeoutMS: 30000, // Timeout de conexão inicial
      family: 4, // Use IPv4, skip trying IPv6
      maxIdleTimeMS: 30000, // Fechar conexões inativas após 30s
      // 🚀 Performance: Configurações de retry
      retryWrites: true,
      retryReads: true,
    }
    
    console.log('🔄 [MongoDB] Opções de conexão:', JSON.stringify(opts, null, 2))

    cached!.promise = mongoose.connect(MONGODB_URI, opts).then(async (mongoose) => {
      console.log('🚀 [MongoDB] Conexão estabelecida com sucesso!')
      console.log('📊 [MongoDB] Connection state:', mongoose.connection.readyState)
      console.log('📊 [MongoDB] Connection name:', mongoose.connection.name)
      console.log('📊 [MongoDB] Connection host:', mongoose.connection.host)
      console.log('📊 [MongoDB] Connection port:', mongoose.connection.port)
      
      // Verificar se a conexão está realmente funcionando
      if (mongoose.connection.db) {
        try {
          console.log('🔄 [MongoDB] Executando ping no banco...')
          const pingResult = await mongoose.connection.db.admin().ping()
          console.log('✅ [MongoDB] Ping bem-sucedido:', pingResult)
        } catch (pingError) {
          console.error('❌ [MongoDB] Erro no ping:', pingError)
        }
      } else {
        console.log('⚠️ [MongoDB] Database connection not ready, skipping ping')
      }
      
      // Executar auto-seed automaticamente no Railway
      const isRailway = process.env.PORT === '8080' || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production'
      console.log('🔄 [MongoDB] Verificando se deve executar auto-seed. É Railway?', isRailway)
      
      if (isRailway) {
        try {
          console.log('🌱 [MongoDB] Executando auto-seed automaticamente...')
          const { autoSeed } = await import('./auto-seed')
          await autoSeed()
          console.log('✅ [MongoDB] Auto-seed concluído com sucesso')
        } catch (error) {
          console.error('⚠️ [MongoDB] Erro no auto-seed:', error)
          console.error('⚠️ [MongoDB] Stack trace do auto-seed:', error instanceof Error ? error.stack : 'N/A')
          // Continua mesmo se o seed falhar
        }
      }
      
      console.log('✅ [MongoDB] Setup completo, retornando mongoose instance')
      return mongoose
    }).catch((error) => {
      console.error('❌ [MongoDB] ERRO CRÍTICO na conexão:', error.message)
      console.error('❌ [MongoDB] Código do erro:', error.code)
      console.error('❌ [MongoDB] Stack trace:', error.stack)
      console.error('❌ [MongoDB] Objeto completo do erro:', JSON.stringify(error, null, 2))
      throw error
    })
  }

  try {
    console.log('🔄 [MongoDB] Aguardando resolução da promise de conexão...')
    cached!.conn = await cached!.promise
    console.log('✅ [MongoDB] Promise resolvida, conexão armazenada no cache')
  } catch (e) {
    console.error('❌ [MongoDB] Erro ao aguardar promise de conexão:', e)
    cached!.promise = null
    throw e
  }

  console.log('✅ [MongoDB] Retornando conexão estabelecida')
  return cached!.conn
}

// Testar conexão após definição da função se estiver no Railway
if (isRailwayEnv) {
  console.log('🔄 [MongoDB] Testando conexão Railway...')
  connectDB().then(() => {
    console.log('✅ [MongoDB] Conexão Railway bem-sucedida!')
  }).catch((error) => {
    console.error('❌ [MongoDB] Falha na conexão Railway:', error.message)
    console.error('❌ [MongoDB] Stack trace:', error.stack)
  })
}

export default connectDB