import mongoose from 'mongoose'

// Configuração automática para Railway vs Local
const getMongoURI = () => {
  // Se estiver em produção (Railway), usar URL pública
  if (process.env.NODE_ENV === 'production') {
    return process.env.MONGODB_URI || 'mongodb://mongo:dfSakOiePzOactfHNwqrQNfHnRlqBVZX@shuttle.proxy.rlwy.net:30512/condominio-sistema'
  }
  
  // Se estiver em desenvolvimento, usar MongoDB local
  return process.env.MONGODB_URI || 'mongodb://localhost:27017/condominio-sistema'
}

const MONGODB_URI = getMongoURI()

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local')
}

console.log(`🔗 Conectando ao MongoDB: ${MONGODB_URI.includes('railway') ? 'Railway (Produção)' : 'Local (Desenvolvimento)'}`)

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
  if (cached!.conn) {
    return cached!.conn
  }

  if (!cached!.promise) {
    const opts = {
      bufferCommands: false,
      // 🚀 Performance: Connection pooling otimizado
      maxPoolSize: 10, // Máximo 10 conexões simultâneas
      serverSelectionTimeoutMS: 5000, // Timeout de seleção do servidor
      socketTimeoutMS: 45000, // Timeout do socket
      family: 4, // Use IPv4, skip trying IPv6
      maxIdleTimeMS: 30000, // Fechar conexões inativas após 30s
      // 🚀 Performance: Configurações de retry
      retryWrites: true,
      retryReads: true,
    }

    cached!.promise = mongoose.connect(MONGODB_URI, opts).then(async (mongoose) => {
      console.log('🚀 MongoDB connected with optimized pool settings')
      
      // Executar auto-seed apenas em produção (Railway)
      if (process.env.NODE_ENV === 'production') {
        try {
          const { autoSeed } = await import('./auto-seed')
          await autoSeed()
        } catch (error) {
          console.error('⚠️ Erro no auto-seed:', error)
          // Continua mesmo se o seed falhar
        }
      }
      
      return mongoose
    })
  }

  try {
    cached!.conn = await cached!.promise
  } catch (e) {
    cached!.promise = null
    throw e
  }

  return cached!.conn
}

export default connectDB