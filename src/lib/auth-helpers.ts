import { NextRequest } from 'next/server'
import connectDB from '@/lib/mongodb'
import Master from '@/models/Master'
import Adm from '@/models/Adm'
import Colaborador from '@/models/Colaborador'
import Morador from '@/models/Morador'
import bcrypt from 'bcrypt' // Importar bcrypt

export interface AuthUser {
  id: string
  nome: string
  email: string
  tipo: 'master' | 'adm' | 'colaborador' | 'morador'
  subtipo?: string
  condominio_id?: string
  master_id?: string
  unidade?: string
  bloco?: string
}

/**
 * Authenticate user based on email and password from request headers
 * Returns user data if authentication is successful, null otherwise
 */
export async function authenticateUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Try to get authentication from headers
    const email = request.headers.get('x-user-email')
    const password = request.headers.get('x-user-password')
    const userId = request.headers.get('x-user-id')
    const userType = request.headers.get('x-user-type')

    // If we have user data in headers, use it (for testing or pre-authenticated requests)
    if (userId && userType && email) {
      return {
        id: userId,
        nome: '',
        email: email,
        tipo: userType as any
      }
    }

    if (!email || !password) {
      return null
    }

    await connectDB()
    
    const emailLower = email.toLowerCase().trim()
    
    // Try Master first
    const masterUser = await Master.findOne({ 
      email: emailLower
    })
    
    if (masterUser) {
      // Comparar a senha usando bcrypt
      const isPasswordValid = await bcrypt.compare(password, masterUser.password);
      if (isPasswordValid) {
        return {
          id: masterUser._id.toString(),
          nome: masterUser.nome,
          email: masterUser.email,
          tipo: 'master'
        }
      }
    }
    
    // Try Adm
    const admUser = await Adm.findOne({ 
      email: emailLower
    })
    
    if (admUser) {
      const isPasswordValid = await bcrypt.compare(password, admUser.password);
      if (isPasswordValid) {
        // Check if ADM is active
        if (admUser.data_fim) {
          const now = new Date()
          const dataFim = new Date(admUser.data_fim)
          if (dataFim < now) {
            return null
          }
        }
        
        return {
          id: admUser._id.toString(),
          nome: admUser.nome,
          email: admUser.email,
          tipo: 'adm',
          subtipo: admUser.tipo,
          condominio_id: admUser.condominio_id?.toString(),
          master_id: admUser.master_id?.toString()
        }
      }
    }
    
    // Try Colaborador
    const colaboradorUser = await Colaborador.findOne({ 
      email: emailLower
    })
    
    if (colaboradorUser) {
      const isPasswordValid = await bcrypt.compare(password, colaboradorUser.password);
      if (isPasswordValid) {
        // Check if Colaborador is active
        if (colaboradorUser.data_fim) {
          const now = new Date()
          const dataFim = new Date(colaboradorUser.data_fim)
          if (dataFim < now) {
            return null
          }
        }
        
        return {
          id: colaboradorUser._id.toString(),
          nome: colaboradorUser.nome,
          email: colaboradorUser.email,
          tipo: 'colaborador',
          condominio_id: colaboradorUser.condominio_id?.toString(),
          master_id: colaboradorUser.master_id?.toString()
        }
      }
    }
    
    // Try Morador
    const moradorUser = await Morador.findOne({ 
      email: emailLower
    })
    
    if (moradorUser) {
      const isPasswordValid = await bcrypt.compare(password, moradorUser.password);
      if (isPasswordValid) {
        // Check if Morador is active
        if (moradorUser.data_fim) {
          const now = new Date()
          const dataFim = new Date(moradorUser.data_fim)
          if (dataFim < now) {
            return null
          }
        }
        
        if (!moradorUser.ativo) {
          return null
        }
        
        return {
          id: moradorUser._id.toString(),
          nome: moradorUser.nome,
          email: moradorUser.email,
          tipo: 'morador',
          subtipo: moradorUser.tipo,
          condominio_id: moradorUser.condominio_id?.toString(),
          master_id: moradorUser.master_id?.toString(),
          unidade: moradorUser.unidade,
          bloco: moradorUser.bloco
        }
      }
    }
    
    return null
    
  } catch (error) {
    console.error('Authentication error:', error)
    return null
  }
}