'use client'

import { Form } from 'react-bootstrap'
import { convertBRToISO, convertISOToBR, validateDateBR, calculateAge } from '@/utils/dateUtils'
import { useState, useEffect } from 'react'

interface DateInputProps {
  name: string
  value: string
  onChange: (name: string, value: string) => void
  label: string
  required?: boolean
  disabled?: boolean
  className?: string
  showAge?: boolean
  onAgeCalculated?: (age: number) => void
}

export default function DateInput({
  name,
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  className = '',
  showAge = false,
  onAgeCalculated
}: DateInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null)
  const [isValid, setIsValid] = useState(true)

  // Converte valor ISO para formato brasileiro quando o componente monta
  useEffect(() => {
    if (value) {
      setInputValue(convertISOToBR(value))
    } else {
      setInputValue('')
    }
  }, [value])

  // Calcula idade quando a data muda
  useEffect(() => {
    if (showAge && inputValue && inputValue.length === 10) {
      if (validateDateBR(inputValue)) {
        const isoDate = convertBRToISO(inputValue)
        const age = calculateAge(isoDate)
        setCalculatedAge(age)
        if (onAgeCalculated) {
          onAgeCalculated(age)
        }
      } else {
        setCalculatedAge(null)
      }
    } else {
      setCalculatedAge(null)
    }
  }, [inputValue, showAge, onAgeCalculated])

  const applyDateMask = (value: string): string => {
    // Remove todos os caracteres não numéricos
    const numbers = value.replace(/\D/g, '')
    
    // Aplica a máscara DD/MM/YYYY
    if (numbers.length <= 2) {
      return numbers
    } else if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}/${numbers.slice(2)}`
    } else {
      return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    const maskedValue = applyDateMask(rawValue)
    setInputValue(maskedValue)

    // Valida e converte apenas se a data estiver completa
    if (maskedValue.length === 10) {
      const valid = validateDateBR(maskedValue)
      setIsValid(valid)
      
      if (valid) {
        const isoDate = convertBRToISO(maskedValue)
        onChange(name, isoDate)
      }
    } else {
      setIsValid(true)
      onChange(name, '')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Permitir apenas números, backspace, delete, tab, e arrow keys
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
    
    if (!allowedKeys.includes(e.key) && !/[0-9]/.test(e.key)) {
      e.preventDefault()
    }
  }

  return (
    <Form.Group className="mb-3">
      <Form.Label>{label} {required && '*'}</Form.Label>
      <Form.Control
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="dd/mm/aaaa"
        maxLength={10}
        isInvalid={!isValid}
        className={className}
        required={required}
        disabled={disabled}
      />
      {!isValid && (
        <Form.Control.Feedback type="invalid">
          Data inválida. Use o formato DD/MM/AAAA
        </Form.Control.Feedback>
      )}
      {showAge && calculatedAge !== null && (
        <Form.Text className="text-info">
          Idade: {calculatedAge} anos
        </Form.Text>
      )}
    </Form.Group>
  )
}