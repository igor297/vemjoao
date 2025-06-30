import mongoose from 'mongoose'

// Configuração apenas para localhost
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/condominio-sistema'

if (!MONGODB_URI) {
  console.error('❌ [MongoDB] MONGODB_URI não encontrada!')
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local')
}

if (process.env.NODE_ENV === 'development') {
  console.log(`🔗 [MongoDB] Conectando ao MongoDB: ${MONGODB_URI}`)
}

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
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      family: 4,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      retryReads: true,
    }

    cached!.promise = mongoose.connect(MONGODB_URI, opts).then(async (mongoose) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ [MongoDB] Conexão estabelecida!')
      }
      return mongoose
    }).catch((error) => {
      console.error('❌ [MongoDB] Erro na conexão:', error.message)
      throw error
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