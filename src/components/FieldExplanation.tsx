'use client'

import { useState } from 'react'
import { Button, Popover, OverlayTrigger } from 'react-bootstrap'

interface FieldExplanationProps {
  title: string
  explanation: string
  variant?: string
  size?: 'sm' | 'lg'
}

export default function FieldExplanation({ 
  title, 
  explanation, 
  variant = "outline-info",
  size = "sm" 
}: FieldExplanationProps) {
  const popover = (
    <Popover id="field-explanation-popover">
      <Popover.Header as="h6">{title}</Popover.Header>
      <Popover.Body>
        {explanation}
      </Popover.Body>
    </Popover>
  )

  return (
    <OverlayTrigger
      trigger="click"
      placement="top"
      overlay={popover}
      rootClose
    >
      <Button 
        variant={variant} 
        size={size}
        className="field-explanation-btn"
      >
        ?
      </Button>
    </OverlayTrigger>
  )
}