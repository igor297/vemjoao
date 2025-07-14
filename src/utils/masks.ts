// Utilitários para máscaras de entrada de dados - VemJoao

export const applyCpfMask = (value: string): string => {
  if (!value) return '';
  
  // Remove tudo que não é dígito
  const numericValue = value.replace(/\D/g, '');
  
  // Aplica a máscara CPF: 999.999.999-99
  if (numericValue.length <= 11) {
    return numericValue
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2');
  }
  
  return numericValue.slice(0, 11)
    .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

export const applyCnpjMask = (value: string): string => {
  if (!value) return '';
  
  // Remove tudo que não é dígito
  const numericValue = value.replace(/\D/g, '');
  
  // Aplica a máscara CNPJ: 99.999.999/9999-99
  if (numericValue.length <= 14) {
    return numericValue
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})/, '$1-$2');
  }
  
  return numericValue.slice(0, 14)
    .replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

export const applyCelularMask = (value: string): string => {
  if (!value) return '';
  
  // Remove tudo que não é dígito
  const numericValue = value.replace(/\D/g, '');
  
  // Aplica a máscara celular: (99) 99999-9999
  if (numericValue.length <= 11) {
    return numericValue
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{1,4})/, '$1-$2');
  }
  
  return numericValue.slice(0, 11)
    .replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
};

export const applyCepMask = (value: string): string => {
  if (!value) return '';
  
  // Remove tudo que não é dígito
  const numericValue = value.replace(/\D/g, '');
  
  // Aplica a máscara CEP: 99999-999
  if (numericValue.length <= 8) {
    return numericValue.replace(/(\d{5})(\d{1,3})/, '$1-$2');
  }
  
  return numericValue.slice(0, 8).replace(/(\d{5})(\d{3})/, '$1-$2');
};

// Função genérica para aplicar máscara em tempo real
export const applyMask = (type: string, value: string): string => {
  switch (type) {
    case 'cpf':
      return applyCpfMask(value);
    case 'cnpj':
      return applyCnpjMask(value);
    case 'celular':
      return applyCelularMask(value);
    case 'cep':
      return applyCepMask(value);
    default:
      return value;
  }
};

// Remove máscara para obter apenas números
export const removeMask = (value: string): string => {
  if (!value) return '';
  return value.replace(/\D/g, '');
};