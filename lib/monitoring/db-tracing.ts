/**
 * Database Tracing Helper
 * 
 * Provides utilities to add OpenTelemetry tracing to Supabase database operations
 */

import { createDatabaseSpan, addSpanAttributes, recordSpanEvent } from './tracing'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Trace a database query with automatic span management
 */
export async function traceDbQuery<T>(
  operation: string,
  tableName: string,
  queryFn: () => Promise<T>,
  attributes: Record<string, string | number | boolean> = {}
): Promise<T> {
  const span = createDatabaseSpan(operation, tableName, attributes)
  
  const startTime = Date.now()
  recordSpanEvent('db_query_started', {
    operation,
    table: tableName,
  })
  
  try {
    const result = await queryFn()
    
    const duration = Date.now() - startTime
    addSpanAttributes({
      'db.duration_ms': duration,
      'db.success': true,
    })
    
    recordSpanEvent('db_query_completed', {
      operation,
      table: tableName,
      duration_ms: duration,
    })
    
    span.setStatus({ code: 1 }) // SUCCESS
    return result
    
  } catch (error) {
    const duration = Date.now() - startTime
    
    addSpanAttributes({
      'db.duration_ms': duration,
      'db.success': false,
      'db.error': error instanceof Error ? error.message : 'Unknown error',
    })
    
    recordSpanEvent('db_query_failed', {
      operation,
      table: tableName,
      duration_ms: duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    
    span.recordException(error as Error)
    span.setStatus({ 
      code: 2, // ERROR
      message: error instanceof Error ? error.message : 'Database query failed'
    })
    
    throw error
  } finally {
    span.end()
  }
}

/**
 * Trace a database RPC call
 */
export async function traceDbRpc<T>(
  procedureName: string,
  rpcFn: () => Promise<T>,
  attributes: Record<string, string | number | boolean> = {}
): Promise<T> {
  const span = createDatabaseSpan('rpc', procedureName, {
    'db.procedure_name': procedureName,
    ...attributes,
  })
  
  const startTime = Date.now()
  recordSpanEvent('db_rpc_started', {
    procedure: procedureName,
  })
  
  try {
    const result = await rpcFn()
    
    const duration = Date.now() - startTime
    addSpanAttributes({
      'db.duration_ms': duration,
      'db.success': true,
    })
    
    recordSpanEvent('db_rpc_completed', {
      procedure: procedureName,
      duration_ms: duration,
    })
    
    span.setStatus({ code: 1 }) // SUCCESS
    return result
    
  } catch (error) {
    const duration = Date.now() - startTime
    
    addSpanAttributes({
      'db.duration_ms': duration,
      'db.success': false,
      'db.error': error instanceof Error ? error.message : 'Unknown error',
    })
    
    recordSpanEvent('db_rpc_failed', {
      procedure: procedureName,
      duration_ms: duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    
    span.recordException(error as Error)
    span.setStatus({ 
      code: 2, // ERROR
      message: error instanceof Error ? error.message : 'Database RPC failed'
    })
    
    throw error
  } finally {
    span.end()
  }
}

/**
 * Create a traced Supabase client wrapper with common operations traced
 * This extends the regular Supabase client with tracing capabilities
 */
export function createTracedSupabaseClient(client: SupabaseClient) {
  return {
    // Pass through the original client for non-traced operations
    ...client,
    
    // Traced query operations
    tracedSelect: <T>(table: string, query: () => Promise<T>, attributes?: Record<string, string | number | boolean>) =>
      traceDbQuery('select', table, query, attributes),
      
    tracedInsert: <T>(table: string, query: () => Promise<T>, attributes?: Record<string, string | number | boolean>) =>
      traceDbQuery('insert', table, query, attributes),
      
    tracedUpdate: <T>(table: string, query: () => Promise<T>, attributes?: Record<string, string | number | boolean>) =>
      traceDbQuery('update', table, query, attributes),
      
    tracedDelete: <T>(table: string, query: () => Promise<T>, attributes?: Record<string, string | number | boolean>) =>
      traceDbQuery('delete', table, query, attributes),
      
    tracedRpc: <T>(procedureName: string, rpcFn: () => Promise<T>, attributes?: Record<string, string | number | boolean>) =>
      traceDbRpc(procedureName, rpcFn, attributes),
  }
}
