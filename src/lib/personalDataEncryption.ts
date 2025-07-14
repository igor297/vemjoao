import crypto from 'crypto';
import bcrypt from 'bcrypt';

interface EncryptedPersonalData {
  encrypted: string;
  iv: string;
}

export class PersonalDataEncryption {
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly SALT_ROUNDS = 12;
  
  // Chave específica para dados pessoais
  private static getMasterKey(): string {
    const key = process.env.PERSONAL_DATA_ENCRYPTION_KEY || process.env.FINANCIAL_ENCRYPTION_KEY || 'VemJoao2025PersonalDataSecretKey123456789012345678901234567890';
    return key.substring(0, 64);
  }
  
  // Deriva chave específica para dados pessoais
  private static deriveKey(purpose: string): Buffer {
    const masterKey = this.getMasterKey();
    return crypto.pbkdf2Sync(masterKey, purpose, 10000, this.KEY_LENGTH, 'sha256');
  }
  
  /**
   * Criptografa CPF/CNPJ
   */
  static encryptCpfCnpj(data: string): EncryptedPersonalData {
    try {
      // Remove formatação antes de criptografar
      const cleanData = data.replace(/[^\d]/g, '');
      
      const key = this.deriveKey('cpf_cnpj_data');
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      const cipher = crypto.createCipher(this.ALGORITHM, key.toString('hex'));
      
      let encrypted = cipher.update(cleanData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encrypted,
        iv: iv.toString('hex')
      };
    } catch (error: any) {
      throw new Error(`Erro ao criptografar CPF/CNPJ: ${error.message}`);
    }
  }
  
  /**
   * Descriptografa CPF/CNPJ
   */
  static decryptCpfCnpj(encryptedData: EncryptedPersonalData): string {
    try {
      const key = this.deriveKey('cpf_cnpj_data');
      
      const decipher = crypto.createDecipher(this.ALGORITHM, key.toString('hex'));
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error: any) {
      throw new Error(`Erro ao descriptografar CPF/CNPJ: ${error.message}`);
    }
  }
  
  /**
   * Hash seguro para senhas usando bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.SALT_ROUNDS);
    } catch (error: any) {
      throw new Error(`Erro ao criar hash da senha: ${error.message}`);
    }
  }
  
  /**
   * Verifica senha usando bcrypt
   */
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error: any) {
      return false;
    }
  }
  
  /**
   * Criptografa dados pessoais genéricos
   */
  static encryptPersonalField(data: string, fieldType: string = 'general'): EncryptedPersonalData {
    try {
      const key = this.deriveKey(`personal_${fieldType}`);
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      const cipher = crypto.createCipher(this.ALGORITHM, key.toString('hex'));
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encrypted,
        iv: iv.toString('hex')
      };
    } catch (error: any) {
      throw new Error(`Erro ao criptografar campo pessoal: ${error.message}`);
    }
  }
  
  /**
   * Descriptografa dados pessoais genéricos
   */
  static decryptPersonalField(encryptedData: EncryptedPersonalData, fieldType: string = 'general'): string {
    try {
      const key = this.deriveKey(`personal_${fieldType}`);
      
      const decipher = crypto.createDecipher(this.ALGORITHM, key.toString('hex'));
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error: any) {
      throw new Error(`Erro ao descriptografar campo pessoal: ${error.message}`);
    }
  }
  
  /**
   * Verifica se um dado está criptografado (tem estrutura de dados criptografados)
   */
  static isEncrypted(data: any): boolean {
    return typeof data === 'object' && 
           data !== null && 
           typeof data.encrypted === 'string' && 
           typeof data.iv === 'string';
  }
  
  /**
   * Máscara CPF para exibição (mantém apenas primeiros e últimos dígitos)
   */
  static maskCpf(cpf: string): string {
    if (!cpf || cpf.length < 11) return '***.***.***-**';
    const clean = cpf.replace(/[^\d]/g, '');
    return `${clean.slice(0, 3)}.***.***-${clean.slice(-2)}`;
  }
  
  /**
   * Máscara CNPJ para exibição
   */
  static maskCnpj(cnpj: string): string {
    if (!cnpj || cnpj.length < 14) return '**.***.***/****-**';
    const clean = cnpj.replace(/[^\d]/g, '');
    return `${clean.slice(0, 2)}.***.***/****-${clean.slice(-2)}`;
  }
  
  /**
   * Prepara dados para salvar (criptografa campos sensíveis)
   */
  static async prepareForSave(data: any): Promise<any> {
    const result = { ...data };
    
    // Criptografar CPF se presente
    if (result.cpf && typeof result.cpf === 'string') {
      result.cpf = this.encryptCpfCnpj(result.cpf);
    }
    
    // Criptografar CNPJ se presente
    if (result.cnpj && typeof result.cnpj === 'string') {
      result.cnpj = this.encryptCpfCnpj(result.cnpj);
    }
    
    // Hash da senha se presente
    if (result.senha && typeof result.senha === 'string') {
      result.senha = await this.hashPassword(result.senha);
    }
    
    return result;
  }
  
  /**
   * Prepara dados para exibição (descriptografa campos sensíveis)
   */
  static prepareForDisplay(data: any): any {
    const result = { ...data };
    
    // Descriptografar CPF se estiver criptografado
    if (result.cpf && this.isEncrypted(result.cpf)) {
      try {
        const decryptedCpf = this.decryptCpfCnpj(result.cpf);
        result.cpf = this.formatCpf(decryptedCpf);
      } catch (error) {
        result.cpf = '***.***.***-**'; // Fallback se houver erro
      }
    }
    
    // Descriptografar CNPJ se estiver criptografado
    if (result.cnpj && this.isEncrypted(result.cnpj)) {
      try {
        const decryptedCnpj = this.decryptCpfCnpj(result.cnpj);
        result.cnpj = this.formatCnpj(decryptedCnpj);
      } catch (error) {
        result.cnpj = '**.***.***/****-**'; // Fallback se houver erro
      }
    }
    
    // Remover senha dos dados de exibição
    if (result.senha) {
      delete result.senha;
    }
    
    return result;
  }
  
  /**
   * Formata CPF para exibição
   */
  static formatCpf(cpf: string): string {
    const clean = cpf.replace(/[^\d]/g, '');
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpf;
  }
  
  /**
   * Formata CNPJ para exibição
   */
  static formatCnpj(cnpj: string): string {
    const clean = cnpj.replace(/[^\d]/g, '');
    if (clean.length === 14) {
      return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return cnpj;
  }
}