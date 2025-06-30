import crypto from 'crypto';

interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

export class FinancialDataEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  
  // Chave mestra - deve ser definida em variável de ambiente
  private static getMasterKey(): string {
    const key = process.env.FINANCIAL_ENCRYPTION_KEY;
    if (!key || key.length < 64) {
      throw new Error('FINANCIAL_ENCRYPTION_KEY deve ter pelo menos 64 caracteres');
    }
    return key.substring(0, 64); // Usa os primeiros 64 caracteres como chave
  }
  
  // Deriva uma chave específica para cada tipo de dado
  private static deriveKey(purpose: string): Buffer {
    const masterKey = this.getMasterKey();
    return crypto.pbkdf2Sync(masterKey, purpose, 100000, this.KEY_LENGTH, 'sha512');
  }
  
  /**
   * Criptografa chaves de API dos gateways de pagamento
   */
  static encryptApiKey(apiKey: string, gateway: string): EncryptedData {
    try {
      const key = this.deriveKey(`api_key_${gateway}`);
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipherGCM(this.ALGORITHM, key, iv);
      
      let encrypted = cipher.update(apiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Erro ao criptografar chave API: ${error.message}`);
    }
  }
  
  /**
   * Descriptografa chaves de API dos gateways de pagamento
   */
  static decryptApiKey(encryptedData: EncryptedData, gateway: string): string {
    try {
      const key = this.deriveKey(`api_key_${gateway}`);
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      
      const decipher = crypto.createDecipherGCM(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Erro ao descriptografar chave API: ${error.message}`);
    }
  }
  
  /**
   * Criptografa dados bancários sensíveis
   */
  static encryptBankingData(data: any): EncryptedData {
    try {
      const key = this.deriveKey('banking_data');
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipherGCM(this.ALGORITHM, key, iv);
      
      const jsonData = JSON.stringify(data);
      let encrypted = cipher.update(jsonData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Erro ao criptografar dados bancários: ${error.message}`);
    }
  }
  
  /**
   * Descriptografa dados bancários sensíveis
   */
  static decryptBankingData(encryptedData: EncryptedData): any {
    try {
      const key = this.deriveKey('banking_data');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      
      const decipher = crypto.createDecipherGCM(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Erro ao descriptografar dados bancários: ${error.message}`);
    }
  }
  
  /**
   * Hash seguro para CPF/CNPJ e dados pessoais
   */
  static hashPersonalData(data: string): string {
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512');
    return salt.toString('hex') + ':' + hash.toString('hex');
  }
  
  /**
   * Verifica hash de dados pessoais
   */
  static verifyPersonalDataHash(data: string, hashedData: string): boolean {
    try {
      const [saltHex, hashHex] = hashedData.split(':');
      const salt = Buffer.from(saltHex, 'hex');
      const hash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512');
      return hash.toString('hex') === hashHex;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Criptografa dados de transação para auditoria
   */
  static encryptTransactionData(transactionData: any): EncryptedData {
    try {
      const key = this.deriveKey('transaction_audit');
      const iv = crypto.randomBytes(this.IV_LENGTH);
      const cipher = crypto.createCipherGCM(this.ALGORITHM, key, iv);
      
      const jsonData = JSON.stringify(transactionData);
      let encrypted = cipher.update(jsonData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Erro ao criptografar dados de transação: ${error.message}`);
    }
  }
  
  /**
   * Descriptografa dados de transação para auditoria
   */
  static decryptTransactionData(encryptedData: EncryptedData): any {
    try {
      const key = this.deriveKey('transaction_audit');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      
      const decipher = crypto.createDecipherGCM(this.ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Erro ao descriptografar dados de transação: ${error.message}`);
    }
  }
  
  /**
   * Gera token seguro para sessões de pagamento
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
  
  /**
   * Gera assinatura HMAC para validação de webhooks
   */
  static generateHmacSignature(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }
  
  /**
   * Verifica assinatura HMAC de webhooks
   */
  static verifyHmacSignature(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateHmacSignature(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
  
  /**
   * Mascara dados sensíveis para logs
   */
  static maskSensitiveData(data: any): any {
    const masked = { ...data };
    
    // Campos a serem mascarados
    const sensitiveFields = [
      'cpf', 'cnpj', 'account_number', 'routing_number', 
      'card_number', 'cvv', 'api_key', 'access_token',
      'password', 'secret', 'private_key'
    ];
    
    const maskValue = (value: string) => {
      if (!value || value.length < 4) return '***';
      return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
    };
    
    const maskObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(maskObject);
      }
      
      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            result[key] = typeof value === 'string' ? maskValue(value) : '***';
          } else {
            result[key] = maskObject(value);
          }
        }
        return result;
      }
      
      return obj;
    };
    
    return maskObject(masked);
  }
  
  /**
   * Rotaciona chaves de criptografia (para execução em cron job)
   */
  static async rotateEncryptionKeys(): Promise<void> {
    // TODO: Implementar rotação de chaves
    // 1. Gerar nova chave
    // 2. Re-criptografar dados existentes
    // 3. Atualizar variável de ambiente
    // 4. Invalidar chave antiga
    console.log('Rotação de chaves implementada em versão futura');
  }
}

/**
 * Middleware para automatizar criptografia em schemas Mongoose
 */
export const EncryptionMiddleware = {
  // Middleware para criptografar antes de salvar
  preEncrypt: function(fields: string[]) {
    return function(this: any, next: any) {
      fields.forEach(field => {
        if (this[field] && !this[field + '_encrypted']) {
          const encrypted = FinancialDataEncryption.encryptBankingData(this[field]);
          this[field + '_encrypted'] = encrypted;
          this[field] = undefined; // Remove o dado não criptografado
        }
      });
      next();
    };
  },
  
  // Middleware para descriptografar após carregar
  postDecrypt: function(fields: string[]) {
    return function(this: any) {
      fields.forEach(field => {
        if (this[field + '_encrypted'] && !this[field]) {
          try {
            this[field] = FinancialDataEncryption.decryptBankingData(this[field + '_encrypted']);
          } catch (error) {
            console.error(`Erro ao descriptografar campo ${field}:`, error);
          }
        }
      });
    };
  }
};

export default FinancialDataEncryption;