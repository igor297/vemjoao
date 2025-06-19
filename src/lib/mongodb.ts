import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local')
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

    cached!.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('🚀 MongoDB connected with optimized pool settings')
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