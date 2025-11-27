#!/usr/bin/env node
/**
 * W3C Verifiable Credentials Data Model Validator
 * 
 * Single-file validator for W3C VC Data Model v1.1 and v2.0
 * Can be fetched via URL and executed: node validate-w3c-vc.js --validate-vc '{...}'
 * 
 * Usage:
 *   node validate-w3c-vc.js --validate-vc '<json-string>'
 *   node validate-w3c-vc.js --validate-vp '<json-string>'
 *   node validate-w3c-vc.js --validate-jwt '<jwt-token>'
 */

const VC_V1_CONTEXT = 'https://www.w3.org/2018/credentials/v1';
const VC_V2_CONTEXT = 'https://www.w3.org/ns/credentials/v2';

/**
 * Validates a Verifiable Credential according to W3C VC Data Model
 */
function validateVerifiableCredential(vc) {
  const errors = [];
  const warnings = [];

  // Check @context
  if (!vc['@context']) {
    errors.push('Missing required @context property');
  } else {
    const contexts = Array.isArray(vc['@context']) ? vc['@context'] : [vc['@context']];
    const hasV1Context = contexts.some(ctx => ctx === VC_V1_CONTEXT);
    const hasV2Context = contexts.some(ctx => ctx === VC_V2_CONTEXT);
    
    if (!hasV1Context && !hasV2Context) {
      errors.push(`@context must include either "${VC_V1_CONTEXT}" or "${VC_V2_CONTEXT}"`);
    }
  }

  // Check type
  if (!vc.type) {
    errors.push('Missing required type property');
  } else {
    const types = Array.isArray(vc.type) ? vc.type : [vc.type];
    if (!types.includes('VerifiableCredential')) {
      errors.push('type must include "VerifiableCredential"');
    }
  }

  // Check issuer
  if (!vc.issuer) {
    errors.push('Missing required issuer property');
  } else {
    if (typeof vc.issuer === 'string') {
      // String issuer (DID or URL)
      if (!vc.issuer.startsWith('did:') && !vc.issuer.startsWith('http')) {
        warnings.push('issuer should be a DID or URL');
      }
    } else if (typeof vc.issuer === 'object') {
      if (!vc.issuer.id) {
        errors.push('issuer object must have an id property');
      }
    }
  }

  // Check credentialSubject
  if (!vc.credentialSubject) {
    errors.push('Missing required credentialSubject property');
  } else {
    if (Array.isArray(vc.credentialSubject)) {
      vc.credentialSubject.forEach((subject, index) => {
        if (!subject.id && !subject['@id']) {
          warnings.push(`credentialSubject[${index}] should have an id property`);
        }
      });
    } else if (typeof vc.credentialSubject === 'object') {
      if (!vc.credentialSubject.id && !vc.credentialSubject['@id']) {
        warnings.push('credentialSubject should have an id property');
      }
    }
  }

  // Check issuanceDate
  if (!vc.issuanceDate) {
    errors.push('Missing required issuanceDate property');
  } else {
    // Validate ISO 8601 date format
    const date = new Date(vc.issuanceDate);
    if (isNaN(date.getTime())) {
      errors.push('issuanceDate must be a valid ISO 8601 date string');
    }
  }

  // Check proof (for verifiable credentials)
  if (!vc.proof && !vc.jwt && !vc.credential) {
    warnings.push('Credential should have a proof, jwt, or credential property for verification');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates a Verifiable Presentation according to W3C VC Data Model
 */
function validateVerifiablePresentation(vp) {
  const errors = [];
  const warnings = [];

  // Check @context
  if (!vp['@context']) {
    errors.push('Missing required @context property');
  } else {
    const contexts = Array.isArray(vp['@context']) ? vp['@context'] : [vp['@context']];
    const hasV1Context = contexts.some(ctx => ctx === VC_V1_CONTEXT);
    const hasV2Context = contexts.some(ctx => ctx === VC_V2_CONTEXT);
    
    if (!hasV1Context && !hasV2Context) {
      errors.push(`@context must include either "${VC_V1_CONTEXT}" or "${VC_V2_CONTEXT}"`);
    }
  }

  // Check type
  if (!vp.type) {
    errors.push('Missing required type property');
  } else {
    const types = Array.isArray(vp.type) ? vp.type : [vp.type];
    if (!types.includes('VerifiablePresentation')) {
      errors.push('type must include "VerifiablePresentation"');
    }
  }

  // Check verifiableCredential (optional but common)
  if (vp.verifiableCredential) {
    const vcs = Array.isArray(vp.verifiableCredential) ? vp.verifiableCredential : [vp.verifiableCredential];
    
    vcs.forEach((vc, index) => {
      // Handle EnvelopedVerifiableCredential (v2.0)
      if (vc.type === 'EnvelopedVerifiableCredential' || (Array.isArray(vc.type) && vc.type.includes('EnvelopedVerifiableCredential'))) {
        // For enveloped credentials, @context should be a URL, not a JWT token
        if (vc['@context'] && typeof vc['@context'] === 'string') {
          if (!vc['@context'].startsWith('http') && !vc['@context'].startsWith('did:')) {
            errors.push(`verifiableCredential[${index}]: @context should be a URL, not a JWT token string`);
          }
        }
        // Should have envelope property or similar
        if (!vc.envelope && !vc.jwt && !vc.credential) {
          warnings.push(`verifiableCredential[${index}]: EnvelopedVerifiableCredential should contain the actual credential in an envelope property`);
        }
      } else {
        // Validate embedded VC
        const vcResult = validateVerifiableCredential(vc);
        if (!vcResult.valid) {
          errors.push(`verifiableCredential[${index}]: ${vcResult.errors.join('; ')}`);
        }
        warnings.push(...vcResult.warnings.map(w => `verifiableCredential[${index}]: ${w}`));
      }
    });
  }

  // Check proof (for verifiable presentations)
  if (!vp.proof && !vp.jwt) {
    warnings.push('VerifiablePresentation should have a proof or jwt property for verification');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates a JWT structure (basic validation)
 */
function validateJWT(jwt) {
  const errors = [];
  const warnings = [];

  if (typeof jwt !== 'string') {
    errors.push('JWT must be a string');
    return { valid: false, errors, warnings };
  }

  const parts = jwt.split('.');
  if (parts.length !== 3) {
    errors.push('JWT must have 3 parts separated by dots (header.payload.signature)');
    return { valid: false, errors, warnings };
  }

  try {
    // Decode header
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (!header.alg) {
      errors.push('JWT header must have an alg property');
    }
    if (!header.typ || header.typ !== 'JWT') {
      warnings.push('JWT header should have typ: "JWT"');
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    
    // Check for VC in payload
    if (payload.vc) {
      const vcResult = validateVerifiableCredential(payload.vc);
      if (!vcResult.valid) {
        errors.push(`VC in JWT payload: ${vcResult.errors.join('; ')}`);
      }
      warnings.push(...vcResult.warnings.map(w => `VC in JWT payload: ${w}`));
    }

    // Check for VP in payload
    if (payload.vp) {
      const vpResult = validateVerifiablePresentation(payload.vp);
      if (!vpResult.valid) {
        errors.push(`VP in JWT payload: ${vpResult.errors.join('; ')}`);
      }
      warnings.push(...vpResult.warnings.map(w => `VP in JWT payload: ${w}`));
    }

  } catch (e) {
    errors.push(`Failed to decode JWT: ${e.message}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Main CLI handler
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node validate-w3c-vc.js --validate-vc|vp|jwt "<json-string>"');
    process.exit(1);
  }

  const command = args[0];
  const input = args[1];

  let result;
  let inputType;

  try {
    let parsed;
    
    // Try to parse as JSON first
    try {
      parsed = JSON.parse(input);
      inputType = 'json';
    } catch {
      // If not JSON, treat as JWT string
      parsed = input;
      inputType = 'jwt';
    }

    switch (command) {
      case '--validate-vc':
        if (inputType === 'jwt') {
          result = validateJWT(parsed);
        } else {
          result = validateVerifiableCredential(parsed);
        }
        break;
      
      case '--validate-vp':
        if (inputType === 'jwt') {
          result = validateJWT(parsed);
        } else {
          result = validateVerifiablePresentation(parsed);
        }
        break;
      
      case '--validate-jwt':
        result = validateJWT(parsed);
        break;
      
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Available commands: --validate-vc, --validate-vp, --validate-jwt');
        process.exit(1);
    }

    // Output result as JSON
    const output = {
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
      timestamp: new Date().toISOString()
    };

    console.log(JSON.stringify(output, null, 2));
    
    // Exit with error code if validation failed
    process.exit(result.valid ? 0 : 1);

  } catch (error) {
    console.error(JSON.stringify({
      valid: false,
      errors: [`Failed to validate: ${error.message}`],
      warnings: [],
      timestamp: new Date().toISOString()
    }, null, 2));
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('validate-w3c-vc.js')) {
  main();
}

// Export for use as module (ES modules)
export { validateVerifiableCredential, validateVerifiablePresentation, validateJWT };

