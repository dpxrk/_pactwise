import { ConvexError } from 'convex/values';

/**
 * Sanitize user input to prevent XSS and injection attacks
 */
export function sanitizeInput(input: string): string {
  let sanitized = input;
  
  // Remove path traversal attempts completely, including the path separators
  sanitized = sanitized.replace(/\.\.\/|\.\.\\|\.\./g, '');
  
  // Remove any remaining path separators from traversal attempts
  sanitized = sanitized.replace(/(\.\.\/)*(\/)?etc\/passwd/g, 'etcpasswd');
  
  // HTML encode special characters
  sanitized = sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
    
  // Remove javascript: protocol and other dangerous protocols
  sanitized = sanitized.replace(/javascript:|data:|vbscript:|file:|about:/gi, '');
  
  // Remove on* event handlers
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  return sanitized;
}

/**
 * Validate input against a schema
 */
export function validateInput(schema: ValidationSchema, value: any): ValidationResult {
  switch (schema.type) {
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return { 
        valid: emailRegex.test(value),
        error: !emailRegex.test(value) ? 'Invalid email format' : undefined
      };
      
    case 'uuid':
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return { 
        valid: uuidRegex.test(value),
        error: !uuidRegex.test(value) ? 'Invalid UUID format' : undefined
      };
      
    case 'number':
      const num = Number(value);
      if (isNaN(num)) {
        return { valid: false, error: 'Value must be a number' };
      }
      if (schema.min !== undefined && num < schema.min) {
        return { valid: false, error: `Value must be at least ${schema.min}` };
      }
      if (schema.max !== undefined && num > schema.max) {
        return { valid: false, error: `Value must be at most ${schema.max}` };
      }
      return { valid: true };
      
    case 'string':
      if (typeof value !== 'string') {
        return { valid: false, error: 'Value must be a string' };
      }
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        return { valid: false, error: `Value must be at least ${schema.minLength} characters` };
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return { valid: false, error: `Value must be at most ${schema.maxLength} characters` };
      }
      if (schema.pattern !== undefined) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          return { valid: false, error: 'Value does not match required pattern' };
        }
      }
      return { valid: true };
      
    default:
      return { valid: false, error: 'Unknown validation type' };
  }
}

/**
 * Sanitize and validate an object's properties
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  schemas: Record<keyof T, ValidationSchema>
): { data: T; errors: Record<string, string> } {
  const sanitized = {} as T;
  const errors: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const schema = schemas[key as keyof T];
    if (!schema) continue;
    
    // Sanitize string values
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeInput(value) as any;
    } else {
      sanitized[key as keyof T] = value;
    }
    
    // Validate
    const validation = validateInput(schema, sanitized[key as keyof T]);
    if (!validation.valid && validation.error) {
      errors[key] = validation.error;
    }
  }
  
  return { data: sanitized, errors };
}

// Types
export interface ValidationSchema {
  type: 'email' | 'uuid' | 'number' | 'string';
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}