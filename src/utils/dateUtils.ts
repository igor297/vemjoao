// Utilitários para formatação e manipulação de datas

/**
 * Formata uma data para o padrão brasileiro DD/MM/YYYY
 */
export const formatDateBR = (dateString: string | Date): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR')
}

/**
 * Formata uma data para o padrão ISO YYYY-MM-DD (para inputs HTML)
 */
export const formatDateISO = (dateString: string): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toISOString().split('T')[0]
}

/**
 * Converte data do formato brasileiro DD/MM/YYYY para ISO YYYY-MM-DD
 */
export const convertBRToISO = (dateBR: string): string => {
  if (!dateBR || dateBR.length !== 10) return ''
  const [day, month, year] = dateBR.split('/')
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/**
 * Converte data do formato ISO YYYY-MM-DD para brasileiro DD/MM/YYYY
 */
export const convertISOToBR = (dateISO: string): string => {
  if (!dateISO) return ''
  const [year, month, day] = dateISO.split('-')
  return `${day}/${month}/${year}`
}

/**
 * Calcula a idade com base na data de nascimento
 */
export const calculateAge = (birthDate: string | Date): number => {
  if (!birthDate) return 0
  
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  
  return age
}

/**
 * Valida se uma data no formato DD/MM/YYYY é válida
 */
export const validateDateBR = (dateBR: string): boolean => {
  if (!dateBR || dateBR.length !== 10) return false
  
  const [day, month, year] = dateBR.split('/')
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  
  return date.getDate() === parseInt(day) &&
         date.getMonth() === parseInt(month) - 1 &&
         date.getFullYear() === parseInt(year)
}

/**
 * Formata data e hora para exibição
 */
export const formatDateTime = (dateString: string | Date): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}